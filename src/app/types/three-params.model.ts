import { ThreeModel } from 'src/app/types/three.model';

export interface ThreeParamsModel {
  el?: HTMLElement;
  canvas?: HTMLCanvasElement;
  eventsEl?: HTMLElement;
  width?: number;
  height?: number;
  resize?: boolean | 'window';
  alpha?: boolean;
  antialias?: boolean;
  maxPixelRatio?: number;
  minPixelRatio?: number;
  adaptivePixelRatio?: boolean;
  init?: (three: ThreeModel) => void;
  initRenderer?: (three: ThreeModel) => void;
  initCamera?: (three: ThreeModel) => void;
  initScene?: (three: ThreeModel) => void;
  afterResize?: (three: ThreeModel) => void;
  beforeRender?: (three: ThreeModel) => void;
  render?: (three: ThreeModel) => void;
  onPointerMove?: (event?: any) => void;
  onPointerEnter?: (event?: any) => void;
  onPointerLeave?: (event?: any) => void;
  onPointerClick?: (event?: any) => void;
}
