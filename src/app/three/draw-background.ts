import { CanvasTexture, Color, Mesh, NearestFilter, OrthographicCamera, PlaneGeometry, ShaderMaterial, SplineCurve, Texture, Vector2, Vector3, Vector4 } from 'three';
import { three } from './three';
import { NeonCursorParams } from 'src/app/types/neon-cursor-params';
import { ThreeParamsModel } from 'src/app/types/three-params.model';
import { BackgroundScene } from './scenes/background-scene.model';
import { composeFragmentShader } from './scenes/compose-shader';
import { cityScene } from './scenes/city';

const defaultConfig = {
  shaderPoints: 8,
  curvePoints: 80,
  curveLerp: 0.75,
  radius1: 3,
  radius2: 5,
  velocityTreshold: 10
};

// Параметры камеры города — должны совпадать с логикой шейдера
const CAMERA_DIST = 9.0;
const CAMERA_SPEED = 0.2;
const UP = new Vector3(0, 0, 1);
// Скорость появления/исчезновения курсора (доля за кадр)
const CURVE_FADE = 0.1;
// Вспышка курсора по клику: сила и затухание за кадр
const CURVE_FLASH = 1.0;
const CURVE_FLASH_DECAY = 0.88;
// «Скорость» курсора, которую подкидывает клик: 0 — синий след, 1 — красный
const CLICK_VELOCITY = 0.55;
// Глитч: фоновый уровень, сила вспышки по клику, по клавише F и затухание за кадр
const GLITCH_IDLE = 0.08;
const GLITCH_CLICK = 0.8;
const GLITCH_STRONG = 1.6;
// Переключение сцены: подмена шейдера на пике глитча, мс после начала вспышки
const SCENE_SWITCH_DELAY_MS = 250;
// Волна от клика: скорость расширения (в высотах экрана в секунду) и время жизни в секундах
const GLITCH_WAVE_SPEED = 1.8;
const GLITCH_WAVE_LIFE = 0.9;
// Слово-эхо по клику на текст: время жизни, высота в долях экрана, рост за время жизни
const WORD_LIFE = 1.8;
const WORD_HEIGHT = 0.2;
const WORD_GROWTH = 0.5;
const WORD_FONT_PX = 96;
const GLITCH_DECAY = 0.92;

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;


