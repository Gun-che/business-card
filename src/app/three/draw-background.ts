import { Color, Mesh, OrthographicCamera, PlaneGeometry, ShaderMaterial, SplineCurve, Vector2, Vector3 } from 'three';
import { three } from './three';
import { NeonCursorParams } from 'src/app/types/neon-cursor-params';

const defaultConfig = {
  shaderPoints: 8,
  curvePoints: 80,
  curveLerp: 0.75,
  radius1: 3,
  radius2: 5,
  velocityTreshold: 10
};

export function drawBackground(params: NeonCursorParams) {
  const config = { ...defaultConfig, ...params };

  const points = new Array(config.curvePoints).fill(0).map(() => new Vector2());
  const spline = new SplineCurve(points);

  const velocity = new Vector3();
  const velocityTarget = new Vector3();

  const uRatio = { value: new Vector2() };
  const uSize = { value: new Vector2() };
  const uPoints = { value: new Array(config.shaderPoints).fill(0).map(() => new Vector2()) };
  const uColor = { value: new Color(0xff00ff) };
  const uTime = { value: 0.0 };
  const uResolution = { value: new Vector3(window.innerWidth, window.innerHeight, 1.0) };

  let material: ShaderMaterial;
  let plane: Mesh;

  const threeConfig = {};
  const keys: (keyof NeonCursorParams)[] = ['el', 'eventsEl', 'canvas', 'width', 'height', 'resize'];
  keys.forEach(key => {
    if (params[key] !== undefined) threeConfig[key] = params[key];
  });

  three({
    ...threeConfig,
    antialias: false,
    initCamera(three) {
      three.camera = new OrthographicCamera();
    },
    initScene({ scene }) {
      const geometry = new PlaneGeometry(2, 2);
      material = new ShaderMaterial({
        uniforms: { uRatio, uSize, uPoints, uColor, uTime, uResolution },
        defines: {
          SHADER_POINTS: config.shaderPoints
        },
        vertexShader: `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
        `,
        fragmentShader: `
// https://www.shadertoy.com/view/wdy3DD
// https://www.shadertoy.com/view/MlKcDD
// https://www.shadertoy.com/view/wdfGW4

uniform vec2 uRatio;
uniform vec2 uSize;
uniform vec2 uPoints[SHADER_POINTS];
uniform vec3 uColor;
uniform vec3 uResolution;
uniform float uTime;

varying vec2 vUv;

const float cameraDist = 9.0;
const float speed = 0.2;

const vec3 windowColorA = vec3(0.0, 0.0, 1.5);
const vec3 windowColorB = vec3(0.5, 1.5, 2.0);

const float fogOffset = 7.0;
const float fogDensity = 0.7;
const vec3 fogColor = vec3(0.25, 0.0, 0.3);

const float lightHeight = 0.0;
const float lightSpeed = 0.15;
const vec3 lightColorA = vec3(0.6, 0.3, 0.1);
const vec3 lightColorB = vec3(0.8, 0.6, 0.4);

const vec3 signColorA = vec3(0.0, 0.0, 1.5);
const vec3 signColorB = vec3(3.0, 3.0, 3.0);

const float tau = 6.283185;

// Signed distance to a quadratic bezier
float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
  vec2 a = B - A;
  vec2 b = A - 2.0*B + C;
  vec2 c = a * 2.0;
  vec2 d = A - pos;
  float kk = 1.0 / dot(b,b);
  float kx = kk * dot(a,b);
  float ky = kk * (2.0*dot(a,a)+dot(d,b)) / 3.0;
  float kz = kk * dot(d,a);
  float res = 0.0;
  float p = ky - kx*kx;
  float p3 = p*p*p;
  float q = kx*(2.0*kx*kx - 3.0*ky) + kz;
  float h = q*q + 4.0*p3;
  if(h >= 0.0){
    h = sqrt(h);
    vec2 x = (vec2(h, -h) - q) / 2.0;
    vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
    float t = uv.x + uv.y - kx;
    t = clamp( t, 0.0, 1.0 );
    // 1 root
    vec2 qos = d + (c + b*t)*t;
    res = length(qos);
  } else {
    float z = sqrt(-p);
    float v = acos( q/(p*z*2.0) ) / 3.0;
    float m = cos(v);
    float n = sin(v)*1.732050808;
    vec3 t = vec3(m + m, -n - m, n - m) * z - kx;
    t = clamp( t, 0.0, 1.0 );
    // 3 roots
    vec2 qos = d + (c + b*t.x)*t.x;
    float dis = dot(qos,qos);
    res = dis;
    qos = d + (c + b*t.y)*t.y;
    dis = dot(qos,qos);
    res = min(res,dis);
    qos = d + (c + b*t.z)*t.z;
    dis = dot(qos,qos);
    res = min(res,dis);
    res = sqrt( res );
  }
  return res;
}

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

vec3 getCameraDir() {
  return normalize(vec3( -2.0, -1.0, (uPoints[0].y * 2.0) - 1.7) );
}

float getZoom() {
  return (uPoints[0].x + 1.5) * 2.0;
}

vec4 castRay(vec3 eye, vec3 ray, vec2 center) {
    vec3 cameraDir = getCameraDir();
    vec2 block = floor(eye.xy);
    vec3 ri = 1.0 / ray;
    vec3 rs = sign(ray);
    vec3 side = 0.5 + 0.5 * rs;
    vec2 ris = ri.xy * rs.xy;
    vec2 dis = (block - eye.xy + 0.5 + rs.xy * 0.5) * ri.xy;

    for (int i = 0; i < 16; ++i) {
        float d = dot(block - center, cameraDir.xy);
        float height = 3.0 * hash1(block) - 1.0 + 1.5 * d - 0.1 * d * d;

        vec2 lo0 = vec2(block);
        vec2 loX = vec2(0.45, 0.45);
        vec2 hi0 = vec2(block + 0.55);
        vec2 hiX = vec2(0.45, 0.45);

        float dist = 500.0;
        float face = 0.0;

        {
            vec4 signHash = hash4(block);
            vec2 center = vec2(0.2, -0.4) + vec2(0.6, -0.8) * signHash.xy;
            float width = 0.06 + 0.1 * signHash.w;

            vec3 lo = vec3(center.x - width, 0.55, -100.0);
            vec3 hi = vec3(center.x + width, 0.99, center.y + width + height);

            float s = step(0.5, signHash.z);
            lo = vec3(block, 0.0) + mix(lo, lo.yxz, s);
            hi = vec3(block, 0.0) + mix(hi, hi.yxz, s);

            vec3 wall = mix(hi, lo, side);
            vec3 t = (wall - eye) * ri;

            vec3 dim = step(t.zxy, t) * step(t.yzx, t);
            float maxT = dot(dim, t);
            float maxFace = dim.x - dim.y;

            vec3 p = eye + maxT * ray;
            dim += step(lo, p) * step(p, hi);

            if (dim.x * dim.y * dim.z > 0.5) {
                dist = maxT;
                face = maxFace;
            }
        }

        for (int j = 0; j < 5; ++j) {
            float top = height - 0.4 * float(j);
            vec3 lo = vec3(lo0 + loX * hash2(block, float(j)), -100.0);
            vec3 hi = vec3(hi0 + hiX * hash2(block, float(j) + 0.5), top);

            vec3 wall = mix(hi, lo, side);
            vec3 t = (wall - eye) * ri;

            vec3 dim = step(t.zxy, t) * step(t.yzx, t);
            float maxT = dot(dim, t);
            float maxFace = dim.x - dim.y;

            vec3 p = eye + maxT * ray;
            dim += step(lo, p) * step(p, hi);

            if (dim.x * dim.y * dim.z > 0.5 && maxT < dist) {
                dist = maxT;
                face = maxFace;
            }
        }

        if (dist < 400.0) {
            return vec4(dist, height, face, 1.0);
        }

        float t = eye.z * ri.z;
        vec3 p = eye - t * ray;
        vec2 g = p.xy - block;

        vec2 dim = step(dis.xy, dis.yx);
        dis += dim * ris;
        block += dim * rs.xy;
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
    vec3 lightDir = vec3(0.0, 1.0, 0.0);

    // http://geomalgorithms.com/a07-_distance.html
    vec3 w = eye - lightPos;
    float a = dot(ray, ray);
    float b = dot(ray, lightDir);
    float c = dot(lightDir, lightDir);
    float d = dot(ray, w);
    float e = dot(lightDir, w);
    float D = a * c - b * b;
    float s = (b*e - c*d) / D;
    float t = (a*e - b*d) / D;

    t = max(t, 0.0);
    float dist = distance(eye + s * ray, lightPos + t * lightDir);

    float mask = smoothstep(res + 0.1, res, s);
    float light = min(1.0 / pow(200.0 * dist * dist / t + 20.0 * t * t, 0.8), 2.0);
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

vec3 renderScene() {
    vec3 cameraDir = getCameraDir();
    float zoom = getZoom();
    vec2 center = -speed * uTime * cameraDir.xy;
    vec3 eye = vec3(center, 0.0) - cameraDist * cameraDir;

    vec3 forward = normalize(cameraDir);
    vec3 right = normalize(cross(forward, vec3(0.0, 0.0, 1.0)));
    vec3 up = cross(right, forward);
    vec2 xy = 2.0 * gl_FragCoord.xy - uResolution.xy;
    vec3 ray = normalize(xy.x * right + xy.y * up + zoom * forward * uResolution.y);

    vec4 res = castRay(eye, ray, center);
    vec3 p = eye + res.x * ray;

    vec2 block = floor(p.xy);
    vec3 color = window(p.z - res.y, p.xy, block);

    color = addSign(color, vec3(p.xy - block, p.z - res.y), res.z, block);
    color = mix(vec3(0.0), color, abs(res.z));

    float fog = exp(-fogDensity * max(res.x - fogOffset, 0.0));
    color = mix(fogColor, color, fog);

    float time = lightSpeed * uTime;
    color += addLight(eye.xyz, ray.xyz, res.x, time, lightHeight - 0.6);
    color += addLight(eye.yxz, ray.yxz, res.x, time, lightHeight - 0.4);
    color += addLight(vec3(-eye.xy, eye.z), vec3(-ray.xy, ray.z), res.x, time, lightHeight - 0.2);
    color += addLight(vec3(-eye.yx, eye.z), vec3(-ray.yx, ray.z), res.x, time, lightHeight);
    
    return color;
}

vec3 renderCurve() {
    vec2 pos = (vUv - 0.5) * uRatio;

    // Начальные значения
    vec2 c_prev = (uPoints[0] + uPoints[1]) / 2.0;
    float dist = 10000.0;

    // Цикл для расчета расстояния до кривой Безье
    for (int i = 1; i < SHADER_POINTS; i++) {
        vec2 c = (uPoints[i - 1] + uPoints[i]) / 2.0;
        dist = min(dist, sdBezier(pos, c_prev, uPoints[i - 1], c));
        c_prev = c; // Сдвигаем точку для следующей итерации
    }

    // Эффект свечения
    dist = max(0.0, dist);
    float intensity = 1.5;
    float glow = pow(uSize.y / dist, intensity);

    // Расчет цвета
    vec3 color = vec3(0.0);
    color += 2.0 * vec3(smoothstep(uSize.x, 0.0, dist));
    color += glow * uColor;

    // Тон-маппинг и гамма-коррекция
    color = 1.0 - exp(-color);
    color = pow(color, vec3(0.4545)); // Гамма-коррекция
    return color;
}

void main() {
    // Предвычисляем фон и кривую
    vec3 background = renderScene();
    vec3 curveColor = renderCurve();

    // Оптимизированное смешивание
    float alpha = max(curveColor.r, max(curveColor.g, curveColor.b));
    vec3 finalColor = mix(background, curveColor, alpha);

    gl_FragColor = vec4(finalColor, 1.0);
}
        `
      });
      plane = new Mesh(geometry, material);
      scene.add(plane);
    },
    afterResize({ width, height }) {
      uSize.value.set(config.radius1, config.radius2);
      if (width >= height) {
        uRatio.value.set(1, height / width);
        uSize.value.multiplyScalar(1 / width);
      } else {
        uRatio.value.set(width / height, 1);
        uSize.value.multiplyScalar(1 / height);
      }
    },
    beforeRender({ clock, width, height, wWidth }) {
      for (let i = 1; i < config.curvePoints; i++) {
        points[i].lerp(points[i - 1], config.curveLerp);
      }
      for (let i = 0; i < config.shaderPoints; i++) {
        spline.getPoint(i / (config.shaderPoints - 1), uPoints.value[i]);
      }

      uTime.value = clock.time / 1000;
      uColor.value.r = velocity.z;
      uColor.value.g = 0;
      uColor.value.b = 1 - velocity.z;
      velocity.multiplyScalar(0.95);
    },
    onPointerMove({ nPosition, delta }) {
      const x = (0.5 * nPosition.x) * uRatio.value.x;
      const y = (0.5 * nPosition.y) * uRatio.value.y;
      spline.points[0].set(x, y);

      velocityTarget.x = Math.min(velocity.x + Math.abs(delta.x) / config.velocityTreshold, 1);
      velocityTarget.y = Math.min(velocity.y + Math.abs(delta.y) / config.velocityTreshold, 1);
      velocityTarget.z = Math.sqrt(velocityTarget.x * velocityTarget.x + velocityTarget.y * velocityTarget.y);
      velocity.lerp(velocityTarget, 0.05);
    },
    onPointerLeave() {
      // todo прокидывать в шейдер флаг и не отрисовывать кривую
    }
  });

  return { config };
}