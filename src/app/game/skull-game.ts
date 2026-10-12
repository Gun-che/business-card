import { Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Scene, Texture } from 'three';
import { createBossTexture, createSkullTextures, disposeLetterTextures, letterTexture, SkullTexture } from './textures';
import { BOSS_DURATION, BOSS_HINT, BOSS_LEVEL, GAME_LETTERS, Hint, hintForHits, LEVELS } from './levels';
import { Boss } from './boss';
import { ParticleSystem } from './particles';

export interface SkullGameHost {
  scene: Scene;
  getAspect: () => number;
  // Точка схода туннеля на экране (NDC) — откуда вылетают черепа
  getTunnelCenter: () => { x: number, y: number };
  addFrameCallback: (callback: (dt: number, time: number) => void) => () => void;
  // Состояние для интерфейса: уровень, секунды до конца уровня, подсказка
  onStatus: (level: number, timeLeft: number, hint: Hint) => void;
  // Череп долетел до камеры
  onDeath: () => void;
  // Босс повержен
  onWin: () => void;
  // Звуки: попадание и уничтожение черепа (смерть и победа — через onDeath/onWin)
  onHit: () => void;
  onExplode: () => void;
  // Глитч-волна из точки (NDC), сильная вспышка на весь экран и вспышка заданной силы
  glitchWave: (x: number, y: number) => void;
  glitchStrong: () => void;
  glitch: (strength: number) => void;
  // Скорость полёта по туннелю (1 — как вне игры)
  setTravelSpeed: (speed: number) => void;
  // Во сколько раз чаще появляются черепа и во сколько раз больше их одновременно (на тач-устройствах тапать легче — 2)
  spawnMultiplier: number;
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
  // Точка появления — не ровно центр, а случайная точка центральной области
  originX: number;
  originY: number;
  hitsLeft: number;
  // Во сколько раз спрайт больше базового (рогатый череп нарисован на большей сетке)
  spriteScale: number;
  // Кадры анимации и фаза, чтобы черепа шевелились не синхронно
  frames: Texture[];
  framePhase: number;
  // Фазы покачивания черепа и буквы — разные, чтобы качались в рассинхрон
  bobPhase: number;
  letterBobPhase: number;
  // Глитч спрайта: когда следующий, сколько кадров осталось, текущий сдвиг
  nextGlitchAt: number;
  glitchFrames: number;
  glitchOffset: number;
  // Дрожание после попадания, с
  shakeTime: number;
  // Текущие экранные координаты и размер — для попадания тапом
  x: number;
  y: number;
  size: number;
}

// Размеры в долях высоты экрана (NDC: высота экрана = 2)
const SKULL_SIZE_FAR = 0.04;
const SKULL_SIZE_NEAR = 0.9;
const LETTER_SIZE_RATIO = 0.45;
// Насколько черепа разлетаются от центра к краям экрана
const SPREAD = 0.9;
// Разброс точки появления вокруг дальней точки туннеля (NDC)
const SPAWN_SPREAD = 0.12;
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
// Дрожание после попадания: длительность и амплитуда в долях размера
const SHAKE_TIME = 0.25;
const SHAKE_AMPLITUDE = 0.12;
// Брызги: количество и разлёт при взрыве; при обычном попадании разлёт тот же, частиц меньше
const EXPLODE_COUNT = 70;
const EXPLODE_SPEED = 4.8;
const SPLASH_RATIO = 0.6;
const PARTICLE_SIZE = 0.24;
// Капли на мониторе: если череп взорвался ближе этой доли пути, сколько капель и их размер (доля высоты экрана)
const SPLAT_PROGRESS = 0.5;
const SPLAT_COUNT_MIN = 5;
const SPLAT_COUNT_MAX = 10;
const SPLAT_SIZE = 0.06;
// Кровь на экране смерти: сколько капель сразу и сколько добавляется в секунду, до предела
const BLOOD_INITIAL = 60;
const BLOOD_PER_SECOND = 12;
const BLOOD_MAX = 160;
// Плавное появление черепа, с
const FADE_IN_TIME = 0.5;
// Длительность кадра анимации черепа, с
const FRAME_TIME = 0.35;
// Смена уровня: сила вспышки глитча; разгон туннеля за уровень
const LEVEL_GLITCH = 0.7;
const TRAVEL_SPEED_PER_LEVEL = 0.18;
// Минимальная зона тапа по черепу, px
const MIN_TAP_RADIUS_PX = 44;
// Слой над шейдерным фоном
const RENDER_ORDER = 10;

