import { inject, Injectable, signal } from '@angular/core';
import { AchievementService } from 'src/app/services/achievement.service';
import { Observable, Subject } from 'rxjs';
import { Hint, LEVELS } from 'src/app/game/levels';

export type GamePhase = 'idle' | 'playing' | 'dead' | 'won';

const HINT_FLASH_MS = 2500;
// Сколько висит надпись с номером уровня посреди экрана в начале уровня
const LEVEL_BANNER_MS = 1300;
// Сколько показывать экран победы перед возвратом на визитку
const WIN_SCREEN_MS = 4000;

// Что фон должен сделать с состоянием игры: уйти на сцену игры или вернуть прежнюю
export type GameSceneRequest = 'enter' | 'restore' | 'retry' | 'showcase';

// Ввод игрока: буква с клавиатуры или тап/клик в точке экрана (NDC)
export type GameInput = { type: 'letter', letter: string } | { type: 'point', x: number, y: number };

// Состояние мини-игры для интерфейса. Сам движок (three.js) живёт в src/app/game
@Injectable({
  providedIn: 'root'
})
export class GameService {
  private readonly achievements: AchievementService = inject(AchievementService);
  public readonly phase = signal<GamePhase>('idle');
  // Строка «Don't press Z» появляется после первого нажатия F
  public readonly hintVisible = signal(false);
  public readonly level = signal(1);
  public readonly timeLeft = signal(LEVELS[0].duration);
  public readonly hint = signal<Hint>({ text: '', accent: '' });
  // Правило сменилось (число нажатий) — подсказка подсвечивается и трясётся
  public readonly hintFlash = signal(false);
  // Витрина босса по клику на бейдж: интерфейс на это время прячется
  public readonly showcase = signal(false);
  private hintFlashTimer: ReturnType<typeof setTimeout> | null = null;
  // Начался новый уровень — его номер коротко показывается посреди экрана
  public readonly levelBanner = signal(false);
  private levelBannerTimer: ReturnType<typeof setTimeout> | null = null;
  // Уровень, о начале которого уже объявили; 0 — ещё ни о каком (новая партия)
  private announcedLevel = 0;
  private winTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly sceneRequestSubject = new Subject<GameSceneRequest>();
  public readonly sceneRequest$: Observable<GameSceneRequest> = this.sceneRequestSubject.asObservable();
  private readonly inputSubject = new Subject<GameInput>();
  public readonly input$: Observable<GameInput> = this.inputSubject.asObservable();

  public input(input: GameInput): void {
    if (this.phase() === 'playing') {
      this.inputSubject.next(input);
    }
  }

  public die(): void {
    if (this.phase() === 'playing') {
      this.phase.set('dead');
    }
  }

  public win(): void {
    if (this.phase() !== 'playing') {
      return;
    }
    this.phase.set('won');
    this.achievements.unlock('dungeonMaster');
    this.clearWinTimer();
    this.winTimer = setTimeout(() => {
      this.winTimer = null;
      if (this.phase() === 'won') {
        this.leave();
      }
    }, WIN_SCREEN_MS);
  }

  public showBoss(): void {
    if (this.phase() !== 'idle' || this.showcase()) {
      return;
    }
    this.showcase.set(true);
    this.sceneRequestSubject.next('showcase');
  }

  public endShowcase(): void {
    this.showcase.set(false);
  }

  public showHint(): void {
    this.hintVisible.set(true);
  }

  public start(): void {
    // Во время витрины босса игру не запускаем: витрина по окончании включает эффекты клика обратно
    if (this.phase() !== 'idle' || this.showcase()) {
      return;
    }
    this.phase.set('playing');
    this.level.set(1);
    this.timeLeft.set(LEVELS[0].duration);
    this.announcedLevel = 0;
    // Подсказка прошлой партии не должна мелькнуть, пока грузится движок
    this.hint.set({ text: '', accent: '' });
    this.sceneRequestSubject.next('enter');
  }

  public retry(): void {
    if (this.phase() === 'idle') {
      return;
    }
    this.phase.set('playing');
    this.level.set(1);
    this.timeLeft.set(LEVELS[0].duration);
    this.announcedLevel = 0;
    this.sceneRequestSubject.next('retry');
  }

  // Движок игры сообщает состояние для HUD
  public setStatus(level: number, timeLeft: number, hint: Hint): void {
    const previous = this.hint();
    this.level.set(level);
    this.timeLeft.set(timeLeft);
    this.hint.set(hint);
    if (level > 1 && (previous.text !== hint.text || previous.accent !== hint.accent)) {
      this.flashHint();
    }
    if (level !== this.announcedLevel) {
      this.announcedLevel = level;
      this.showLevelBanner();
    }
  }

  private showLevelBanner(): void {
    this.levelBanner.set(true);
    if (this.levelBannerTimer !== null) {
      clearTimeout(this.levelBannerTimer);
    }
    this.levelBannerTimer = setTimeout(() => this.levelBanner.set(false), LEVEL_BANNER_MS);
  }

  private flashHint(): void {
    this.hintFlash.set(true);
    if (this.hintFlashTimer !== null) {
      clearTimeout(this.hintFlashTimer);
    }
    this.hintFlashTimer = setTimeout(() => this.hintFlash.set(false), HINT_FLASH_MS);
  }

  public leave(): void {
    if (this.phase() === 'idle') {
      return;
    }
    this.clearWinTimer();
    this.phase.set('idle');
    this.hintFlash.set(false);
    this.levelBanner.set(false);
    this.sceneRequestSubject.next('restore');
  }

  private clearWinTimer(): void {
    if (this.winTimer !== null) {
      clearTimeout(this.winTimer);
      this.winTimer = null;
    }
  }
}
