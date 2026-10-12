import { Color, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Scene } from 'three';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 512;
// Торможение брызг за секунду и время жизни
const DRAG = 2.5;
const LIFE_MIN = 0.4;
const LIFE_MAX = 0.8;
// Доля «дальних» частиц: вылетают за пределы основного круга, быстрее и живут дольше
const FAR_RATIO = 0.12;
const FAR_SPEED = 2.5;
const FAR_LIFE = 1.4;
// Несколько оттенков красного, чтобы брызги не были одноцветными
const PARTICLE_COLORS = [0xff2040, 0xff4a6a, 0xd0102c, 0xff7080, 0xc8203a].map(hex => new Color(hex));
const PARTICLE_OPACITY = 0.55;
// Капли на «мониторе»: висят, потом гаснут
const SPLAT_OPACITY = 0.6;
const SPLAT_LIFE_MIN = 1.0;
const SPLAT_LIFE_MAX = 2.0;
const SPLAT_FADE = 0.5;
const SPLAT_RENDER_ORDER = 12;

interface Splat {
  mesh: Mesh;
  life: number;
}

// Капли крови на экране смерти: медленно стекают и вытягиваются, живут до очистки
interface Drip {
  mesh: Mesh;
  speed: number;
  stretch: number;
  baseSize: number;
}

const DRIP_OPACITY = 0.7;
const DRIP_SIZE_MIN = 0.02;
const DRIP_SIZE_MAX = 0.07;
// Скорость стекания, долей высоты экрана в секунду, и до скольки раз вытягивается
const DRIP_SPEED_MIN = 0.01;
const DRIP_SPEED_MAX = 0.06;
const DRIP_STRETCH_MAX = 4;
const DRIP_STRETCH_RATE = 0.4;
const RENDER_ORDER = 11;

// Красные пиксельные брызги: один InstancedMesh на все частицы
export class ParticleSystem {
  private readonly mesh: InstancedMesh;
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly material = new MeshBasicMaterial({ transparent: true, opacity: PARTICLE_OPACITY, depthTest: false, depthWrite: false });
  private readonly particles: Particle[] = [];
  private readonly splats: Splat[] = [];
  private readonly drips: Drip[] = [];
  private readonly parent: Group;
  private readonly dummy = new Object3D();
  private readonly hidden = new Matrix4().makeScale(0, 0, 0);
  private readonly swapColor = new Color();

