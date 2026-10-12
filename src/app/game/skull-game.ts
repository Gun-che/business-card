import { Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Scene, Texture } from 'three';
import { createSkullTextures, disposeLetterTextures, letterTexture, SkullTexture } from './textures';
import { Hint, hintForHits, LEVEL_DURATION, LEVELS } from './levels';

export interface SkullGameHost {
  scene: Scene;
  getAspect: () => number;
  addFrameCallback: (callback: (dt: number, time: number) => void) => () => void;
  // Состояние для интерфейса: уровень, секунды до конца уровня, подсказка
  onStatus: (level: number, timeLeft: number, hint: Hint) => void;
}

interface Skull {
  letter: string;
  group: Group;
  // Доля пути от горизонта до камеры, 0..1
  progress: number;
  flightTime: number;
  // Направление разлёта от центра туннеля в NDC
  directionX: number;
  directionY: number;
  hitsLeft: number;
  // Во сколько раз спрайт больше базового (рогатый череп нарисован на большей сетке)
  spriteScale: number;
  // Фазы покачивания черепа и буквы — разные, чтобы качались в рассинхрон
  bobPhase: number;
  letterBobPhase: number;
  // Глитч спрайта: когда следующий, сколько кадров осталось, текущий сдвиг
  nextGlitchAt: number;
  glitchFrames: number;
  glitchOffset: number;
}

