export interface PointerOptionsModel {
  domElement?: HTMLElement,
  onClick?: (event?: any) => void;
  onEnter?: (event?: any) => void;
  onMove?: (event?: any) => void;
  onLeave?: (event?: any) => void;
  onDragStart?: (event?: any) => void;
  onDragMove?: (event?: any) => void;
  onDragStop?: (event?: any) => void;
}