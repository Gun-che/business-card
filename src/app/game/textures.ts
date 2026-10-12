import { CanvasTexture, NearestFilter, Texture } from 'three';

// Пиксельные черепа 16×16 (рогатый — 20×20): # — кость, x — тень, . — пусто. Контур свечения считается автоматически.
// Пять вариантов на одной основе: обычный, с рогами, с открытым ртом, с дыркой в голове, с полузакрытыми глазами.
// У каждого два кадра — чередуются, чтобы череп «шевелился»
const SKULL_VARIANTS: string[][][] = [
  [
    [
      '.....######.....',
      '...##########...',
      '..############..',
      '.##############.',
      '.##############.',
      '################',
      '##.....##.....##',
      '#.......#......#',
      '#.......#......#',
      '##.....##.....##',
      '###...####...###',
      'x######..######x',
      '.x#####..#####x.',
      '.x############x.',
      '..#x#x#..#x#x#..',
      '..#.#.#..#.#.#..'
    ],
    [
      '.....######.....',
      '...##########...',
      '..############..',
      '.##############.',
      '.##############.',
      '################',
      '###....##....###',
      '#.......#......#',
      '#.......#......#',
      '##.....##.....##',
      '###...####...###',
      'x######..######x',
      '.x#####..#####x.',
      '.x############x.',
      '..#x#x#..#x#x#..',
      '...#.#.#..#.#.#.'
    ]
  ],
  [
    [
      '.#................#.',
      '##................##',
      '##x..............x##',
      '.##x............x##.',
      '..##x..######..x##..',
      '...##############...',
      '....############....',
      '...##############...',
      '...##############...',
      '..################..',
      '..##.....##.....##..',
      '..#.......#......#..',
      '..#.......#......#..',
      '..##.....##.....##..',
      '..###...####...###..',
      '..x######..######x..',
      '...x#####..#####x...',
      '...x############x...',
      '....#x#x#..#x#x#....',
      '....#.#.#..#.#.#....'
    ],
    [
      '.#................#.',
      '##................##',
      '##x..............x##',
      '.##x............x##.',
      '..##x..######..x##..',
      '...##############...',
      '....############....',
      '...##############...',
      '...##############...',
      '..################..',
      '..###...####...###..',
      '..##......##.....##.',
      '..#.......#......#..',
      '..##.....##.....##..',
      '..###...####...###..',
      '..x######..######x..',
      '...x#####..#####x...',
      '...x############x...',
      '....#x#x#..#x#x#....',
      '....#.#.#..#.#.#....'
    ]
  ],
  [
    [
      '.....######.....',
      '...##########...',
      '..############..',
      '.##############.',
      '.##############.',
      '################',
      '##.....##.....##',
      '#.......#......#',
      '#.......#......#',
      '##.....##.....##',
      '###...####...###',
      'x######..######x',
      '.x###........##x',
      '.x##..........#.',
      '..#x#........#..',
      '..#.#.#..#.#.#..'
    ],
    [
      '.....######.....',
      '...##########...',
      '..############..',
      '.##############.',
      '.##############.',
      '################',
      '##.....##.....##',
      '#.......#......#',
      '#.......#......#',
      '##.....##.....##',
      '###...####...###',
      'x######..######x',
      '.x####......###x',
      '.x###........##.',
      '..#x#x#....#x#..',
      '..#.#.#..#.#.#..'
    ]
  ],
  [
    [
      '.....####.......',
      '...######..###..',
      '..######....###.',
      '.######......##.',
      '.#######....###.',
      '################',
      '##.....##.....##',
      '#.......#......#',
      '#.......#......#',
      '##.....##.....##',
      '###...####...###',
      'x######..######x',
      '.x#####..#####x.',
      '.x############x.',
      '..#x#x#..#x#x#..',
      '..#.#.#..#.#.#..'
    ],
    [
      '.....####.......',
      '...#######.###..',
      '..#######...###.',
      '.######.....###.',
      '.#######....###.',
      '################',
      '##.....##.....##',
      '#.......#......#',
      '#.......#......#',
      '##.....##.....##',
      '###...####...###',
      'x######..######x',
      '.x#####..#####x.',
      '.x############x.',
      '..#x#x#..#x#x#..',
      '..#.#.#..#.#.#..'
    ]
  ],
  [
    [
      '.....######.....',
      '...##########...',
      '..############..',
      '.##############.',
      '.##############.',
      '################',
      '################',
      '#x.....#x......#',
      '#.......#......#',
      '##.....##.....##',
      '###...####...###',
      'x######..######x',
      '.x#####..#####x.',
      '.x############x.',
      '..#x#x#..#x#x#..',
      '..#.#.#..#.#.#..'
    ],
    [
      '.....######.....',
      '...##########...',
      '..############..',
      '.##############.',
      '.##############.',
      '################',
      '##.....##.....##',
      '#x.....#x......#',
      '#.......#......#',
      '##.....##.....##',
      '###...####...###',
      'x######..######x',
      '.x#####..#####x.',
      '.x############x.',
      '..#x#x#..#x#x#..',
      '..#.#.#..#.#.#..'
    ]
  ]
];