export class SkullGame {
  private readonly root = new Group();
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly skullTextures: SkullTexture[] = createSkullTextures();
  private readonly bossTexture: SkullTexture = createBossTexture();
  private readonly skulls: Skull[] = [];
  private readonly particles: ParticleSystem;
  private boss: Boss | null = null;
  // После смерти всё замирает, живут только брызги
  private frozen = false;
  private bloodCount = 0;
  private bloodAccumulator = 0;
  private levelIndex = 0;
  private levelTime = 0;
  private sinceSpawn = 0;
  private lastReportedSecond = -1;
  private time = 0;
  private removeFrameCallback: () => void = () => {};

  constructor(private readonly host: SkullGameHost) {
    this.root.position.z = -1;
    host.scene.add(this.root);
    this.particles = new ParticleSystem(host.scene, this.root);
  }

  // Нажата буква
  public hitLetter(letter: string): void {
    if (this.frozen) {
      return;
    }
    if (this.boss) {
      this.boss.pressLetter(letter);
      return;
    }
    const index = this.skulls.findIndex(skull => skull.letter === letter);
    if (index >= 0) {
      this.hitSkull(index);
    }
  }

  // Тап/клик в точке экрана (NDC). viewportHeight — высота в px, для минимальной зоны тапа
  public hitAt(x: number, y: number, viewportHeight: number): boolean {
    if (this.frozen) {
      return false;
    }
    const aspect = this.host.getAspect();
    const minRadius = MIN_TAP_RADIUS_PX / viewportHeight * 2;
    if (this.boss) {
      return this.boss.pressAt(x, y, aspect, minRadius);
    }
    let best = -1;
    // Из попавших в зону берём ближний к камере
    this.skulls.forEach((skull, index) => {
      const radius = Math.max(skull.size * 0.6, minRadius);
      const dx = (x - skull.x) * aspect;
      const dy = y - skull.y;
      if (dx * dx + dy * dy <= radius * radius && (best < 0 || skull.progress > this.skulls[best].progress)) {
        best = index;
      }
    });
    if (best < 0) {
      return false;
    }
    this.hitSkull(best);
    return true;
  }

  private hitSkull(index: number): void {
    const skull = this.skulls[index];
    skull.hitsLeft--;
    // Волна глитча и звук — при каждом попадании
    this.host.glitchWave(skull.x, skull.y);
    this.host.onHit();
    if (skull.hitsLeft > 0) {
      skull.shakeTime = SHAKE_TIME;
      this.particles.burst(skull.x, skull.y, EXPLODE_COUNT * SPLASH_RATIO, EXPLODE_SPEED * skull.size, PARTICLE_SIZE * skull.size);
      return;
    }
    this.particles.burst(skull.x, skull.y, EXPLODE_COUNT, EXPLODE_SPEED * skull.size, PARTICLE_SIZE * skull.size);
    this.host.onExplode();
    if (skull.progress >= SPLAT_PROGRESS) {
      const count = SPLAT_COUNT_MIN + Math.floor(Math.random() * (SPLAT_COUNT_MAX - SPLAT_COUNT_MIN + 1));
      this.particles.splat(count, SPLAT_SIZE, this.host.getAspect());
    }
    this.removeSkull(index);
    // Экран не должен пустовать: если черепов не осталось, следующий вылетает сразу
    if (this.skulls.length === 0) {
      this.sinceSpawn = Infinity;
    }
  }

  // startLevel — с какого уровня начать (отладка: ?level=N)
  public start(startLevel: number = 1): void {
    this.reset();
    const level = Math.min(Math.max(1, Math.floor(startLevel)), BOSS_LEVEL);
    if (level === BOSS_LEVEL) {
      this.levelIndex = LEVELS.length - 1;
      this.startBoss();
    } else {
      this.levelIndex = level - 1;
      this.host.setTravelSpeed(1 + this.levelIndex * TRAVEL_SPEED_PER_LEVEL);
    }
    this.removeFrameCallback();
    this.removeFrameCallback = this.host.addFrameCallback((dt, time) => this.update(dt, time));
    this.reportStatus();
  }

