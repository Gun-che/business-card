import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { GameService } from 'src/app/services/game.service';
import { showHide } from 'src/app/animations/show-hide.animation';
import { ShakingTextComponent } from 'src/app/components/shaking-text/shaking-text.component';

// Интерфейс поверх игры: угол с уровнем и таймером, экраны смерти и победы
@Component({
  selector: 'game-overlay',
  standalone: true,
  imports: [ShakingTextComponent],
  templateUrl: './game-overlay.component.html',
  styleUrl: './game-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [showHide]
})
export class GameOverlayComponent {
  public readonly game: GameService = inject(GameService);

  @HostListener('document:keydown', ['$event'])
  public onKeydown(event: KeyboardEvent): void {
    if (this.game.phase() === 'idle') {
      return;
    }
    if (event.key === 'Escape') {
      this.game.leave();
      return;
    }
    // Буквы — по физической клавише, чтобы работало в любой раскладке
    const match = /^Key([A-Z])$/.exec(event.code);
    if (match && !event.repeat) {
      this.game.input({ type: 'letter', letter: match[1] });
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  public onPointerDown(event: PointerEvent): void {
    // Кнопки интерфейса — не тап по черепу
    if (this.game.phase() !== 'playing' || (event.target as HTMLElement).closest('button')) {
      return;
    }
    this.game.input({
      type: 'point',
      x: event.clientX / window.innerWidth * 2 - 1,
      y: 1 - event.clientY / window.innerHeight * 2
    });
  }
}
