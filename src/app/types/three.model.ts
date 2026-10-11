import { ThreeParamsModel } from 'src/app/types/three-params.model';
import { OrthographicCamera, PerspectiveCamera, Scene, Vector2, WebGLRenderer } from 'three';
import { PointerModel } from 'src/app/types/pointer.model';

export interface ThreeModel {
  renderer: WebGLRenderer,
  camera: PerspectiveCamera | OrthographicCamera,
  scene: Scene,
  pointer: PointerModel,
  width: number,
  height: number,
  pixelRatio: number,
  drawingBufferSize: Vector2,
  clock: {
    startTime: number,
    time: number,
    elapsed: number
  },
  options: ThreeParamsModel,
  dispose: () => void
}