const BONE_COLOR = '#e6fbff';
const SHADE_COLOR = '#8fd8ff';
const GLOW_COLOR = 'rgba(62, 211, 255, 0.5)';
const LETTER_COLOR = '#ff64ff';
const LETTER_SHADOW = 'rgb(34, 0, 92)';
const SKULL_SCALE = 4;
const LETTER_FONT_PX = 48;

function pixelTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  return texture;
}

export const BASE_SKULL_PIXELS = 16;

export interface SkullTexture {
  // Кадры анимации
  frames: CanvasTexture[];
  // Во сколько раз спрайт больше базового 16×16
  scale: number;
}

export function createSkullTextures(): SkullTexture[] {
  return SKULL_VARIANTS.map(frames => ({
    frames: frames.map(createSkullTexture),
    scale: frames[0].length / BASE_SKULL_PIXELS
  }));
}

function createSkullTexture(pixels: string[]): CanvasTexture {
  const size = pixels.length;
  const canvas = document.createElement('canvas');
  canvas.width = size * SKULL_SCALE;
  canvas.height = size * SKULL_SCALE;
  const context = canvas.getContext('2d');

  const at = (x: number, y: number) => pixels[y]?.[x] ?? '.';
  const isBone = (x: number, y: number) => at(x, y) !== '.';

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const pixel = at(x, y);
      let color: string | null = null;
      if (pixel === '#') {
        color = BONE_COLOR;
      } else if (pixel === 'x') {
        color = SHADE_COLOR;
      } else if (isBone(x - 1, y) || isBone(x + 1, y) || isBone(x, y - 1) || isBone(x, y + 1)) {
        // Пустой пиксель рядом с костью — контур свечения (глазницы тоже светятся изнутри)
        color = GLOW_COLOR;
      }
      if (color) {
        context.fillStyle = color;
        context.fillRect(x * SKULL_SCALE, y * SKULL_SCALE, SKULL_SCALE, SKULL_SCALE);
      }
    }
  }

  return pixelTexture(canvas);
}

// Текстуры букв кэшируем: их всего 26
const letterTextures = new Map<string, Texture>();

export function letterTexture(letter: string): Texture {
  const cached = letterTextures.get(letter);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = LETTER_FONT_PX * 1.5;
  canvas.height = LETTER_FONT_PX * 1.5;
  const context = canvas.getContext('2d');
  context.font = `bold ${LETTER_FONT_PX}px DogicaPixel, monospace`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = LETTER_SHADOW;
  context.shadowBlur = 8;
  context.fillStyle = LETTER_COLOR;
  context.fillText(letter, canvas.width / 2, canvas.height / 2);

  const texture = pixelTexture(canvas);
  letterTextures.set(letter, texture);
  return texture;
}

export function disposeLetterTextures(): void {
  letterTextures.forEach(texture => texture.dispose());
  letterTextures.clear();
}
