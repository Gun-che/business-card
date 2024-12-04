export interface NeonCursorParams {
  el?: HTMLElement,
  eventsEl?: HTMLElement,
  canvas?: HTMLCanvasElement;
  shaderPoints?: number;
  curvePoints?: number;
  curveLerp?: number;
  radius1?: number;
  radius2?: number;
  velocityTreshold?: number;
  width?: number;
  height?: number;
  resize?: boolean | 'window';
}