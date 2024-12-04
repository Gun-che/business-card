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

  let material;
  let plane;
  let hover = false;

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
// https://www.shadertoy.com/view/XtSGWD

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

float hash11(float p) {
    vec2 p2 = fract(p * vec2(5.3983, 5.4427));
    p2 += dot(p2.yx, p2.xy +  vec2(21.5351, 14.3137));
    return fract(p2.x * p2.y * 95.4337);
}

float hash12(vec2 p) {
    p = fract(p * vec2(5.3983, 5.4427));
    p += dot(p.yx, p.xy + vec2(21.5351, 14.3137));
    return fract(p.x * p.y * 95.4337);
}

float hash13(vec3 p) {
    p = fract(p * vec3(5.3983, 5.4427, 6.9371));
    p += dot(p.zxy, p.xyz + vec3(21.5351, 14.3137, 15.3219));
    return fract(p.x * p.y * p.z * 95.4337);
}

vec2 hash21(float p) {
    vec2 p2 = fract(p * vec2(5.3983, 5.4427));
    p2 += dot(p2.yx, p2.xy +  vec2(21.5351, 14.3137));
    return fract(vec2(p2.x * p2.y * 95.4337, p2.x * p2.y * 97.597));
}

vec3 hash31(float p) {
    vec3 p2 = fract(p * vec3(5.3983, 5.4427, 6.9371));
    p2 += dot(p2.zxy, p2.xyz + vec3(21.5351, 14.3137, 15.3219));
    return fract(vec3(p2.x * p2.y * 95.4337, p2.y * p2.z * 97.597, p2.z * p2.x * 93.8365));
}

