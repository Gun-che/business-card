// Неоновый след курсора поверх любой сцены
export const curveChunk = `
// Signed distance to a quadratic bezier
float curveSdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
  vec2 a = B - A;
  vec2 b = A - 2.0*B + C;
  vec2 c = a * 2.0;
  vec2 d = A - pos;
  float kk = 1.0 / max(dot(b,b), 1e-8);
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

vec3 renderCurve() {
    vec2 pos = (vUv - 0.5) * uRatio;

    vec2 cPrev = (uPoints[0] + uPoints[1]) * 0.5;
    float dist = 10000.0;

    for (int i = 1; i < SHADER_POINTS; i++) {
        vec2 c = (uPoints[i - 1] + uPoints[i]) * 0.5;
        dist = min(dist, curveSdBezier(pos, cPrev, uPoints[i - 1], c));
        cPrev = c;
    }

    // Защита от деления на ноль прямо на кривой
    dist = max(dist, 1e-5);
    // Вспышка по клику: чуть ярче и уходит в фиолетовый, как при быстром движении
    float flash = uCurveFlash;
    float glow = pow(uSize.y / dist, 1.5) * (1.0 + 0.35 * flash);

    vec3 color = 2.0 * vec3(smoothstep(uSize.x * (1.0 + 0.4 * flash), 0.0, dist));
    color += glow * mix(uColor, vec3(0.75, 0.15, 1.0), 0.6 * flash);

    // Тон-маппинг и гамма-коррекция
    color = 1.0 - exp(-color);
    return pow(color, vec3(0.4545));
}
`;
