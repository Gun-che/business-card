import { OrthographicCamera, PerspectiveCamera, Scene, Vector2, WebGLRenderer } from 'three';
import { pointer } from './pointer';
import { ThreeModel } from 'src/app/types/three.model';
import { ThreeParamsModel } from 'src/app/types/three-params.model';
import { PointerOptionsModel } from 'src/app/types/pointer-options.model';

// Окно усреднения времени кадра для адаптивного разрешения
const FRAME_SAMPLES = 30;
// Если средний кадр дольше этого порога (~40fps) — понижаем разрешение
const SLOW_FRAME_MS = 25;
// Кадры длиннее этого (переключение вкладки, GC) не учитываем
const MAX_FRAME_SAMPLE_MS = 200;
const PIXEL_RATIO_STEP = 0.15;

export function three(params: ThreeParamsModel): ThreeModel {
  const options: ThreeParamsModel = {
    el: null,
    canvas: null,
    eventsEl: null,
    width: null,
    height: null,
    resize: true,
    alpha: false,
    antialias: false,
    maxPixelRatio: 1,
    minPixelRatio: 0.5,
    adaptivePixelRatio: true,
    init() {
    },
    initCamera() {
    },
    initScene() {
    },
    afterResize() {
    },
    beforeRender() {
    },
    ...params
  };

  const three: ThreeModel = {
    renderer: null,
    camera: null,
    scene: null,
    pointer: null,
    width: 0,
    height: 0,
    pixelRatio: Math.min(window.devicePixelRatio || 1, options.maxPixelRatio),
    drawingBufferSize: new Vector2(),
    clock: {
      startTime: 0,
      time: 0,
      elapsed: 0
    },
    options,
    dispose
  };

  let render: (three: ThreeModel) => void;
  let frameId = 0;
  let frameSamples = 0;
  let frameTimeSum = 0;
  let resizeObserver: ResizeObserver | null = null;

  init();

  return three;

  function init() {
    let canvas: HTMLCanvasElement;
    if (options.el) {
      canvas = document.createElement('canvas');
      options.el.appendChild(canvas);
    } else if (options.canvas) {
      canvas = options.canvas;
    } else {
      throw new Error('Missing parameter : el or canvas is required');
    }

    options.init?.(three);

    three.renderer = new WebGLRenderer({
      canvas,
      alpha: options.alpha,
      antialias: options.antialias,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance'
    });
    three.renderer.setPixelRatio(three.pixelRatio);
    options.initRenderer?.(three);

    three.camera = new PerspectiveCamera();
    three.camera.position.z = 50;
    options.initCamera?.(three);

    three.scene = new Scene();
    options.initScene?.(three);

    resize();
    if (options.resize && !options.width && !options.height) {
      if (options.resize === 'window') {
        window.addEventListener('resize', resize);
      } else {
        // Следим за родителем: срабатывает и при смене высоты из-за панели браузера на мобилках
        resizeObserver = new ResizeObserver(() => resize());
        resizeObserver.observe(canvas.parentElement);
      }
    }

    initPointer();

    render = options.render ?? (() => {
      three.renderer.render(three.scene, three.camera);
    });

    frameId = requestAnimationFrame(timestamp => {
      three.clock.startTime = three.clock.time = timestamp;
      frameId = requestAnimationFrame(animate);
    });
  }

  function initPointer() {
    const pointerOptions: PointerOptionsModel = {};
    if (options.onPointerEnter) { pointerOptions.onEnter = options.onPointerEnter; }
    if (options.onPointerMove) { pointerOptions.onMove = options.onPointerMove; }
    if (options.onPointerLeave) { pointerOptions.onLeave = options.onPointerLeave; }
    if (options.onPointerClick) { pointerOptions.onClick = options.onPointerClick; }
    if (Object.keys(pointerOptions).length > 0) {
      three.pointer = pointer({ domElement: options.eventsEl ?? (options.el ?? options.canvas), ...pointerOptions });
    }
  }

  function animate(timestamp: number) {
    const { clock } = three;
    clock.elapsed = timestamp - clock.time;
    clock.time = timestamp;

    adaptPixelRatio(clock.elapsed);

    options.beforeRender(three);
    render(three);
    frameId = requestAnimationFrame(animate);
  }

  function adaptPixelRatio(elapsed: number) {
    if (!options.adaptivePixelRatio || elapsed > MAX_FRAME_SAMPLE_MS) {
      return;
    }

    frameTimeSum += elapsed;
    frameSamples++;
    if (frameSamples < FRAME_SAMPLES) {
      return;
    }

    const average = frameTimeSum / frameSamples;
    frameTimeSum = 0;
    frameSamples = 0;

    // Только понижаем: повышение обратно приводит к осцилляции качества
    if (average > SLOW_FRAME_MS && three.pixelRatio > options.minPixelRatio) {
      three.pixelRatio = Math.max(options.minPixelRatio, three.pixelRatio - PIXEL_RATIO_STEP);
      three.renderer.setPixelRatio(three.pixelRatio);
      resize();
    }
  }

  function resize() {
    if (options.width && options.height) {
      three.width = options.width;
      three.height = options.height;
    } else if (options.resize === 'window') {
      three.width = window.innerWidth;
      three.height = window.innerHeight;
    } else {
      const parent = three.renderer.domElement.parentElement;
      three.width = parent.clientWidth;
      three.height = parent.clientHeight;
    }

    if (!three.width || !three.height) {
      return;
    }

    three.renderer.setSize(three.width, three.height);
    three.renderer.getDrawingBufferSize(three.drawingBufferSize);
    if (three.camera instanceof PerspectiveCamera) {
      three.camera.aspect = three.width / three.height;
    }
    if (three.camera instanceof PerspectiveCamera || three.camera instanceof OrthographicCamera) {
      three.camera.updateProjectionMatrix();
    }
    options.afterResize?.(three);
  }

  function dispose() {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    resizeObserver?.disconnect();
    three.pointer?.removeListeners();
    three.scene?.traverse(object => {
      const mesh = object as { geometry?: { dispose(): void }, material?: { dispose(): void } };
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    });
    three.renderer.dispose();
    three.renderer.domElement.remove();
  }
}
