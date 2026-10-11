import { BackgroundScene } from './background-scene.model';

// Ретровейв: полосатое солнце, горы и бесконечная сетка в перспективе.
// Мышь по X поворачивает камеру, по Y наклоняет горизонт
export const synthwaveScene: BackgroundScene = {
  name: 'synthwave',
  title: 'Synthwave grid',
  source: 'own',
  type: 'native',
  code: `
const vec3 skyTop = vec3(0.02, 0.0, 0.08);
const vec3 skyBottom = vec3(0.35, 0.0, 0.45);
const vec3 sunTop = vec3(1.0, 0.9, 0.2);
const vec3 sunBottom = vec3(1.0, 0.1, 0.5);
const vec3 gridColor = vec3(1.0, 0.1, 0.8);
const vec3 gridGlow = vec3(0.2, 0.6, 1.0);
#define LIGHT_COUNT 14
// Точек шлейфа за огоньком и шаг по времени между ними
#define TRAIL_COUNT 6
const float trailStep = 0.045;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float mountains(float x, float offset, float scale) {
    float h = noise(vec2(x * scale + offset, 0.0)) * 0.6;
    h += noise(vec2(x * scale * 3.0 + offset, 1.0)) * 0.2;
    return h;
}

// Огоньки, скачущие по сетке навстречу зрителю. Проекция та же, что у пола:
// глубина d, высота камеры 0.12, точка на высоте h проецируется в y = horizon - (0.12 - h) / d
// Положение огонька i в момент t: xy — экран, z — глубина, w — высота прыжка
vec4 lightAt(float fi, float t, float horizon, float yaw) {
    float seed = hash(vec2(fi, 3.7));
    float speed = 0.25 + 0.35 * hash(vec2(fi, 5.1));
    // Глубина убывает со временем — огонёк приближается и уходит на горизонт по кругу
    float d = mod(seed * 3.0 - t * speed, 3.0) + 0.08;
    float lx = (hash(vec2(fi, 7.3)) - 0.5) * 10.0;
    float h = 0.1 * abs(sin(t * (2.0 + 2.0 * seed) + seed * 6.28));
    return vec4((lx - yaw * 3.0) / (d * 4.0), horizon - (0.12 - h) / d, d, h);
}

vec3 bouncingLights(vec2 uv, float horizon, float yaw) {
    vec3 result = vec3(0.0);
    for (int i = 0; i < LIGHT_COUNT; i++) {
        float fi = float(i);
        vec4 light = lightAt(fi, uTime, horizon, yaw);
        float d = light.z;
        float h = light.w;
        vec2 pos = light.xy;
        vec2 ground = vec2(pos.x, horizon - 0.12 / d);

        vec3 tint = mix(gridGlow, gridColor, step(0.5, hash(vec2(fi, 9.9))));
        float fade = smoothstep(3.0, 2.0, d) * smoothstep(0.08, 0.3, d);
        float size = 0.012 / d;

        // Сам огонёк и его ореол
        float dist = length(uv - pos);
        float core = smoothstep(size, size * 0.3, dist);
        float halo = exp(-dist * dist / (size * size * 12.0)) * 0.5;
        result += tint * (core * 1.6 + halo) * fade;

        // Шлейф: прошлые положения, тоньше и тусклее к хвосту
        for (int k = 1; k <= TRAIL_COUNT; k++) {
            float fk = float(k);
            vec4 past = lightAt(fi, uTime - fk * trailStep, horizon, yaw);
            // На стыке цикла огонёк перескакивает с горизонта — шлейф там не рисуем
            if (past.z < d) {
                break;
            }
            float decay = 1.0 - fk / float(TRAIL_COUNT + 1);
            float tSize = size * (0.3 + 0.5 * decay);
            float tDist = length(uv - past.xy);
            float tGlow = exp(-tDist * tDist / (tSize * tSize * 6.0));
            result += tint * tGlow * decay * 0.7 * fade;
        }

        // Блик на полу под огоньком — ярче, когда он низко
        vec2 spot = (uv - ground) * vec2(1.0, 3.0);
        float ground_glow = exp(-dot(spot, spot) / (size * size * 10.0)) * (1.0 - h * 8.0);
        result += tint * max(ground_glow, 0.0) * 0.5 * fade * step(uv.y, horizon);
    }
    return result;
}

vec3 renderScene(vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * uResolution.xy) / uResolution.y;
    vec2 mouse = uMouse.xy / uResolution.xy - 0.5;

    // Камера: мышь по X — поворот, по Y — наклон горизонта
    float yaw = mouse.x * 0.8;
    float horizon = 0.05 - mouse.y * 0.25;
    float cs = cos(yaw * 0.15);
    float sn = sin(yaw * 0.15);
    uv = vec2(uv.x * cs - uv.y * sn, uv.x * sn + uv.y * cs);

    vec3 color = vec3(0.0);

    if (uv.y > horizon) {
        // Небо
        float t = (uv.y - horizon) * 1.6;
        color = mix(skyBottom, skyTop, clamp(t, 0.0, 1.0));

        // Звёзды
        vec2 sp = uv * 40.0 + vec2(yaw * 30.0, 0.0);
        vec2 sid = floor(sp);
        vec2 sc = sid + 0.2 + 0.6 * vec2(hash(sid), hash(sid + 3.3));
        float star = step(0.9, hash(sid + 1.7)) * smoothstep(0.06, 0.0, length(sp - sc));
        star *= 0.5 + 0.5 * sin(uTime * 3.0 + hash(sid + 1.0) * 6.28);
        color += star * t * 1.2;

        // Солнце с полосами
        vec2 sunPos = vec2(-yaw * 0.6, horizon + 0.25);
        float sunDist = length(uv - sunPos);
        float sun = smoothstep(0.26, 0.25, sunDist);
        float band = smoothstep(0.5, 0.52, fract((uv.y - horizon) * 14.0 - uTime * 0.4) + (uv.y - horizon) * 1.2);
        sun *= mix(0.0, 1.0, band);
        vec3 sunColor = mix(sunBottom, sunTop, clamp((uv.y - sunPos.y) * 2.0 + 0.5, 0.0, 1.0));
        color = mix(color, sunColor, sun);
        color += sunColor * 0.25 * exp(-sunDist * 6.0);

        // Горы в два слоя
        float farM = horizon + 0.06 + mountains(uv.x, yaw * 2.0 + 10.0, 2.0) * 0.18;
        float nearM = horizon + 0.02 + mountains(uv.x, yaw * 3.0, 3.0) * 0.12;
        color = mix(color, vec3(0.12, 0.0, 0.25), smoothstep(farM + 0.004, farM, uv.y));
        color = mix(color, vec3(0.04, 0.0, 0.1), smoothstep(nearM + 0.004, nearM, uv.y));
        color += gridGlow * 0.6 * smoothstep(0.015, 0.0, abs(uv.y - nearM));
    } else {
        // Пол: проекция в перспективу
        float depth = 0.12 / (horizon - uv.y);
        float px = uv.x * depth * 4.0 + yaw * 3.0;
        float pz = depth * 4.0 + uTime * 1.5;

        vec2 g = abs(fract(vec2(px, pz)) - 0.5);
        float lineW = 0.04 * depth;
        float line = smoothstep(lineW, 0.0, g.x) + smoothstep(lineW, 0.0, g.y);
        line = clamp(line, 0.0, 1.0);

        float fade = exp(-depth * 0.35);
        vec3 floorColor = mix(vec3(0.03, 0.0, 0.08), vec3(0.1, 0.0, 0.2), fade);
        color = floorColor + gridColor * line * fade * 1.4;

        // Свечение горизонта
        color += mix(gridGlow, skyBottom, 0.5) * exp(-(horizon - uv.y) * 25.0) * 0.8;
    }

    color += bouncingLights(uv, horizon, yaw);

    // Лёгкие сканлайны
    color *= 0.92 + 0.08 * sin(fragCoord.y * 1.5);
    return color;
}
`
};
