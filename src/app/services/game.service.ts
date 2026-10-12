import { Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Hint } from 'src/app/game/levels';

export type GamePhase = 'idle' | 'playing' | 'dead' | 'won';

// Что фон должен сделать с состоянием игры: уйти на сцену игры или вернуть прежнюю
export type GameSceneRequest = 'enter' | 'restore' | 'retry';

// Ввод игрока: буква с клавиатуры или тап/клик в точке экрана (NDC)
export type GameInput = { type: 'letter', letter: string } | { type: 'point', x: number, y: number };

// Состояние мини-игры для интерфейса. Сам движок (three.js) живёт в src/app/game
@Injectable({
  providedIn: 'root'
})
export class GameService {
  public readonly phase = signal<GamePhase>('idle');
  // Строка «Don't press Z» появляется после первого нажатия F
  public readonly hintVisible = signal(false);
  public readonly level = signal(1);
  public readonly timeLeft = signal(30);
  public readonly hint = signal<Hint>({ text: '', accent: '' });

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

  public showHint(): void {
    this.hintVisible.set(true);
  }

  public start(): void {
    if (this.phase() !== 'idle') {
      return;
    }
    this.phase.set('playing');
    this.level.set(1);
    this.timeLeft.set(30);
    this.sceneRequestSubject.next('enter');
  }

  public retry(): void {
    if (this.phase() === 'idle') {
      return;
    }
    this.phase.set('playing');
    this.level.set(1);
    this.timeLeft.set(30);
    this.sceneRequestSubject.next('retry');
  }

  // Движок игры сообщает состояние для HUD
  public setStatus(level: number, timeLeft: number, hint: Hint): void {
    this.level.set(level);
    this.timeLeft.set(timeLeft);
    this.hint.set(hint);
  }

  public leave(): void {
    if (this.phase() === 'idle') {
      return;
    }
    this.phase.set('idle');
    this.sceneRequestSubject.next('restore');
  }
}