  public dispose(): void {
    this.removeFrameCallback();
    this.clearSkulls();
    this.clearBoss();
    this.particles.dispose();
    this.host.scene.remove(this.root);
    this.geometry.dispose();
    this.skullTextures.forEach(({ frames }) => frames.forEach(texture => texture.dispose()));
    this.bossTexture.frames.forEach(texture => texture.dispose());
    disposeLetterTextures();
  }

  private reset(): void {
    this.clearSkulls();
    this.clearBoss();
    this.particles.clear();
    this.frozen = false;
    this.host.setTravelSpeed(1);
    this.bloodCount = 0;
    this.bloodAccumulator = 0;
    this.levelIndex = 0;
    this.levelTime = 0;
    // Первый череп появляется сразу
    this.sinceSpawn = Infinity;
    this.lastReportedSecond = -1;
  }

  private update(dt: number, time: number): void {
    this.time = time;
    const aspect = this.host.getAspect();
    this.particles.update(dt, aspect);
    if (this.frozen) {
      // На экранах смерти и победы кровь понемногу продолжает появляться
      this.bloodAccumulator += dt * BLOOD_PER_SECOND;
      const add = Math.min(Math.floor(this.bloodAccumulator), BLOOD_MAX - this.bloodCount);
      if (add > 0) {
        this.particles.blood(add, aspect);
        this.bloodCount += add;
        this.bloodAccumulator -= add;
      }
      return;
    }
    if (this.boss) {
      this.updateBoss(dt, time, aspect);
      return;
    }

    this.levelTime += dt;
    const duration = LEVELS[this.levelIndex].duration;
    if (this.levelTime >= duration) {
      this.levelTime -= duration;
      if (this.levelIndex === LEVELS.length - 1) {
        this.startBoss();
        return;
      }
      this.levelIndex++;
      // Пауз нет — смену уровня отмечает вспышка и разгон туннеля
      this.host.glitch(LEVEL_GLITCH);
      this.host.setTravelSpeed(1 + this.levelIndex * TRAVEL_SPEED_PER_LEVEL);
    }

    // Параметры берём после возможной смены уровня, чтобы на её кадре не спавнить по старым
    const level = LEVELS[this.levelIndex];
    this.sinceSpawn += dt;
    const multiplier = this.host.spawnMultiplier;
    if (this.sinceSpawn >= level.spawnInterval / multiplier && this.skulls.length < level.maxActive * multiplier) {
      this.spawn(level.flightTime, level.hits);
      this.sinceSpawn = 0;
    }

    for (let i = this.skulls.length - 1; i >= 0; i--) {
      const skull = this.skulls[i];
      skull.progress += dt / skull.flightTime;
      skull.shakeTime = Math.max(0, skull.shakeTime - dt);
      if (skull.progress >= 1) {
        this.die();
        return;
      }
      this.placeSkull(skull, aspect);
    }

    this.reportStatus();
  }

  private startBoss(): void {
    // Оставшиеся черепа взрываются — сцена очищается под босса
    while (this.skulls.length > 0) {
      const skull = this.skulls[this.skulls.length - 1];
      this.particles.burst(skull.x, skull.y, EXPLODE_COUNT, EXPLODE_SPEED * skull.size, PARTICLE_SIZE * skull.size);
      this.removeSkull(this.skulls.length - 1);
    }
    this.levelIndex = BOSS_LEVEL - 1;
    this.host.glitchStrong();
    this.host.setTravelSpeed(1 + this.levelIndex * TRAVEL_SPEED_PER_LEVEL);
    this.boss = new Boss(this.root, this.geometry, this.bossTexture, this.particles, this.host, BOSS_DURATION);
    this.lastReportedSecond = -1;
  }

  private updateBoss(dt: number, time: number, aspect: number): void {
    // Во время паузы перед боссом таймер уровня стоит
    if (!this.boss.inIntro) {
      this.levelTime += dt;
    }
    const state = this.boss.update(dt, time, aspect);
    if (state === 'failed') {
      this.die();
      return;
    }
    if (state === 'won') {
      this.frozen = true;
      this.host.onWin();
      return;
    }
    this.reportStatus();
  }

