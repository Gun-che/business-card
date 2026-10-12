import { BackgroundScene } from './background-scene.model';
import { curveChunk } from './curve.glsl';

const header = `
uniform vec2 uRatio;
uniform vec2 uSize;
uniform vec2 uPoints[SHADER_POINTS];
uniform vec3 uColor;
uniform vec3 uResolution;
uniform float uTime;
uniform float uCurveAlpha;
// Вспышка курсора по клику, 0..1
uniform float uCurveFlash;
uniform vec4 uMouse;
// Сила глитча на весь экран: фоновый уровень маленький, F даёт вспышку
uniform float uGlitch;
// 1 — идёт мини-игра (сцены могут вести себя динамичнее)
uniform float uGame;
// Волна от клика: xy — центр в пикселях, z — радиус, w — сила
uniform vec4 uGlitchWave;
// Слово-эхо по клику на текст: текстура, прямоугольник (центр xy, размер zw), сила
uniform sampler2D uWord;
uniform vec4 uWordRect;
uniform float uWordStrength;

// Камера города считается на CPU один раз за кадр, а не в каждом пикселе
uniform vec3 uEye;
uniform vec2 uCenter;
uniform vec3 uCameraDir;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uForward; // уже умножен на zoom

varying vec2 vUv;
`;

// Минимальная совместимость с shadertoy.com (одиночный проход, без iChannel)
const shadertoyHeader = `
#define iTime uTime
#define iResolution uResolution
#define iMouse uMouse
#define iFrame int(uTime * 60.0)
#define iTimeDelta 0.016
#define iDate vec4(0.0, 0.0, 0.0, uTime)
`;

const shadertoyFooter = `
vec3 renderScene(vec2 fragCoord) {
    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    return color.rgb;
}
`;

// Глитч поверх любой сцены: рваные полосы, разложение RGB, шум и вертикальный срыв кадра
const glitchChunk = `
float glitchHash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
}

vec3 renderGlitched(vec2 fragCoord) {
    // Один выход из функции: ранний return даёт предупреждение ANGLE/HLSL о неинициализированной переменной
    // Волна от клика: кольцо с размытым краем, внутри — ослабленный шлейф
    float waveDist = distance(fragCoord, uGlitchWave.xy) - uGlitchWave.z;
    float ringW = uResolution.y * 0.12;
    float ring = smoothstep(ringW, 0.0, abs(waveDist));
    float inside = smoothstep(0.0, -ringW * 2.0, waveDist) * 0.35;
    float local = uGlitchWave.w * max(ring, inside);

    float g = max(uGlitch, local);
    g *= step(0.01, g);
    // Полосы меняются ~15 раз в секунду
    float frame = floor(uTime * 15.0);
    float bandH = uResolution.y * (0.02 + 0.05 * glitchHash(vec2(frame, 7.0)));
    float band = floor(fragCoord.y / bandH);
    float r = glitchHash(vec2(band, frame));

    // Какая доля полос затронута — растёт с силой глитча
    float hitBand = step(1.0 - 0.7 * min(g, 1.0), r);
    // На сильной вспышке часть полос дополнительно «рвёт» — удвоенный сдвиг и инверсия цвета
    float tear = hitBand * step(1.0, g) * step(0.7, glitchHash(vec2(band, frame + 9.0)));

    // Сдвиг полосы по горизонтали
    float shift = (glitchHash(vec2(band, frame + 3.0)) - 0.5) * uResolution.x * 0.25 * g * hitBand * (1.0 + tear);
    // Срыв кадра по вертикали — только при сильной вспышке
    float roll = uResolution.y * 0.2 * g * step(0.5, g) * step(0.5, glitchHash(vec2(frame, 11.0)));
    // Вертикальное дрожание полос
    float jitter = (glitchHash(vec2(band, frame + 4.0)) - 0.5) * uResolution.y * 0.03 * g * hitBand;
    vec2 fc = fragCoord + vec2(shift, roll + jitter);
    // Крупная пикселизация на вспышке
    float pixel = 1.0 + 7.0 * step(1.0, g) * hitBand;
    fc = floor(fc / pixel) * pixel;

    vec3 color = renderScene(fc);

    // Разложение RGB только в затронутых полосах — экономим на тяжёлых сценах
    if (hitBand > 0.5 && g > 0.3) {
        float split = uResolution.x * 0.02 * g;
        color.r = renderScene(fc + vec2(split, 0.0)).r;
        color.b = renderScene(fc - vec2(split, 0.0)).b;
    }

    // Шум и подсветка затронутых полос
    float noise = glitchHash(fragCoord * 0.5 + frame) - 0.5;
    color += noise * 0.4 * g * hitBand;
    color = mix(color, 1.0 - color, tear);
    color += vec3(0.1, 0.4, 0.5) * 0.3 * g * hitBand * step(0.8, glitchHash(vec2(band, frame + 5.0)));

    // Мерцание всего кадра
    color *= 1.0 - 0.3 * min(g, 1.0) * step(0.6, glitchHash(vec2(frame, 13.0)));

    // Слово-эхо: проявляется с RGB-разложением, рваными полосами и выпадениями
    if (uWordStrength > 0.001) {
        float wordBand = floor(fragCoord.y / (uResolution.y * 0.03));
        float wordHit = step(0.7, glitchHash(vec2(wordBand, frame + 21.0)));
        vec2 wuv = (fragCoord - uWordRect.xy) / uWordRect.zw + 0.5;
        wuv.x += (glitchHash(vec2(wordBand, frame + 23.0)) - 0.5) * 0.12 * wordHit;

        if (wuv.x > 0.0 && wuv.x < 1.0 && wuv.y > 0.0 && wuv.y < 1.0) {
            float split = 0.008 + 0.03 * wordHit;
            float ar = texture2D(uWord, wuv + vec2(split, 0.0)).a;
            float ag = texture2D(uWord, wuv).a;
            float ab = texture2D(uWord, wuv - vec2(split, 0.0)).a;

            vec3 tint = mix(vec3(1.0, 0.25, 0.9), vec3(0.3, 0.9, 1.0), wordHit);
            float scan = 0.8 + 0.2 * sin(fragCoord.y * 1.5);
            float flicker = 0.75 + 0.25 * glitchHash(vec2(frame, 31.0));
            // Часть полос выпадает целиком
            float dropout = step(0.12, glitchHash(vec2(wordBand, frame + 33.0)));

            color += vec3(ar, ag, ab) * tint * uWordStrength * scan * flicker * dropout * 1.6;
        }
    }
    return color;
}
`;

const main = `
void main() {
    vec3 color = renderGlitched(gl_FragCoord.xy);

    if (uCurveAlpha > 0.001) {
        vec3 curveColor = renderCurve();
        float alpha = max(curveColor.r, max(curveColor.g, curveColor.b)) * uCurveAlpha;
        color = mix(color, curveColor, alpha);
    }

    gl_FragColor = vec4(color, 1.0);
}
`;

export function composeFragmentShader(scene: BackgroundScene): string {
  const sceneCode = scene.type === 'shadertoy'
    ? shadertoyHeader + scene.code + shadertoyFooter
    : scene.code;

  return header + sceneCode + glitchChunk + curveChunk + main;
}