float noise12(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return 1.0 - 2.0 * mix(mix(hash12(i + vec2(0.0, 0.0)), 
                               hash12(i + vec2(1.0, 0.0)), u.x),
                           mix(hash12(i + vec2(0.0, 1.0)), 
                               hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

uniform vec2 uRatio;
uniform vec2 uSize;
uniform vec2 uPoints[SHADER_POINTS];
uniform vec3 uColor;
uniform vec3 uResolution;           // разрешение экрана
uniform float uTime;                // время

varying vec2 vUv;

const int buildingCount = 10;
const float buildingLifeTime = 10.0;
const float buildingSpread = 1.2;

const float topCurve = 0.9;
const float topOvershoot = 1.2;

const vec3 backgroundFog = vec3(0.05, 0.0, 0.1);
const vec3 streetGlow = vec3(0.3, 0.15, 0.4);

const float buildingScale = buildingLifeTime / (float(buildingCount) - 1.0);
const float buildingLeft = -0.5 * (buildingSpread - 1.0);

vec3 renderScene() {
    float screenWidth = uResolution.x / uResolution.y;
    float idOffset = floor(uTime / buildingScale);
    
    vec3 color = backgroundFog;
    for (int i = 0; i < buildingCount; ++i) {
        float id = idOffset + float(i);
        float time = (uTime - buildingScale * id) / buildingLifeTime + 1.0;
        
        
        // Building
        vec2 hash = hash21(id);        
        float top = topOvershoot * (topCurve * (time - time * time) + time);
        float center = screenWidth * (buildingLeft + buildingSpread * hash.x);
        vec3 buildingColor = (top - vUv.y) * streetGlow;
        
        vec2 border = 0.02 + 0.03 * hash;
        vec2 outerWindow = vec2(0.01, 0.015) + vec2(0.02, 0.005) * hash21(id + 0.1);
        vec2 innerWindow = 0.25 * hash21(id + 0.2);
        float innerWidth = outerWindow.x * floor(0.2 * (0.5 + hash.y) / outerWindow.x);
        float outerWidth = innerWidth + border.x;
        
        vec2 pos = (vUv - vec2(center, top - border.y)) / outerWindow;
        vec2 local = mod(pos, 1.0);
        vec2 index = floor(pos);
        
        vec3 windowColor = vec3(0.3) + 0.15 * hash31(id);
        float window = hash13(vec3(index, id)) - 0.2 * hash11(id + 0.3);
        window = smoothstep(0.62, 0.68, window);
        window *= step(innerWindow.x, local.x) * step(local.x, 1.0 - innerWindow.x);
        window *= step(innerWindow.y, local.y) * step(local.y, 1.0 - innerWindow.y);
        
        window *= step(index.y, -0.5);
        window *= step(vUv.x, center + innerWidth) * step(center - innerWidth, vUv.x);
        buildingColor = mix(buildingColor, windowColor, window);
        
        buildingColor = mix(buildingColor, backgroundFog, time);
        
        float inside = step(vUv.y, top);
        inside *= step(vUv.x, center + outerWidth);
        inside *= step(center - outerWidth, vUv.x);
        
        color = mix(color, buildingColor, inside);
        
        //Sign
        hash = hash21(id + 0.5);
        vec2 signCenter = vec2(center + outerWidth * (2.0 * hash.x - 1.0), top - 0.2 - 0.2 * hash.y);

        hash = hash21(id + 0.6);
        float charSize = 0.01 + 0.04 * hash.x;
        float charCount = floor(1.0 + 8.0 * hash.y);
        
        vec2 halfSize = 0.5 * vec2(charSize, charSize * charCount);
        float outline = length(max(abs(vUv - signCenter) - halfSize, 0.0));
        
        vec3 signColor = hash31(id - 0.1);
        signColor = signColor / max(max(signColor.r, signColor.g), signColor.b);
        signColor = clamp(vec3(0.2) + signColor, 0.0, 1.0);
        signColor = mix(signColor, backgroundFog, time * time);
        
        vec2 charPos = (vUv - signCenter + halfSize) / charSize;
        float char = 1.5 + 4.0 * noise12(id + 6.0 * charPos);
        charPos = fract(charPos);
        char *= smoothstep(0.0, 0.4, charPos.x) * smoothstep(1.0, 0.6, charPos.x);
        char *= smoothstep(0.0, 0.4, charPos.y) * smoothstep(1.0, 0.6, charPos.y);
        char *= step(outline, 0.001);
        signColor = mix(backgroundFog * time, signColor, clamp(char, 0.0, 1.0));
        color = mix(color, signColor, step(outline, 0.01));
        
        vec3 outlineColor = hash31(id + 0.2);
        outlineColor = outlineColor / max(max(outlineColor.r, outlineColor.g), outlineColor.b);
        outlineColor = clamp(vec3(0.2) + outlineColor, 0.0, 1.0);
        outlineColor = mix(outlineColor, backgroundFog, time * time);
        
        outline = smoothstep(0.0, 0.01, outline) * smoothstep(0.02, 0.01, outline);
        color = mix(color, outlineColor, outline);
        
        // Balls
        hash = hash21(id + 0.8);
        float radius = 0.005 + 0.01 * hash.y;
        float gap = radius + 0.015 * hash.x;
        
        hash = hash21(id + 0.9);
        float ballX = gap * (floor(vUv.x / gap) + 0.5);
        float ballOffset = ballX - center;
        float ballY = top - 0.4 - 0.7 * hash.y + (0.03 + 0.05 * hash.x) * ballOffset * ballOffset;
        float ball = length(vUv - vec2(ballX, ballY)) / radius;
        color = mix(color, outlineColor, smoothstep(1.0, 0.0, ball));
    }
    
    
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
      hover = true;
      const x = (0.5 * nPosition.x) * uRatio.value.x;
      const y = (0.5 * nPosition.y) * uRatio.value.y;
      spline.points[0].set(x, y);

      velocityTarget.x = Math.min(velocity.x + Math.abs(delta.x) / config.velocityTreshold, 1);
      velocityTarget.y = Math.min(velocity.y + Math.abs(delta.y) / config.velocityTreshold, 1);
      velocityTarget.z = Math.sqrt(velocityTarget.x * velocityTarget.x + velocityTarget.y * velocityTarget.y);
      velocity.lerp(velocityTarget, 0.05);
    },
    onPointerLeave() {
      hover = false;
    }
  });

  return { config };
}