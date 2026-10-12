export interface LevelConfig {
  // Попаданий, чтобы уничтожить череп
  hits: number;
  // Время полёта от горизонта до камеры, с
  flightTime: number;
  // Интервал между появлениями черепов, с
  spawnInterval: number;
  // Максимум черепов одновременно
  maxActive: number;
}

// TODO: вернуть 30 после тестов
export const LEVEL_DURATION = 5;
export const BOSS_LEVEL = 10;

// Уровни 1–9 (индекс 0–8); ориентир из ТЗ, крутим после первой играбельной версии
export const LEVELS: LevelConfig[] = [
  { hits: 1, flightTime: 6.0, spawnInterval: 3.0, maxActive: 1 },
  { hits: 1, flightTime: 5.5, spawnInterval: 2.6, maxActive: 2 },
  { hits: 1, flightTime: 5.0, spawnInterval: 2.3, maxActive: 2 },
  { hits: 2, flightTime: 4.6, spawnInterval: 2.0, maxActive: 3 },
  { hits: 2, flightTime: 4.2, spawnInterval: 1.8, maxActive: 3 },
  { hits: 2, flightTime: 3.8, spawnInterval: 1.6, maxActive: 4 },
  { hits: 3, flightTime: 3.4, spawnInterval: 1.4, maxActive: 4 },
  { hits: 3, flightTime: 3.0, spawnInterval: 1.2, maxActive: 5 },
  { hits: 3, flightTime: 2.6, spawnInterval: 1.0, maxActive: 5 }
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
