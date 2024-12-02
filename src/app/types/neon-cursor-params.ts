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
  sleepRadiusX?: number;
  sleepRadiusY?: number;
  sleepTimeCoefX?: number;
  sleepTimeCoefY?: number;
  width?: number;
  height?: number;
  resize?: boolean | 'window';
}