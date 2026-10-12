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
    if (event.key === 'Escape' && this.game.phase() !== 'idle') {
      this.game.leave();
    }
  }
}
