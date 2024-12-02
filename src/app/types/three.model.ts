import { ThreeParamsModel } from 'src/app/types/three-params.model';
import { OrthographicCamera, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { PointerModel } from 'src/app/types/pointer.model';

export interface ThreeModel {
  renderer: WebGLRenderer,
  camera: PerspectiveCamera | OrthographicCamera | any,
  scene: Scene,
  pointer: PointerModel,
  width: number,
  height: number,
  wWidth: number,
  wHeight: number,
  clock: {
    startTime: number,
    time: number,
    elapsed: number
  },
  options: ThreeParamsModel
}