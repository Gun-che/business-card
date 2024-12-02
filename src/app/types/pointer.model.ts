import { Vector2 } from 'three';

export interface PointerModel {
  position: Vector2;
  nPosition: Vector2;
  hover: boolean;
  down: boolean;
  removeListeners: () => void;
}