  private clearBoss(): void {
    this.boss?.dispose();
    this.boss = null;
  }

  private die(): void {
    this.frozen = true;
    // На экране смерти черепа не нужны, брызги дотлевают, экран заливает кровь
    this.skulls.forEach(skull => skull.group.visible = false);
    this.boss?.hide();
    this.particles.blood(BLOOD_INITIAL, this.host.getAspect());
    this.bloodCount = BLOOD_INITIAL;
    this.host.glitchStrong();
    this.host.onDeath();
  }

  private spawn(flightTime: number, hits: number): void {
    const used = new Set(this.skulls.map(skull => skull.letter));
    const free = Array.from(GAME_LETTERS).filter(letter => !used.has(letter));
    const letter = free[Math.floor(Math.random() * free.length)];

    const group = new Group();
    group.renderOrder = RENDER_ORDER;
    const { frames, scale } = this.skullTextures[Math.floor(Math.random() * this.skullTextures.length)];
    const skullMesh = this.sprite(frames[0], SKULL_OPACITY);
    // «Призрак» — розовая копия, видна только в кадры глитча со сдвигом
    const ghostMesh = this.sprite(frames[0], 0.5);
    (ghostMesh.material as MeshBasicMaterial).color = GHOST_COLOR;
    ghostMesh.visible = false;
    group.add(ghostMesh, skullMesh, this.sprite(letterTexture(letter), 1));
    this.root.add(group);

    const origin = this.host.getTunnelCenter();
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.55 + Math.random() * 0.45;
    this.skulls.push({
      letter,
      group,
      progress: 0,
      flightTime,
      directionX: Math.cos(angle) * radius,
      directionY: Math.sin(angle) * radius,
      originX: origin.x + (Math.random() - 0.5) * 2 * SPAWN_SPREAD,
      originY: origin.y + (Math.random() - 0.5) * 2 * SPAWN_SPREAD,
      hitsLeft: hits,
      spriteScale: scale,
      frames,
      framePhase: Math.random() * FRAME_TIME * 2,
      bobPhase: Math.random() * Math.PI * 2,
      letterBobPhase: Math.random() * Math.PI * 2,
      nextGlitchAt: this.time + this.randomGlitchDelay(),
      glitchFrames: 0,
      glitchOffset: 0,
      shakeTime: 0,
      x: 0,
      y: 0,
      size: SKULL_SIZE_FAR
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
    // Точка появления влияет на старте и сходит на нет по мере приближения
    const originWeight = 1 - p;
    skull.x = skull.originX * originWeight + skull.directionX * spread;
    skull.y = skull.originY * originWeight + skull.directionY * spread;
    skull.size = size;
    // Дрожание после попадания — случайный сдвиг, затухающий к концу
    const shake = skull.shakeTime / SHAKE_TIME * SHAKE_AMPLITUDE * size;
    const shakeX = (Math.random() - 0.5) * 2 * shake / aspect;
    const shakeY = (Math.random() - 0.5) * 2 * shake;
    group.position.set(skull.x + shakeX, skull.y + shakeY, 0);

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
    // Кадр анимации
    const frame = skull.frames[Math.floor((this.time + skull.framePhase) / FRAME_TIME) % skull.frames.length];
    (skullMesh.material as MeshBasicMaterial).map = frame;
    (ghostMesh.material as MeshBasicMaterial).map = frame;
    // Плавное появление
    const fade = Math.min(1, skull.progress * skull.flightTime / FADE_IN_TIME);
    (skullMesh.material as MeshBasicMaterial).opacity = SKULL_OPACITY * fade;
    (ghostMesh.material as MeshBasicMaterial).opacity = 0.5 * fade;
    (letterMesh.material as MeshBasicMaterial).opacity = fade;
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
    const duration = this.boss ? BOSS_DURATION : LEVELS[this.levelIndex].duration;
    const timeLeft = Math.max(0, Math.ceil(duration - this.levelTime));
    if (timeLeft === this.lastReportedSecond) {
      return;
    }
    this.lastReportedSecond = timeLeft;
    const hint = this.boss ? BOSS_HINT : hintForHits(LEVELS[this.levelIndex].hits);
    this.host.onStatus(this.levelIndex + 1, timeLeft, hint);
  }
}
