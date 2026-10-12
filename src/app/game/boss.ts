import { Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Texture } from 'three';
import { SkullTexture, textTexture } from './textures';
import { ParticleSystem } from './particles';

export interface BossHost {
  glitchWave: (x: number, y: number) => void;
  glitchStrong: () => void;
}

export type BossState = 'alive' | 'failed' | 'won';

// Размеры в долях высоты экрана (NDC: высота экрана = 2)
const BOSS_SIZE = 1.4;
const BOSS_OPACITY = 0.72;
// Покачивание босса
const HOVER_AMPLITUDE = 0.04;
const HOVER_SPEED = 1.3;
// Кадры анимации
const FRAME_TIME = 0.4;
// Дрожание при нажатии
const SHAKE_TIME = 0.15;
const SHAKE_AMPLITUDE = 0.05;
// Брызги при нажатии и при финальном взрыве
const HIT_PARTICLES = 24;
const HIT_SPEED = 3.0;
const HIT_PARTICLE_SIZE = 0.09;
const EXPLODE_PARTICLES = 220;
const EXPLODE_SPEED = 4.5;
const EXPLODE_PARTICLE_SIZE = 0.16;
const EXPLODE_SPLATS = 12;
const EXPLODE_SPLAT_SIZE = 0.08;
// Буквы: позиции по кругу, сколько горит, сколько нажатий, пауза между буквами
export const BOSS_LETTER_TIME = 4;
export const BOSS_LETTER_HITS = 10;
const LETTER_POSITIONS = 8;
// Кольцо букв — эллипс вокруг босса: полуоси в долях высоты экрана, по X ограничено краем экрана
const LETTER_RING_RX = 1.05;
const LETTER_RING_RY = 0.62;
const LETTER_RING_MAX_X = 0.82;
const LETTER_SIZE = 0.26;
const LETTER_PULSE = 0.06;
const COUNTER_SIZE = 0.11;
const TIMER_WIDTH = 0.3;
const TIMER_HEIGHT = 0.025;
const LETTER_PAUSE = 0.3;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RENDER_ORDER = 10;
const TIMER_COLOR = new Color(0x3ed3ff);

interface LitLetter {
  letter: string;
  x: number;
  y: number;
  timeLeft: number;
  hits: number;
  group: Group;
  letterMesh: Mesh;
  counterMesh: Mesh;
  timerMesh: Mesh;
}

// Десятый уровень: большой череп, вокруг по очереди загораются буквы, каждую нужно нажать 10 раз
export class Boss {
  private readonly group = new Group();
  private readonly skullMesh: Mesh;
  private readonly frames: Texture[];
  private readonly spriteScale: number;
  private lit: LitLetter | null = null;
  private lastLetter = '';
  private lastPosition = -1;
  private pauseLeft = 0;
  private shakeTime = 0;
  private elapsed = 0;
  // Время вышло: новые буквы не загораются, победа — когда добита текущая
  private finishing = false;
  private state: BossState = 'alive';

  constructor(
    private readonly root: Group,
    private readonly geometry: PlaneGeometry,
    skull: SkullTexture,
    private readonly particles: ParticleSystem,
    private readonly host: BossHost,
    private readonly duration: number
  ) {
    this.frames = skull.frames;
    this.spriteScale = skull.scale;
    this.skullMesh = this.sprite(skull.frames[0], BOSS_OPACITY);
    this.group.add(this.skullMesh);
    root.add(this.group);
  }

  public get isAlive(): boolean {
    return this.state === 'alive';
  }

  public pressLetter(letter: string): boolean {
    if (this.state !== 'alive' || !this.lit || this.lit.letter !== letter) {
      return false;
    }
    this.press();
    return true;
  }

  // Тап по горящей букве (NDC). minRadius — минимальная зона тапа в NDC по высоте
  public pressAt(x: number, y: number, aspect: number, minRadius: number): boolean {
    if (this.state !== 'alive' || !this.lit) {
      return false;
    }
    const radius = Math.max(LETTER_SIZE * 0.7, minRadius);
    const dx = (x - this.lit.x) * aspect;
    const dy = y - this.lit.y;
    if (dx * dx + dy * dy > radius * radius) {
      return false;
    }
    this.press();
    return true;
  }

  public update(dt: number, time: number, aspect: number): BossState {
    if (this.state !== 'alive') {
      return this.state;
    }

    this.elapsed += dt;
    if (this.elapsed >= this.duration && !this.finishing) {
      this.finishing = true;
      if (!this.lit) {
        this.explode();
        return this.state;
      }
    }

    this.placeSkull(time, aspect);
    this.shakeTime = Math.max(0, this.shakeTime - dt);

    if (this.lit) {
      this.lit.timeLeft -= dt;
      if (this.lit.timeLeft <= 0) {
        // Не успели набрать 10 нажатий — смерть
        this.state = 'failed';
        return this.state;
      }
      this.placeLetter(time, aspect);
    } else {
      this.pauseLeft -= dt;
      if (this.pauseLeft <= 0) {
        this.lightLetter(aspect);
      }
    }
    return this.state;
  }

  public hide(): void {
    this.group.visible = false;
    this.clearLetter();
  }

  public dispose(): void {
    this.clearLetter();
    this.root.remove(this.group);
    (this.skullMesh.material as MeshBasicMaterial).dispose();
  }

