import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, NgZone, signal, ViewChild } from '@angular/core';
import { Nullable } from 'src/app/types/nullable';
import { BackgroundScene } from 'src/app/three/scenes/background-scene.model';
import { GlitchService } from 'src/app/services/glitch.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { wordAtPoint } from 'src/app/utils/word-at-point';
import { GameService } from 'src/app/services/game.service';


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

    const previewName = new URLSearchParams(window.location.search).get('bg');
    let index = Math.max(0, backgroundScenes.findIndex(scene => scene.name === previewName));

    const { dispose, switchScene, triggerStrongGlitch, showWord } = drawBackground({
      el: this.backgroundRef?.nativeElement,
      eventsEl: window.document.body,
      shaderPoints: 5,
      curvePoints: 40,
      curveLerp: 0.9,
      radius1: 10,
      radius2: 150,
      velocityTreshold: 200
    }, backgroundScenes[index]);

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
    this.gameService.sceneRequest$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(request => {
      if (request === 'enter') {
        sceneBeforeGame = index;
        index = gameSceneIndex;
      } else {
        index = sceneBeforeGame;
      }
      switchScene(backgroundScenes[index], showLabel);
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
