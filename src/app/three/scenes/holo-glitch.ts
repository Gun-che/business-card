import { BackgroundScene } from './background-scene.model';

// Голографический туннель: сетка в перспективе уходит вглубь, мышь поворачивает камеру.
// Сверху глитч — сдвиг блоков, разложение RGB, сканлайны, мерцание
export const holoGlitchScene: BackgroundScene = {
  name: 'holo',
  title: 'Holo glitch',
  source: 'own',
  type: 'native',
  code: `
const vec3 holoA = vec3(0.0, 0.9, 1.0);
const vec3 holoB = vec3(1.0, 0.1, 0.8);

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

mat2 rot(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
}

// Туннель: квадратная труба из сетки, камера смотрит вглубь
vec3 tunnel(vec2 uv, vec2 mouse, float t) {
    // Поворот камеры мышью
    vec3 ray = normalize(vec3(uv, 0.8));
    ray.yz *= rot(-mouse.y * 0.6);
    ray.xy *= rot(mouse.x * 0.5);
    ray.xy *= rot(t * 0.1);

    // Расстояние до стенок квадратной трубы радиуса 1
    float wall = max(abs(ray.x), abs(ray.y));
    float dist = 1.0 / max(wall, 1e-3);
    vec3 p = ray * dist;
    float z = p.z + t * 2.0;

    // Координата вдоль периметра
    float side = step(abs(ray.x), abs(ray.y));
    float along = mix(p.y, p.x, side);

    vec2 g = vec2(along * 3.0, z * 1.5);
    vec2 gf = abs(fract(g) - 0.5);
    float lw = 0.035 + 0.01 * dist;
    float grid = smoothstep(lw, 0.0, gf.x) + smoothstep(lw, 0.0, gf.y);
    grid = clamp(grid, 0.0, 1.0);

    // Бегущие кольца
    float ring = smoothstep(0.1, 0.0, abs(fract(z * 0.25 - t * 0.5) - 0.5) - 0.4);

    float fade = exp(-dist * 0.18);
    vec3 col = mix(holoA, holoB, 0.5 + 0.5 * sin(z * 0.5 + t));
    vec3 color = col * grid * fade;
    color += holoB * ring * fade * 0.5;
    color += col * 0.03 * fade;

    // Светящаяся точка в конце туннеля
    color += mix(holoA, vec3(1.0), 0.5) * exp(-length(ray.xy) * 12.0) * 0.8;
    return color;
}

vec3 renderScene(vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * uResolution.xy) / uResolution.y;
    vec2 mouse = uMouse.xy / uResolution.xy - 0.5;
    float t = uTime;

    // Глитч: сила растёт волнами и от скорости курсора (uColor.r = скорость)
    float burst = step(0.75, hash(vec2(floor(t * 3.0), 1.0)));
    float glitch = burst * 0.5 + uColor.r * 0.6;

    // Сдвиг горизонтальных блоков
    float band = floor(uv.y * 20.0 + t * 2.0);
    float shift = (hash(vec2(band, floor(t * 12.0))) - 0.5) * 0.15 * glitch;
    shift *= step(0.6, hash(vec2(band, floor(t * 4.0))));
    uv.x += shift;

    // Разложение RGB
    float split = 0.0015 + 0.015 * glitch;
    vec3 color;
    color.r = tunnel(uv + vec2(split, 0.0), mouse, t).r;
    color.g = tunnel(uv, mouse, t).g;
    color.b = tunnel(uv - vec2(split, 0.0), mouse, t).b;

    // Сканлайны и мерцание
    color *= 0.85 + 0.15 * sin(fragCoord.y * 2.0 + t * 20.0);
    color *= 0.95 + 0.05 * hash(vec2(t * 60.0, 0.0));

    // Шум на глитче
    color += (hash(uv * 100.0 + t) - 0.5) * 0.2 * glitch;

    // Виньетка
    color *= 1.0 - 0.35 * dot(uv, uv);
    return max(color, 0.0);
}
`
};