  private press(): void {
    const lit = this.lit;
    lit.hits++;
    this.shakeTime = SHAKE_TIME;
    this.host.glitchWave(lit.x, lit.y);
    // Брызги из случайной точки на черепе
    const px = (Math.random() - 0.5) * BOSS_SIZE * 0.5 / this.aspectOf(this.skullMesh);
    const py = (Math.random() - 0.5) * BOSS_SIZE * 0.5;
    this.particles.burst(px, py, HIT_PARTICLES, HIT_SPEED, HIT_PARTICLE_SIZE);
    this.updateCounter(lit);

    if (lit.hits >= BOSS_LETTER_HITS) {
      this.clearLetter();
      if (this.finishing) {
        this.explode();
        return;
      }
      this.pauseLeft = LETTER_PAUSE;
    }
  }

  private explode(): void {
    this.state = 'won';
    this.hide();
    this.particles.burst(0, 0, EXPLODE_PARTICLES, EXPLODE_SPEED, EXPLODE_PARTICLE_SIZE);
    this.particles.splat(EXPLODE_SPLATS, EXPLODE_SPLAT_SIZE, this.aspectOf(this.skullMesh));
    this.host.glitchStrong();
  }

  private lightLetter(aspect: number): void {
    // Буква не повторяет предыдущую, позиция — тоже
    let letter = this.lastLetter;
    while (letter === this.lastLetter) {
      letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    }
    let position = this.lastPosition;
    while (position === this.lastPosition) {
      position = Math.floor(Math.random() * LETTER_POSITIONS);
    }
    this.lastLetter = letter;
    this.lastPosition = position;

    const angle = position / LETTER_POSITIONS * Math.PI * 2 + Math.PI / LETTER_POSITIONS;
    const x = Math.cos(angle) * Math.min(LETTER_RING_RX / aspect, LETTER_RING_MAX_X);
    const y = Math.sin(angle) * LETTER_RING_RY;

    const group = new Group();
    const letterMesh = this.sprite(textTexture(letter), 1);
    const counterMesh = this.sprite(textTexture(`0/${BOSS_LETTER_HITS}`), 1);
    const timerMesh = new Mesh(this.geometry, new MeshBasicMaterial({ color: TIMER_COLOR, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
    timerMesh.renderOrder = RENDER_ORDER;
    group.add(letterMesh, counterMesh, timerMesh);
    group.position.set(x, y, 0);
    this.root.add(group);

    this.lit = { letter, x, y, timeLeft: BOSS_LETTER_TIME, hits: 0, group, letterMesh, counterMesh, timerMesh };
    this.placeLetter(0, aspect);
  }

  private clearLetter(): void {
    if (!this.lit) {
      return;
    }
    this.root.remove(this.lit.group);
    this.lit.group.children.forEach(child => ((child as Mesh).material as MeshBasicMaterial).dispose());
    this.lit = null;
  }

  private updateCounter(lit: LitLetter): void {
    (lit.counterMesh.material as MeshBasicMaterial).map = textTexture(`${lit.hits}/${BOSS_LETTER_HITS}`);
  }

  private placeLetter(time: number, aspect: number): void {
    const lit = this.lit;
    const pulse = 1 + Math.sin(time * 9) * LETTER_PULSE;
    const size = LETTER_SIZE * pulse;
    lit.letterMesh.scale.set(size / aspect, size, 1);
    // Текстура счётчика шире буквы — масштабируем по её пропорции
    const counter = (lit.counterMesh.material as MeshBasicMaterial).map.image as HTMLCanvasElement;
    const counterAspect = counter.width / counter.height;
    lit.counterMesh.scale.set(COUNTER_SIZE * counterAspect / aspect, COUNTER_SIZE, 1);
    // В нижней половине экрана счётчик и таймер над буквой, чтобы не уходили за край
    const below = lit.y >= 0 ? -1 : 1;
    lit.counterMesh.position.set(0, below * (LETTER_SIZE + COUNTER_SIZE) * 0.6, 0);
    // Полоска времени тает слева направо
    const remaining = lit.timeLeft / BOSS_LETTER_TIME;
    lit.timerMesh.scale.set(TIMER_WIDTH * remaining / aspect, TIMER_HEIGHT, 1);
    lit.timerMesh.position.set(-TIMER_WIDTH * (1 - remaining) / 2 / aspect, below * ((LETTER_SIZE + COUNTER_SIZE) * 0.6 + COUNTER_SIZE), 0);
  }

  private placeSkull(time: number, aspect: number): void {
    const frame = this.frames[Math.floor(time / FRAME_TIME) % this.frames.length];
    (this.skullMesh.material as MeshBasicMaterial).map = frame;
    const size = BOSS_SIZE * this.spriteScale;
    this.skullMesh.scale.set(size / aspect, size, 1);
    const hover = Math.sin(time * HOVER_SPEED) * HOVER_AMPLITUDE;
    const shake = this.shakeTime / SHAKE_TIME * SHAKE_AMPLITUDE;
    this.skullMesh.position.set((Math.random() - 0.5) * 2 * shake / aspect, hover + (Math.random() - 0.5) * 2 * shake, 0);
  }

  private sprite(texture: Texture, opacity: number): Mesh {
    const material = new MeshBasicMaterial({ map: texture, transparent: true, opacity, depthTest: false, depthWrite: false });
    const mesh = new Mesh(this.geometry, material);
    mesh.renderOrder = RENDER_ORDER;
    return mesh;
  }

  // Соотношение сторон экрана по текущему масштабу спрайта: scale.y / scale.x
  private aspectOf(mesh: Mesh): number {
    return mesh.scale.x > 0 ? mesh.scale.y / mesh.scale.x : 1;
  }
}
