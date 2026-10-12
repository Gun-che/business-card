import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Scene } from 'three';
import { createBossTexture, SkullTexture } from './textures';
import { ParticleSystem } from './particles';

export interface BossShowcaseHost {
  scene: Scene;
  getAspect: () => number;
  addFrameCallback: (callback: (dt: number, time: number) => void) => () => void;
  glitchStrong: () => void;
  glitchWave: (x: number, y: number) => void;
  onDone: () => void;
}

// Размер и тайминги: появление, показ, исчезновение
const SIZE = 1.6;
const OPACITY = 0.8;
const FADE_IN = 0.25;
const HOLD = 2.2;
const FADE_OUT = 0.7;
const FRAME_TIME = 0.35;
// Покачивание и дрожь
const BOB_AMPLITUDE = 0.05;
const BOB_SPEED = 2.5;
const JITTER = 0.012;
// Кровь: как часто и сколько брызг
const BLEED_INTERVAL = 0.08;
const BLEED_COUNT = 10;
const BLEED_SPEED = 3.2;
const BLEED_SIZE = 0.1;
// Глитч-волны от босса
const WAVE_INTERVAL = 0.3;
const RENDER_ORDER = 10;

// Клик по бейджу «Dungeon master»: босс на заднем плане за визиткой, хлещет кровь, идут глитч-волны
export class BossShowcase {
  private readonly root = new Group();
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly skull: SkullTexture = createBossTexture();
  private readonly mesh: Mesh;
  private readonly particles: ParticleSystem;
  private elapsed = 0;
  private sinceBleed = 0;
  private sinceWave = 0;
  private removeFrameCallback: () => void = () => {};

  constructor(private readonly host: BossShowcaseHost) {
    this.root.position.z = -1;
    host.scene.add(this.root);
    this.particles = new ParticleSystem(host.scene, this.root);
    this.mesh = new Mesh(this.geometry, new MeshBasicMaterial({ map: this.skull.frames[0], transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    this.mesh.renderOrder = RENDER_ORDER;
    this.root.add(this.mesh);
  }

  public start(): void {
    this.host.glitchStrong();
    this.removeFrameCallback = this.host.addFrameCallback((dt, time) => this.update(dt, time));
  }

  public dispose(): void {
    this.removeFrameCallback();
    this.particles.dispose();
    this.host.scene.remove(this.root);
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.geometry.dispose();
    this.skull.frames.forEach(texture => texture.dispose());
  }

  private update(dt: number, time: number): void {
    const aspect = this.host.getAspect();
    this.elapsed += dt;
    this.particles.update(dt, aspect);

    const total = FADE_IN + HOLD + FADE_OUT;
    if (this.elapsed >= total) {
      this.host.onDone();
      return;
    }

    // Прозрачность: появление → показ → исчезновение
    let fade = 1;
    if (this.elapsed < FADE_IN) {
      fade = this.elapsed / FADE_IN;
    } else if (this.elapsed > FADE_IN + HOLD) {
      fade = 1 - (this.elapsed - FADE_IN - HOLD) / FADE_OUT;
    }
    const material = this.mesh.material as MeshBasicMaterial;
    material.opacity = OPACITY * fade;
    material.map = this.skull.frames[Math.floor(time / FRAME_TIME) % this.skull.frames.length];

    const size = SIZE * this.skull.scale;
    this.mesh.scale.set(size / aspect, size, 1);
    // Покачивание вверх-вниз плюс мелкая дрожь
    const bob = Math.sin(time * BOB_SPEED) * BOB_AMPLITUDE;
    this.mesh.position.set((Math.random() - 0.5) * 2 * JITTER / aspect, bob + (Math.random() - 0.5) * 2 * JITTER, 0);

    if (this.elapsed >= FADE_IN + HOLD) {
      return;
    }

    // Кровь хлещет из случайных точек на черепе
    this.sinceBleed += dt;
    while (this.sinceBleed >= BLEED_INTERVAL) {
      this.sinceBleed -= BLEED_INTERVAL;
      const x = (Math.random() - 0.5) * SIZE * 0.6 / aspect;
      const y = bob + (Math.random() - 0.5) * SIZE * 0.6;
      this.particles.burst(x, y, BLEED_COUNT, BLEED_SPEED, BLEED_SIZE);
    }

    // Глитч-волны расходятся от босса
    this.sinceWave += dt;
    if (this.sinceWave >= WAVE_INTERVAL) {
      this.sinceWave = 0;
      this.host.glitchWave((Math.random() - 0.5) * SIZE * 0.5 / aspect, bob + (Math.random() - 0.5) * SIZE * 0.5);
    }
  }
}
