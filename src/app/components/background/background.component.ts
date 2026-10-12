import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, NgZone, signal, ViewChild } from '@angular/core';
import { Nullable } from 'src/app/types/nullable';
import { BackgroundScene } from 'src/app/three/scenes/background-scene.model';
import { GlitchService } from 'src/app/services/glitch.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { wordAtPoint } from 'src/app/utils/word-at-point';
import { GameService } from 'src/app/services/game.service';
import { SoundService } from 'src/app/services/sound.service';
import type { SkullGame } from 'src/app/game/skull-game';
import type { BossShowcase } from 'src/app/game/boss-showcase';
import { Vector2 } from 'three';


@Component({
  selector: 'background',
  standalone: true,
  imports: [],
  templateUrl: './background.component.html',
  styleUrl: './background.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BackgroundComponent implements AfterViewInit {
  private readonly ngZone: NgZone = inject(NgZone);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly glitchService: GlitchService = inject(GlitchService);
  private readonly gameService: GameService = inject(GameService);
  private readonly sound: SoundService = inject(SoundService);
  @ViewChild('background') public backgroundRef: Nullable<ElementRef<HTMLElement>>;
  private destroyed = false;

  // Режим примерки фонов: ?bg=<name>, переключение стрелками ← →
  public readonly previewScene = signal<Nullable<BackgroundScene>>(null);
  public switchScene: (step: number) => void = () => {};

  constructor() {
    this.destroyRef.onDestroy(() => this.destroyed = true);
  }

  public ngAfterViewInit() {
    // requestAnimationFrame и pointermove внутри зоны запускали бы change detection на каждый кадр
    this.ngZone.runOutsideAngular(() => this.initBackground());
  }

  private async initBackground() {
    // three.js — основная часть бандла: грузим отдельным чанком, чтобы не блокировать первую отрисовку
    const [{ drawBackground }, { backgroundScenes }] = await Promise.all([
      import('src/app/three/draw-background'),
      import('src/app/three/scenes')
    ]);
    if (this.destroyed) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const previewName = params.get('bg');
    // Отладка: с какого уровня начинать игру
    const startLevel = Number(params.get('level')) || 1;
    let index = Math.max(0, backgroundScenes.findIndex(scene => scene.name === previewName));

    const background = drawBackground({
      el: this.backgroundRef?.nativeElement,
      eventsEl: window.document.body,
      shaderPoints: 5,
      curvePoints: 40,
      curveLerp: 0.9,
      radius1: 10,
      radius2: 150,
      velocityTreshold: 200
    }, backgroundScenes[index]);
    const { dispose, switchScene, triggerStrongGlitch, triggerLocalGlitch, triggerGlitch, showWord } = background;

    this.destroyRef.onDestroy(dispose);
    this.glitchService.burst$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(triggerStrongGlitch);

    // Клик по тексту — слово проявляется на фоне в глитч-эффекте (вне игры)
    const onClick = (event: MouseEvent) => {
      if (this.gameService.phase() !== 'idle') {
        return;
      }
      const word = wordAtPoint(event.clientX, event.clientY);
      if (word) {
        showWord(word, event.clientX, event.clientY);
      }
    };
    document.addEventListener('click', onClick);
    this.destroyRef.onDestroy(() => document.removeEventListener('click', onClick));

    // Игра идёт на сцене Holo glitch; после выхода возвращаем сцену, которая была до игры
    const gameSceneIndex = backgroundScenes.findIndex(scene => scene.name === 'holo');
    let sceneBeforeGame = index;
    let game: SkullGame | null = null;
    const stopGame = () => {
      game?.dispose();
      game = null;
    };
    this.destroyRef.onDestroy(stopGame);

    // Витрина босса по клику на бейдж — на текущей сцене, без переключения
    let showcase: BossShowcase | null = null;
    const stopShowcase = () => {
      showcase?.dispose();
      showcase = null;
    };
    this.destroyRef.onDestroy(stopShowcase);
    const runShowcase = async () => {
      const { BossShowcase } = await import('src/app/game/boss-showcase');
      if (this.destroyed) {
        return;
      }
      stopShowcase();
      background.setClickEffectsEnabled(false);
      showcase = new BossShowcase({
        scene: background.scene,
        getAspect: background.getAspect,
        addFrameCallback: background.addFrameCallback,
        glitchStrong: triggerStrongGlitch,
        glitchWave: (x, y) => triggerLocalGlitch({ x, y }),
        onDone: () => {
          stopShowcase();
          background.setClickEffectsEnabled(true);
          this.ngZone.run(() => this.gameService.endShowcase());
        }
      });
      showcase.start();
    };

    this.gameService.sceneRequest$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async request => {
      if (request === 'showcase') {
        runShowcase();
        return;
      }
      if (request === 'enter') {
        sceneBeforeGame = index;
        index = gameSceneIndex;
        switchScene(backgroundScenes[index], showLabel);
        // Движок грузится лениво, вместе с three.js он уже в кэше
        const { SkullGame } = await import('src/app/game/skull-game');
        if (this.gameService.phase() !== 'playing') {
          return;
        }
        stopGame();
        game = new SkullGame({
          scene: background.scene,
          getAspect: background.getAspect,
          getTunnelCenter: background.getTunnelCenter,
          addFrameCallback: background.addFrameCallback,
          onStatus: (level, timeLeft, hint) => this.ngZone.run(() => this.gameService.setStatus(level, timeLeft, hint)),
          onDeath: () => {
            this.sound.death();
            this.ngZone.run(() => this.gameService.die());
          },
          onWin: () => {
            this.sound.win();
            this.ngZone.run(() => this.gameService.win());
          },
          onHit: () => this.sound.hit(),
          onExplode: () => this.sound.explode(),
          glitchWave: (x, y) => triggerLocalGlitch({ x, y }),
          glitchStrong: triggerStrongGlitch,
          glitch: triggerGlitch,
          setTravelSpeed: background.setTravelSpeed
        });
        background.setClickEffectsEnabled(false);
        background.setGameMode(true);
        game.start(startLevel);
      } else if (request === 'retry') {
        game?.start(startLevel);
      } else {
        stopGame();
        background.setClickEffectsEnabled(true);
        background.setGameMode(false);
        background.setTravelSpeed(1);
        index = sceneBeforeGame;
        switchScene(backgroundScenes[index], showLabel);
      }
    });

    this.gameService.input$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(input => {
      if (input.type === 'letter') {
        game?.hitLetter(input.letter);
      } else {
        game?.hitAt(input.x, input.y, window.innerHeight);
      }
    });

    const showLabel = () => {
      if (previewName === null) {
        return;
      }
      this.ngZone.run(() => this.previewScene.set(backgroundScenes[index]));
      const url = new URL(window.location.href);
      url.searchParams.set('bg', backgroundScenes[index].name);
      window.history.replaceState(null, '', url);
    };

    if (previewName === null) {
      return;
    }

    this.switchScene = (step: number) => {
      index = (index + step + backgroundScenes.length) % backgroundScenes.length;
      switchScene(backgroundScenes[index], showLabel);
    };

    const onKeydown = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (step) {
        this.switchScene(step);
      }
    };

    showLabel();
    document.addEventListener('keydown', onKeydown);
    this.destroyRef.onDestroy(() => document.removeEventListener('keydown', onKeydown));
  }
}
