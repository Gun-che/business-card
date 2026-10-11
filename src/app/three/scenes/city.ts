import { BackgroundScene } from './background-scene.model';

// Неоновый город: https://www.shadertoy.com/view/wdfGW4
// Камера (uEye, uRight, uUp, uForward...) считается на CPU в draw-background.ts
export const cityScene: BackgroundScene = {
  name: 'city',
  title: 'Neon city',
  source: 'https://www.shadertoy.com/view/wdfGW4',
  type: 'native',
  code: `
const vec3 windowColorA = vec3(0.0, 0.0, 1.5);
const vec3 windowColorB = vec3(0.5, 1.5, 2.0);

const float fogOffset = 7.0;
const float fogDensity = 0.7;
const vec3 fogColor = vec3(0.25, 0.0, 0.3);
// Дальше этой дистанции туман непрозрачен (exp(-0.7 * 11) < 1/255) — трассировать нет смысла
const float maxDist = 18.0;

const float lightHeight = 0.0;
const float lightSpeed = 0.15;
const vec3 lightColorA = vec3(0.6, 0.3, 0.1);
const vec3 lightColorB = vec3(0.8, 0.6, 0.4);

const vec3 signColorA = vec3(0.0, 0.0, 1.5);
const vec3 signColorB = vec3(3.0, 3.0, 3.0);

const float tau = 6.283185;

float hash1(float p) {
    vec3 p3 = fract(p * vec3(5.3983, 5.4427, 6.9371));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float hash1(vec2 p2) {
    p2 = fract(p2 * vec2(5.3983, 5.4427));
    p2 += dot(p2.yx, p2.xy + vec2(21.5351, 14.3137));
    return fract(p2.x * p2.y * 95.4337);
}

float hash1(vec2 p2, float p) {
    vec3 p3 = fract(vec3(5.3983 * p2.x, 5.4427 * p2.y, 6.9371 * p));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash2(vec2 p2, float p) {
    vec3 p3 = fract(vec3(5.3983 * p2.x, 5.4427 * p2.y, 6.9371 * p));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 hash3(vec2 p2) {
    vec3 p3 = fract(vec3(p2.xyx) * vec3(5.3983, 5.4427, 6.9371));
    p3 += dot(p3, p3.yxz + 19.19);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}

vec4 hash4(vec2 p2) {
    vec4 p4 = fract(p2.xyxy * vec4(5.3983, 5.4427, 6.9371, 7.1283));
    p4 += dot(p4, p4.yxwz + 19.19);
    return fract((p4.xxxy + p4.yyzz + p4.zwww) * p4.wzyx);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash1(i + vec2(0.0, 0.0)),
                   hash1(i + vec2(1.0, 0.0)), u.x),
               mix(hash1(i + vec2(0.0, 1.0)),
                   hash1(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Пересечение луча с AABB. Возвращает (t, face) или (500, 0) при промахе
vec2 intersectBox(vec3 eye, vec3 ray, vec3 ri, vec3 side, vec3 lo, vec3 hi) {
    vec3 wall = mix(hi, lo, side);
    vec3 t = (wall - eye) * ri;

    vec3 dim = step(t.zxy, t) * step(t.yzx, t);
    float maxT = dot(dim, t);
    float maxFace = dim.x - dim.y;

    vec3 p = eye + maxT * ray;
    dim += step(lo, p) * step(p, hi);

    return dim.x * dim.y * dim.z > 0.5 ? vec2(maxT, maxFace) : vec2(500.0, 0.0);
}

vec4 castRay(vec3 eye, vec3 ray, vec2 center) {
    vec2 block = floor(eye.xy);
    vec3 ri = 1.0 / ray;
    vec3 rs = sign(ray);
    vec3 side = 0.5 + 0.5 * rs;
    vec2 ris = ri.xy * rs.xy;
    vec2 dis = (block - eye.xy + 0.5 + rs.xy * 0.5) * ri.xy;
    float tEnter = 0.0;

    for (int i = 0; i < 16; ++i) {
        // Дальше — сплошной туман
        if (tEnter > maxDist) {
            break;
        }

        float tExit = min(dis.x, dis.y);
        float d = dot(block - center, uCameraDir.xy);
        float height = 3.0 * hash1(block) - 1.0 + 1.5 * d - 0.1 * d * d;

        // Все коробки ячейки лежат внутри неё и не выше height:
        // если луч проходит ячейку целиком над крышей — пропускаем дорогие проверки
        float zMin = eye.z + ray.z * (ray.z < 0.0 ? tExit : tEnter);

        if (zMin <= height) {
            vec2 hit = vec2(500.0, 0.0);

            {
                vec4 signHash = hash4(block);
                vec2 signCenter = vec2(0.2, -0.4) + vec2(0.6, -0.8) * signHash.xy;
                float width = 0.06 + 0.1 * signHash.w;

                vec3 lo = vec3(signCenter.x - width, 0.55, -100.0);
                vec3 hi = vec3(signCenter.x + width, 0.99, signCenter.y + width + height);

                float s = step(0.5, signHash.z);
                lo = vec3(block, 0.0) + mix(lo, lo.yxz, s);
                hi = vec3(block, 0.0) + mix(hi, hi.yxz, s);

                hit = intersectBox(eye, ray, ri, side, lo, hi);
            }

            for (int j = 0; j < 5; ++j) {
                float fj = float(j);
                vec3 lo = vec3(block + 0.45 * hash2(block, fj), -100.0);
                vec3 hi = vec3(block + 0.55 + 0.45 * hash2(block, fj + 0.5), height - 0.4 * fj);

                vec2 boxHit = intersectBox(eye, ray, ri, side, lo, hi);
                if (boxHit.x < hit.x) {
                    hit = boxHit;
                }
            }

            if (hit.x < 400.0) {
                return vec4(hit.x, height, hit.y, 1.0);
            }
        }

        vec2 dim = step(dis.xy, dis.yx);
        dis += dim * ris;
        block += dim * rs.xy;
        tEnter = tExit;
    }

    return vec4(100.0, 0.0, 0.0, 1.0);
}

vec3 window(float z, vec2 pos, vec2 id) {
    float windowSize = 0.03 + 0.12 * hash1(id + 0.1);
    float windowProb = 0.3 + 0.8 * hash1(id + 0.2);
    float depth = z / windowSize;
    float level = floor(depth);
    vec3 colorA = mix(windowColorA, windowColorB, hash3(id));
    vec3 colorB = mix(windowColorA, windowColorB, hash3(id + 0.1));
    vec3 color = mix(colorA, colorB, hash1(id, level));
    color *= 0.3 + 0.7 * smoothstep(0.1, 0.5, noise(20.0 * pos + 100.0 * hash1(level)));
    color *= smoothstep(windowProb - 0.2, windowProb + 0.2, hash1(id, level + 0.1));
    return color * (0.5 - 0.5 * cos(tau * depth));
}

vec3 addLight(vec3 eye, vec3 ray, float res, float time, float height) {
    vec2 q = eye.xy + ((height - eye.z) / ray.z) * ray.xy;

    float row = floor(q.x + 0.5);
    time += hash1(row);
    float col = floor(0.125 * q.y - time);

    float pos = 0.4 + 0.4 * cos(time + tau * hash1(vec2(row, col)));
    vec3 lightPos = vec3(row, 8.0 * (col + time + pos), height);

    // Ближайшие точки луча и отрезка вдоль оси Y (lightDir = (0, 1, 0), |ray| = 1)
    // http://geomalgorithms.com/a07-_distance.html
    vec3 w = eye - lightPos;
    float b = ray.y;
    float d = dot(ray, w);
    float e = w.y;
    float D = 1.0 - b * b;
    float s = (b*e - d) / D;
    float t = max((e - b*d) / D, 0.0);

    float mask = smoothstep(res + 0.1, res, s);
    if (mask <= 0.0) {
        return vec3(0.0);
    }

    vec3 diff = eye + s * ray - lightPos;
    diff.y -= t;
    float dist2 = dot(diff, diff);

    float light = min(1.0 / pow(200.0 * dist2 / t + 20.0 * t * t, 0.8), 2.0);
    float fog = exp(-fogDensity * max(s - fogOffset, 0.0));
    vec3 color = mix(lightColorA, lightColorB, hash3(vec2(row, col)));
    return mask * light * fog * color;
}

vec3 addSign(vec3 color, vec3 pos, float side, vec2 id) {
    vec4 signHash = hash4(id);
    float s = step(0.5, signHash.z);
    if ((s - 0.5) * side < 0.1)
        return color;

    vec2 center = vec2(0.2, -0.4) + vec2(0.6, -0.8) * signHash.xy;
    vec2 p = mix(pos.xz, pos.yz, s);
    float halfWidth = 0.04 + 0.06 * signHash.w;

    float charCount = floor(1.0 + 8.0 * hash1(id + 0.5));
    if (center.y - p.y > 2.0 * halfWidth * (charCount + 1.0)) {
        center.y -= 2.0 * halfWidth * (charCount + 1.5 + 5.0 * hash1(id + 0.6));
        charCount = floor(2.0 + 12.0 * hash1(id + 0.7));
        id += 0.05;
    }

    vec3 signColor = mix(signColorA, signColorB, hash3(id + 0.5));
    vec3 outlineColor = mix(signColorA, signColorB, hash3(id + 0.6));
    float flash = 6.0 - 24.0 * hash1(id + 0.8);
    flash *= step(3.0, flash);
    flash = smoothstep(0.1, 0.5, 0.5 + 0.5 * cos(flash * uTime));

    vec2 halfSize = vec2(halfWidth, halfWidth * charCount);
    center.y -= halfSize.y;
    float outline = length(max(abs(p - center) - halfSize, 0.0)) / halfWidth;
    color *= smoothstep(0.1, 0.4, outline);

    vec2 charPos = 0.5 * (p - center + halfSize) / halfWidth;
    vec2 charId = id + 0.05 + 0.1 * floor(charPos);
    float flicker = hash1(charId);
    flicker = step(0.93, flicker);
    flicker = 1.0 - flicker * step(0.96, hash1(charId, uTime));

    float char = -3.5 + 8.0 * noise(id + 6.0 * charPos);
    charPos = fract(charPos);
    char *= smoothstep(0.0, 0.4, charPos.x) * smoothstep(1.0, 0.6, charPos.x);
    char *= smoothstep(0.0, 0.4, charPos.y) * smoothstep(1.0, 0.6, charPos.y);
    color = mix(color, signColor, flash * flicker * step(outline, 0.01) * clamp(char, 0.0, 1.0));

    outline = smoothstep(0.0, 0.2, outline) * smoothstep(0.5, 0.3, outline);
    return mix(color, outlineColor, flash * outline);
}

vec3 renderScene(vec2 fragCoord) {
    vec2 xy = 2.0 * fragCoord - uResolution.xy;
    vec3 ray = normalize(xy.x * uRight + xy.y * uUp + uForward * uResolution.y);

    vec4 res = castRay(uEye, ray, uCenter);

    vec3 color = fogColor;
    float fog = exp(-fogDensity * max(res.x - fogOffset, 0.0));

    // Крыши (face == 0) всегда чёрные, а дальние стены полностью скрыты туманом —
    // окна и вывески для них не считаем
    if (fog > 0.001) {
        vec3 surface = vec3(0.0);
        if (res.z != 0.0) {
            vec3 p = uEye + res.x * ray;
            vec2 block = floor(p.xy);
            surface = window(p.z - res.y, p.xy, block);
            surface = addSign(surface, vec3(p.xy - block, p.z - res.y), res.z, block);
            surface *= abs(res.z);
        }
        color = mix(fogColor, surface, fog);
    }

    float time = lightSpeed * uTime;
    color += addLight(uEye.xyz, ray.xyz, res.x, time, lightHeight - 0.6);
    color += addLight(uEye.yxz, ray.yxz, res.x, time, lightHeight - 0.4);
    color += addLight(vec3(-uEye.xy, uEye.z), vec3(-ray.xy, ray.z), res.x, time, lightHeight - 0.2);
    color += addLight(vec3(-uEye.yx, uEye.z), vec3(-ray.yx, ray.z), res.x, time, lightHeight);

    return color;
}
`
};