// Размеры в долях высоты экрана (NDC: высота экрана = 2)
const SKULL_SIZE_FAR = 0.04;
const SKULL_SIZE_NEAR = 0.9;
const LETTER_SIZE_RATIO = 0.45;
// Насколько черепа разлетаются от центра к краям экрана
const SPREAD = 0.9;
// Прозрачность черепа — фон просвечивает
const SKULL_OPACITY = 0.72;
// Покачивание: амплитуда в долях размера, частоты в рад/с
const BOB_AMPLITUDE = 0.1;
const BOB_SPEED = 5.0;
const LETTER_BOB_SPEED = 7.0;
// Глитч спрайта: пауза между срабатываниями, длительность в кадрах, сдвиг в долях размера
const GLITCH_INTERVAL_MIN = 0.4;
const GLITCH_INTERVAL_MAX = 1.6;
const GLITCH_FRAMES = 3;
const GLITCH_SHIFT = 0.12;
const GHOST_COLOR = new Color(1.0, 0.3, 0.9);
// Слой над шейдерным фоном
const RENDER_ORDER = 10;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export class SkullGame {
  private readonly root = new Group();
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly skullTextures: SkullTexture[] = createSkullTextures();
  private readonly skulls: Skull[] = [];
  private levelIndex = 0;
  private levelTime = 0;
  private sinceSpawn = 0;
  private lastReportedSecond = -1;
  private time = 0;
  private removeFrameCallback: () => void = () => {};

  constructor(private readonly host: SkullGameHost) {
    this.root.position.z = -1;
    host.scene.add(this.root);
  }

  public start(): void {
    this.reset();
    this.removeFrameCallback = this.host.addFrameCallback((dt, time) => this.update(dt, time));
    this.reportStatus();
  }

  public dispose(): void {
    this.removeFrameCallback();
    this.clearSkulls();
    this.host.scene.remove(this.root);
    this.geometry.dispose();
    this.skullTextures.forEach(({ texture }) => texture.dispose());
    disposeLetterTextures();
  }

  private reset(): void {
    this.clearSkulls();
    this.levelIndex = 0;
    this.levelTime = 0;
    // Первый череп появляется сразу
    this.sinceSpawn = Infinity;
    this.lastReportedSecond = -1;
  }

  private update(dt: number, time: number): void {
    this.time = time;
    const level = LEVELS[this.levelIndex];

    this.levelTime += dt;
    if (this.levelTime >= LEVEL_DURATION && this.levelIndex < LEVELS.length - 1) {
      this.levelIndex++;
      this.levelTime -= LEVEL_DURATION;
    }

    this.sinceSpawn += dt;
    if (this.sinceSpawn >= level.spawnInterval && this.skulls.length < level.maxActive) {
      this.spawn(level.flightTime, level.hits);
      this.sinceSpawn = 0;
    }

    const aspect = this.host.getAspect();
    for (let i = this.skulls.length - 1; i >= 0; i--) {
      const skull = this.skulls[i];
      skull.progress += dt / skull.flightTime;
      if (skull.progress >= 1) {
        // Долетел до камеры — пока просто убираем; смерть игрока — на следующем этапе
        this.removeSkull(i);
        continue;
      }
      this.placeSkull(skull, aspect);
    }

    this.reportStatus();
  }

  private spawn(flightTime: number, hits: number): void {
    const used = new Set(this.skulls.map(skull => skull.letter));
    const free = Array.from(LETTERS).filter(letter => !used.has(letter));
    const letter = free[Math.floor(Math.random() * free.length)];

    const group = new Group();
    group.renderOrder = RENDER_ORDER;
    const { texture, scale } = this.skullTextures[Math.floor(Math.random() * this.skullTextures.length)];
    const skullMesh = this.sprite(texture, SKULL_OPACITY);
    // «Призрак» — розовая копия, видна только в кадры глитча со сдвигом
    const ghostMesh = this.sprite(texture, 0.5);
    (ghostMesh.material as MeshBasicMaterial).color = GHOST_COLOR;
    ghostMesh.visible = false;
    group.add(ghostMesh, skullMesh, this.sprite(letterTexture(letter), 1));
    this.root.add(group);

    const angle = Math.random() * Math.PI * 2;
    const radius = 0.55 + Math.random() * 0.45;
    this.skulls.push({
      letter,
      group,
      progress: 0,
      flightTime,
      directionX: Math.cos(angle) * radius,
      directionY: Math.sin(angle) * radius,
      hitsLeft: hits,
      spriteScale: scale,
      bobPhase: Math.random() * Math.PI * 2,
      letterBobPhase: Math.random() * Math.PI * 2,
      nextGlitchAt: this.time + this.randomGlitchDelay(),
      glitchFrames: 0,
      glitchOffset: 0
    });
  }

  private sprite(texture: Texture, opacity: number): Mesh {
    const material = new MeshBasicMaterial({ map: texture, transparent: true, opacity, depthTest: false, depthWrite: false });
    const mesh = new Mesh(this.geometry, material);
    mesh.renderOrder = RENDER_ORDER;
    return mesh;
  }

  private randomGlitchDelay(): number {
    return GLITCH_INTERVAL_MIN + Math.random() * (GLITCH_INTERVAL_MAX - GLITCH_INTERVAL_MIN);
  }

  private placeSkull(skull: Skull, aspect: number): void {
    const p = skull.progress;
    // Перспектива: размер растёт ускоренно, разлёт от центра — тоже
    const size = SKULL_SIZE_FAR + (SKULL_SIZE_NEAR - SKULL_SIZE_FAR) * Math.pow(p, 2.4);
    const spread = SPREAD * Math.pow(p, 1.6);

    const { group } = skull;
    group.position.set(skull.directionX * spread, skull.directionY * spread, 0);

    // Глитч спрайта: в случайный момент на несколько кадров череп дёргается в сторону,
    // а за ним проявляется розовый «призрак» со сдвигом в другую сторону
    if (skull.glitchFrames === 0 && this.time >= skull.nextGlitchAt) {
      skull.glitchFrames = GLITCH_FRAMES;
      skull.glitchOffset = (Math.random() - 0.5) * 2 * GLITCH_SHIFT;
      skull.nextGlitchAt = this.time + this.randomGlitchDelay();
    }
    const glitching = skull.glitchFrames > 0;
    if (glitching) {
      skull.glitchFrames--;
    }

    const [ghostMesh, skullMesh, letterMesh] = group.children as Mesh[];
    const bob = Math.sin(this.time * BOB_SPEED + skull.bobPhase) * BOB_AMPLITUDE * size;
    const letterBob = Math.sin(this.time * LETTER_BOB_SPEED + skull.letterBobPhase) * BOB_AMPLITUDE * size;

    const spriteSize = size * skull.spriteScale;
    skullMesh.scale.set(spriteSize / aspect, spriteSize, 1);
    skullMesh.position.set(glitching ? skull.glitchOffset * size / aspect : 0, bob, 0);

    ghostMesh.visible = glitching;
    ghostMesh.scale.copy(skullMesh.scale);
    ghostMesh.position.set(-skull.glitchOffset * size / aspect, bob, 0);

    const letterSize = size * LETTER_SIZE_RATIO;
    letterMesh.scale.set(letterSize / aspect, letterSize, 1);
    letterMesh.position.set(0, -(size + letterSize) * 0.55 + letterBob, 0);
  }

  private removeSkull(index: number): void {
    const [skull] = this.skulls.splice(index, 1);
    this.root.remove(skull.group);
    skull.group.children.forEach(child => ((child as Mesh).material as MeshBasicMaterial).dispose());
  }

  private clearSkulls(): void {
    while (this.skulls.length > 0) {
      this.removeSkull(this.skulls.length - 1);
    }
  }

  private reportStatus(): void {
    const timeLeft = Math.max(0, Math.ceil(LEVEL_DURATION - this.levelTime));
    if (timeLeft === this.lastReportedSecond) {
      return;
    }
    this.lastReportedSecond = timeLeft;
    this.host.onStatus(this.levelIndex + 1, timeLeft, hintForHits(LEVELS[this.levelIndex].hits));
  }
}
