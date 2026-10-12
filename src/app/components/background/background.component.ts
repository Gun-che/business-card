import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, NgZone, signal, ViewChild } from '@angular/core';
import { Nullable } from 'src/app/types/nullable';
import { BackgroundScene } from 'src/app/three/scenes/background-scene.model';
import { GlitchService } from 'src/app/services/glitch.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { wordAtPoint } from 'src/app/utils/word-at-point';
import { GameInput, GameSceneRequest, GameService } from 'src/app/services/game.service';
import { SoundService } from 'src/app/services/sound.service';
import { LoadingService } from 'src/app/services/loading.service';
import type { SkullGame } from 'src/app/game/skull-game';
import type { BossShowcase } from 'src/app/game/boss-showcase';

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
  public readonly gameService: GameService = inject(GameService);
  private readonly sound: SoundService = inject(SoundService);
  private readonly loading: LoadingService = inject(LoadingService);
  @ViewChild('background') public backgroundRef: Nullable<ElementRef<HTMLElement>>;
  private destroyed = false;

  // Подпись текущего фона и переключение стрелками ← →; ?bg=<name> задаёт стартовую сцену
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
    // Запросы игры могут прийти, пока three.js ещё грузится (быстрое F → Z):
    // подписываемся сразу и копим их, а после загрузки обрабатываем по порядку
    let handleRequest: ((request: GameSceneRequest) => void) | null = null;
    const pendingRequests: GameSceneRequest[] = [];
    this.gameService.sceneRequest$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(request => {
      if (handleRequest) {
        handleRequest(request);
      } else {
        pendingRequests.push(request);
      }
    });
    let handleInput: (input: GameInput) => void = () => {};
    this.gameService.input$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(input => handleInput(input));

    // three.js — основная часть бандла: грузим отдельным чанком, чтобы не блокировать первую отрисовку
    const [{ drawBackground }, { backgroundScenes }] = await this.loading.track('background', Promise.all([
      import('src/app/three/draw-background'),
      import('src/app/three/scenes')
    ]));
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

    // Игра идёт на сцене Holo glitch; после выхода возвращаем сцену, которая была до игры
    const gameSceneIndex = backgroundScenes.findIndex(scene => scene.name === 'holo');
    const loadGame = () => import('src/app/game/skull-game');

    // Индикатор горит, пока компилируется шейдер первой сцены. Затем, пока пользователь читает визитку,
    // прогреваем шейдер игровой сцены и тянем чанк игры — к нажатию Z всё уже готово, без фриза
    this.loading.track('background', background.ready).then(() => {
      if (this.destroyed) {
        return;
      }
      background.prewarmScene(backgroundScenes[index]);
      background.prewarmScene(backgroundScenes[gameSceneIndex]);
      loadGame().catch(() => {});
    });

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
      const { BossShowcase } = await this.loading.track('showcase', import('src/app/game/boss-showcase'));
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

    const startGame = async () => {
      sceneBeforeGame = index;
      index = gameSceneIndex;
      switchScene(backgroundScenes[index], showLabel);
      // Чанк игры и шейдер сцены обычно уже прогреты; если нет — на это время горит «Loading...»
      const [{ SkullGame }] = await this.loading.track('game', Promise.all([
        loadGame(),
        background.prewarmScene(backgroundScenes[index])
      ]));
      if (this.destroyed || this.gameService.phase() !== 'playing') {
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
    };

    const showLabel = () => {
      this.ngZone.run(() => this.previewScene.set(backgroundScenes[index]));
    };
    // Выбранный вручную фон запоминаем в адресе, чтобы ссылкой можно было поделиться
    const showLabelAndUrl = () => {
      showLabel();
      const url = new URL(window.location.href);
      url.searchParams.set('bg', backgroundScenes[index].name);
      window.history.replaceState(null, '', url);
    };

    handleRequest = request => {
      if (request === 'showcase') {
        runShowcase();
      } else if (request === 'enter') {
        startGame();
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
    };
    pendingRequests.splice(0).forEach(handleRequest);

    handleInput = input => {
      if (input.type === 'letter') {
        game?.hitLetter(input.letter);
      } else {
        game?.hitAt(input.x, input.y, window.innerHeight);
      }
    };

    this.switchScene = (step: number) => {
      // Во время игры сцену не трогаем: после выхода фон вернётся на сцену до игры
      if (this.gameService.phase() !== 'idle') {
        return;
      }
      index = (index + step + backgroundScenes.length) % backgroundScenes.length;
      switchScene(backgroundScenes[index], showLabelAndUrl);
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
