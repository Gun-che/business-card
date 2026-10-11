export interface BackgroundScene {
  name: string;
  title: string;
  author?: string;
  source: string;
  /**
   * native — код объявляет `vec3 renderScene(vec2 fragCoord)` и пользуется uniform'ами draw-background напрямую;
   * shadertoy — код как есть с shadertoy.com: `mainImage(out vec4, in vec2)` и iTime/iResolution/iMouse
   */
  type: 'native' | 'shadertoy';
  code: string;
}