  constructor(private readonly scene: Scene, parent: Group) {
    this.parent = parent;
    this.mesh = new InstancedMesh(this.geometry, this.material, MAX_PARTICLES);
    this.mesh.renderOrder = RENDER_ORDER;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    // Инициализируем буфер цветов, иначе instanceColor не создаётся
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.mesh.setColorAt(i, PARTICLE_COLORS[0]);
    }
    parent.add(this.mesh);
  }

  /**
   * Взрыв брызг из точки (NDC). speed — разлёт в долях высоты экрана в секунду,
   * size — размер квадратика в долях высоты экрана
   */
  public burst(x: number, y: number, count: number, speed: number, size: number): void {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Скорость разная: основная масса — круг, несколько частиц улетают далеко
      const far = Math.random() < FAR_RATIO;
      const velocity = speed * (0.2 + Math.random() * 0.8) * (far ? FAR_SPEED : 1);
      const maxLife = (LIFE_MIN + Math.random() * (LIFE_MAX - LIFE_MIN)) * (far ? FAR_LIFE : 1);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        size: size * (0.5 + Math.random()),
        life: maxLife,
        maxLife
      });
      this.mesh.setColorAt(this.particles.length - 1, PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)]);
    }
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  // Капли, «попавшие на монитор»: разного размера, в случайных местах ближе к краям экрана, не двигаются
  public splat(count: number, size: number, aspect: number): void {
    for (let i = 0; i < count; i++) {
      const material = new MeshBasicMaterial({
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        transparent: true,
        opacity: SPLAT_OPACITY,
        depthTest: false,
        depthWrite: false
      });
      const mesh = new Mesh(this.geometry, material);
      mesh.renderOrder = SPLAT_RENDER_ORDER;
      const scale = size * (0.8 + Math.random() * 1.6);
      mesh.scale.set(scale / aspect, scale, 1);
      // Случайная точка, смещённая к краям: радиус от центра 0.55..1 в NDC
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.55 + Math.random() * 0.45;
      mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      this.parent.add(mesh);
      this.splats.push({ mesh, life: SPLAT_LIFE_MIN + Math.random() * (SPLAT_LIFE_MAX - SPLAT_LIFE_MIN) });
    }
  }

  // Капли крови: случайные места, больше у краёв экрана
  public blood(count: number, aspect: number): void {
    for (let i = 0; i < count; i++) {
      const material = new MeshBasicMaterial({
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        transparent: true,
        opacity: DRIP_OPACITY * (0.6 + Math.random() * 0.4),
        depthTest: false,
        depthWrite: false
      });
      const mesh = new Mesh(this.geometry, material);
      mesh.renderOrder = SPLAT_RENDER_ORDER;
      const baseSize = DRIP_SIZE_MIN + Math.random() * (DRIP_SIZE_MAX - DRIP_SIZE_MIN);
      mesh.scale.set(baseSize / aspect, baseSize, 1);
      // Квадратный корень смещает распределение к краям
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.3 + 0.85 * Math.sqrt(Math.random());
      mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
      this.parent.add(mesh);
      this.drips.push({
        mesh,
        baseSize,
        speed: DRIP_SPEED_MIN + Math.random() * (DRIP_SPEED_MAX - DRIP_SPEED_MIN),
        stretch: 1
      });
    }
  }

  public update(dt: number, aspect: number): void {
    this.updateSplats(dt);
    this.updateDrips(dt, aspect);
    const drag = Math.max(0, 1 - DRAG * dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        // Переносим последнюю частицу на место умершей вместе с её цветом
        const last = this.particles.length - 1;
        this.particles[i] = this.particles[last];
        this.mesh.getColorAt(last, this.swapColor);
        this.mesh.setColorAt(i, this.swapColor);
        this.particles.pop();
        continue;
      }
      particle.vx *= drag;
      particle.vy *= drag;
      particle.x += particle.vx * dt / aspect;
      particle.y += particle.vy * dt;
    }

    this.particles.forEach((particle, i) => {
      // Квадратик уменьшается к концу жизни
      const scale = particle.size * Math.min(1, particle.life / particle.maxLife * 2);
      this.dummy.position.set(particle.x, particle.y, 0);
      this.dummy.scale.set(scale / aspect, scale, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    for (let i = this.particles.length; i < this.mesh.count; i++) {
      this.mesh.setMatrixAt(i, this.hidden);
    }
    this.mesh.count = Math.max(this.mesh.count, this.particles.length);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  private updateSplats(dt: number): void {
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const splat = this.splats[i];
      splat.life -= dt;
      if (splat.life <= 0) {
        this.removeSplat(i);
        continue;
      }
      // Гаснет в последние полсекунды
      (splat.mesh.material as MeshBasicMaterial).opacity = SPLAT_OPACITY * Math.min(1, splat.life / SPLAT_FADE);
    }
  }

  private updateDrips(dt: number, aspect: number): void {
    this.drips.forEach(drip => {
      drip.mesh.position.y -= drip.speed * dt;
      drip.stretch = Math.min(DRIP_STRETCH_MAX, drip.stretch + DRIP_STRETCH_RATE * dt);
      // Вытягивается вниз: растёт по высоте, верх остаётся на месте
      drip.mesh.scale.set(drip.baseSize / aspect, drip.baseSize * drip.stretch, 1);
    });
  }

  private removeSplat(index: number): void {
    const [splat] = this.splats.splice(index, 1);
    this.parent.remove(splat.mesh);
    (splat.mesh.material as MeshBasicMaterial).dispose();
  }

  public clear(): void {
    this.particles.length = 0;
    this.mesh.count = 0;
    while (this.splats.length > 0) {
      this.removeSplat(this.splats.length - 1);
    }
    this.drips.forEach(drip => {
      this.parent.remove(drip.mesh);
      (drip.mesh.material as MeshBasicMaterial).dispose();
    });
    this.drips.length = 0;
  }

  public dispose(): void {
    this.clear();
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