export function drawBackground(params: NeonCursorParams, backgroundScene: BackgroundScene = cityScene) {
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
  const uResolution = { value: new Vector3(1, 1, 1) };
  const uCurveAlpha = { value: 0.0 };
  const uCurveFlash = { value: 0.0 };
  const uMouse = { value: new Vector4() };
  const uGlitch = { value: 0.0 };
  const uGame = { value: 0.0 };
  const uTravel = { value: 0.0 };
  let travelSpeed = 1;
  // xy — точка клика в пикселях буфера, z — радиус волны, w — сила
  const uGlitchWave = { value: new Vector4(0, 0, 0, 0) };
  let glitchBurst = 0;
  let waveStart = -Infinity;
  // Слово-эхо: текстура с текстом, прямоугольник (центр xy, размер zw) в пикселях буфера, сила
  const uWord = { value: new Texture() as Texture };
  const uWordRect = { value: new Vector4() };
  const uWordStrength = { value: 0.0 };
  let wordStart = -Infinity;
  let wordAspect = 1;
  const wordCenter = new Vector2();
  const uEye = { value: new Vector3() };
  const uCenter = { value: new Vector2() };
  const uCameraDir = { value: new Vector3() };
  const uRight = { value: new Vector3() };
  const uUp = { value: new Vector3() };
  const uForward = { value: new Vector3() };

  let curveAlphaTarget = 0;
  // Во время игры клики отданы игре: волна и вспышка курсора по клику не нужны
  let clickEffectsEnabled = true;
  // Внешние подписчики на кадр (мини-игра): dt и время в секундах
  const frameCallbacks = new Set<(dt: number, time: number) => void>();
  let pointerMoved = false;
  let material: ShaderMaterial;

  const threeConfig: ThreeParamsModel = {};
  const keys = ['el', 'eventsEl', 'canvas', 'width', 'height', 'resize'] as const;
  keys.forEach(key => {
    if (params[key] !== undefined) (threeConfig as Record<string, unknown>)[key] = params[key];
  });

  // Камера плывёт над городом с постоянной скоростью, а мышь меняет только ракурс.
  // Позицию накапливаем по кадрам: формула «скорость × общее время × направление»
  // через минуту превращала поворот мышью в прокрутку всего города
  function updateCamera(elapsedSeconds: number) {
    const pointer = uPoints.value[0];
    const cameraDir = uCameraDir.value.set(-2.0, -1.0, pointer.y * 2.0 - 1.7).normalize();
    const zoom = (pointer.x + 1.5) * 2.0;

    uCenter.value.x -= CAMERA_SPEED * elapsedSeconds * cameraDir.x;
    uCenter.value.y -= CAMERA_SPEED * elapsedSeconds * cameraDir.y;
    uEye.value.set(uCenter.value.x, uCenter.value.y, 0).addScaledVector(cameraDir, -CAMERA_DIST);
    uRight.value.crossVectors(cameraDir, UP).normalize();
    uUp.value.crossVectors(uRight.value, cameraDir);
    uForward.value.copy(cameraDir).multiplyScalar(zoom);
  }

  // iMouse для shadertoy-сцен: голова следа курсора в пикселях буфера.
  // zw заполняем после первого движения — многие шейдеры до этого играют автодемо
  function updateMouse() {
    const head = uPoints.value[0];
    const x = (head.x / uRatio.value.x + 0.5) * uResolution.value.x;
    const y = (head.y / uRatio.value.y + 0.5) * uResolution.value.y;
    uMouse.value.set(x, y, pointerMoved ? x : 0, pointerMoved ? y : 0);
  }

  // Клик: волна глитча расходится из точки клика
  function triggerLocalGlitch(nPosition: { x: number, y: number }) {
    const x = (nPosition.x * 0.5 + 0.5) * uResolution.value.x;
    const y = (nPosition.y * 0.5 + 0.5) * uResolution.value.y;
    uGlitchWave.value.set(x, y, 0, GLITCH_CLICK);
    waveStart = uTime.value;
  }

  // Клавиша F: вспышка на весь экран
  function triggerStrongGlitch() {
    glitchBurst = Math.max(glitchBurst, GLITCH_STRONG);
  }

  // Вспышка произвольной силы на весь экран (смена уровня в игре)
  function triggerGlitch(strength: number) {
    glitchBurst = Math.max(glitchBurst, Math.min(strength, GLITCH_STRONG));
  }

  // Рисуем слово пиксельным шрифтом в канвас и отдаём в шейдер как текстуру
  async function showWord(text: string, clientX: number, clientY: number) {
    const font = `bold ${WORD_FONT_PX}px DogicaPixel, monospace`;
    await document.fonts.load(font).catch(() => {});

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = font;
    const width = Math.ceil(context.measureText(text).width);
    canvas.width = width + WORD_FONT_PX;
    canvas.height = WORD_FONT_PX * 2;
    context.font = font;
    context.fillStyle = '#fff';
    context.textBaseline = 'middle';
    context.fillText(text, WORD_FONT_PX / 2, canvas.height / 2);

    uWord.value.dispose();
    const texture = new CanvasTexture(canvas);
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    uWord.value = texture;
    wordAspect = canvas.width / canvas.height;

    // Клиентские координаты → пиксели буфера, ось Y снизу вверх
    wordCenter.set(
      clientX / instance.width * uResolution.value.x,
      (1 - clientY / instance.height) * uResolution.value.y
    );
    wordStart = uTime.value;
  }

  function updateWord() {
    const age = uTime.value - wordStart;
    if (age > WORD_LIFE) {
      uWordStrength.value = 0;
      return;
    }
    const progress = age / WORD_LIFE;
    const height = uResolution.value.y * WORD_HEIGHT * (1 + WORD_GROWTH * progress);
    uWordRect.value.set(wordCenter.x, wordCenter.y, height * wordAspect, height);
    // Резко появляется, плавно гаснет
    uWordStrength.value = Math.min(1, progress * 10) * (1 - progress) * (1 - progress);
  }

  function updateGlitchWave() {
    const age = uTime.value - waveStart;
    if (age > GLITCH_WAVE_LIFE) {
      uGlitchWave.value.w = 0;
      return;
    }
    uGlitchWave.value.z = age * GLITCH_WAVE_SPEED * uResolution.value.y;
    uGlitchWave.value.w = GLITCH_CLICK * (1 - age / GLITCH_WAVE_LIFE);
  }

  function setScene(scene: BackgroundScene) {
    material.fragmentShader = composeFragmentShader(scene);
    material.needsUpdate = true;
  }

  // Сильный глитч на границе сцен: вспышка на старой, подмена на пике, затухание уже на новой
  let switchTimer: ReturnType<typeof setTimeout> | null = null;
  function switchScene(scene: BackgroundScene, onSwitched?: () => void) {
    if (switchTimer !== null) {
      clearTimeout(switchTimer);
    }
    triggerStrongGlitch();
    switchTimer = setTimeout(() => {
      switchTimer = null;
      setScene(scene);
      triggerStrongGlitch();
      onSwitched?.();
    }, SCENE_SWITCH_DELAY_MS);
  }

  const instance = three({
    ...threeConfig,
    antialias: false,
    initCamera(three) {
      three.camera = new OrthographicCamera();
    },
    initScene({ scene }) {
      const geometry = new PlaneGeometry(2, 2);
      material = new ShaderMaterial({
        uniforms: {
          uRatio, uSize, uPoints, uColor, uTime, uResolution, uCurveAlpha, uCurveFlash, uMouse, uGlitch, uGlitchWave, uGame, uTravel,
          uWord, uWordRect, uWordStrength,
          uEye, uCenter, uCameraDir, uRight, uUp, uForward
        },
        defines: {
          SHADER_POINTS: config.shaderPoints
        },
        depthTest: false,
        depthWrite: false,
        vertexShader,
        fragmentShader: composeFragmentShader(backgroundScene)
      });
      const plane = new Mesh(geometry, material);
      plane.frustumCulled = false;
      scene.add(plane);
    },
    afterResize({ width, height, drawingBufferSize }) {
      uResolution.value.set(drawingBufferSize.x, drawingBufferSize.y, 1);
      uSize.value.set(config.radius1, config.radius2);
      if (width >= height) {
        uRatio.value.set(1, height / width);
        uSize.value.multiplyScalar(1 / width);
      } else {
        uRatio.value.set(width / height, 1);
        uSize.value.multiplyScalar(1 / height);
      }
    },
    beforeRender({ clock }) {
      for (let i = 1; i < config.curvePoints; i++) {
        points[i].lerp(points[i - 1], config.curveLerp);
      }
      for (let i = 0; i < config.shaderPoints; i++) {
        spline.getPoint(i / (config.shaderPoints - 1), uPoints.value[i]);
      }

      uTime.value = clock.time / 1000;
      uCurveAlpha.value += (curveAlphaTarget - uCurveAlpha.value) * CURVE_FADE;
      uCurveFlash.value *= CURVE_FLASH_DECAY;
      // Фоновые глитчи — редкие короткие всплески, клик — сильная вспышка с затуханием
      glitchBurst *= GLITCH_DECAY;
      updateGlitchWave();
      updateWord();
      const dt = Math.min(clock.elapsed, 200) / 1000;
      uTravel.value += dt * travelSpeed;
      frameCallbacks.forEach(callback => callback(dt, uTime.value));
      const idle = Math.sin(uTime.value * 1.7) * Math.sin(uTime.value * 5.3) > 0.9 ? GLITCH_IDLE * 3 : GLITCH_IDLE;
      uGlitch.value = Math.min(GLITCH_STRONG, idle + glitchBurst);
      uColor.value.setRGB(velocity.z, 0, 1 - velocity.z);
      velocity.multiplyScalar(0.95);
      // Кадры дольше 0.2с (вкладка была скрыта) не учитываем, чтобы камера не прыгала
      updateCamera(Math.min(clock.elapsed, 200) / 1000);
      updateMouse();
    },
    onPointerMove({ nPosition, delta }) {
      curveAlphaTarget = 1;
      pointerMoved = true;
      const x = (0.5 * nPosition.x) * uRatio.value.x;
      const y = (0.5 * nPosition.y) * uRatio.value.y;
      spline.points[0].set(x, y);

      velocityTarget.x = Math.min(velocity.x + Math.abs(delta.x) / config.velocityTreshold, 1);
      velocityTarget.y = Math.min(velocity.y + Math.abs(delta.y) / config.velocityTreshold, 1);
      velocityTarget.z = Math.sqrt(velocityTarget.x * velocityTarget.x + velocityTarget.y * velocityTarget.y);
      velocity.lerp(velocityTarget, 0.05);
    },
    onPointerLeave() {
      curveAlphaTarget = 0;
    },
    onPointerClick: ({ nPosition }) => {
      if (!clickEffectsEnabled) {
        return;
      }
      triggerLocalGlitch(nPosition);
      uCurveFlash.value = CURVE_FLASH;
      // Как при быстром движении: цвет следа уходит в фиолетовый и плавно возвращается
      velocity.z = Math.max(velocity.z, CLICK_VELOCITY);
    }
  });

  function addFrameCallback(callback: (dt: number, time: number) => void): () => void {
    frameCallbacks.add(callback);
    return () => frameCallbacks.delete(callback);
  }

  function dispose() {
    frameCallbacks.clear();
    if (switchTimer !== null) {
      clearTimeout(switchTimer);
    }
    instance.dispose();
  }

  return {
    config,
    setScene,
    switchScene,
    triggerStrongGlitch,
    triggerLocalGlitch,
    setClickEffectsEnabled: (enabled: boolean) => clickEffectsEnabled = enabled,
    setGameMode: (enabled: boolean) => uGame.value = enabled ? 1 : 0,
    setTravelSpeed: (speed: number) => travelSpeed = speed,
    triggerGlitch,
    showWord,
    addFrameCallback,
    scene: instance.scene,
    getAspect: () => instance.width / instance.height,
    dispose
  };
}
