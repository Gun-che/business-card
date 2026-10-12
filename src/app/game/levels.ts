export interface LevelConfig {
  // Длительность уровня, с
  duration: number;
  // Попаданий, чтобы уничтожить череп
  hits: number;
  // Время полёта от горизонта до камеры, с
  flightTime: number;
  // Интервал между появлениями черепов, с
  spawnInterval: number;
  // Максимум черепов одновременно
  maxActive: number;
}

// Длительность уровня с боссом, с
export const BOSS_DURATION = 30;

// Буквы, которые загораются на черепах и у босса. M и N убраны: в пиксельном шрифте DogicaPixel их трудно различить
export const GAME_LETTERS = 'ABCDEFGHIJKLOPQRSTUVWXYZ';
export const BOSS_LEVEL = 10;

// Уровни 1–9 (индекс 0–8). Первые три — разминка, поэтому короче; девятый лишь немного сложнее восьмого
export const LEVELS: LevelConfig[] = [
  { duration: 20, hits: 1, flightTime: 6.0, spawnInterval: 3.0, maxActive: 1 },
  { duration: 20, hits: 1, flightTime: 5.5, spawnInterval: 2.6, maxActive: 2 },
  { duration: 20, hits: 1, flightTime: 5.0, spawnInterval: 2.3, maxActive: 2 },
  { duration: 30, hits: 2, flightTime: 4.6, spawnInterval: 2.0, maxActive: 3 },
  { duration: 30, hits: 2, flightTime: 4.2, spawnInterval: 1.8, maxActive: 3 },
  { duration: 30, hits: 2, flightTime: 3.8, spawnInterval: 1.6, maxActive: 4 },
  { duration: 30, hits: 3, flightTime: 3.4, spawnInterval: 1.4, maxActive: 4 },
  { duration: 30, hits: 3, flightTime: 3.0, spawnInterval: 1.2, maxActive: 5 },
  { duration: 30, hits: 3, flightTime: 2.8, spawnInterval: 1.1, maxActive: 5 }
];

// Подсказка: обычный текст и акцентная часть, которая выделяется и «прыгает»
export interface Hint {
  text: string;
  accent: string;
}

export const BOSS_HINT: Hint = { text: 'Press the lit key', accent: '10 times' };

export function hintForHits(hits: number): Hint {
  switch (hits) {
    case 1:
      return { text: 'Press the key to destroy the enemy', accent: '' };
    case 2:
      return { text: 'Press the key', accent: 'twice' };
    default:
      return { text: 'Press the key', accent: 'three times' };
  }
}
