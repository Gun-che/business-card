import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ShakingTextComponent } from 'src/app/components/shaking-text/shaking-text.component';
import { LoadingService } from 'src/app/services/loading.service';
import { GameService } from 'src/app/services/game.service';
import { showHide } from 'src/app/animations/show-hide.animation';

// «Loading...» на время фоновых загрузок. Пока визитки на экране нет — крупно по центру,
// поверх визитки — мелко в углу, чтобы не перекрывать текст
@Component({
  selector: 'loading-indicator',
  standalone: true,
  imports: [ShakingTextComponent],
  templateUrl: './loading-indicator.component.html',
  styleUrl: './loading-indicator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [showHide]
})
export class LoadingIndicatorComponent {
  public readonly loading: LoadingService = inject(LoadingService);
  private readonly game: GameService = inject(GameService);
  public readonly centered = computed(() => this.loading.has('logo') || this.game.phase() !== 'idle' || this.game.showcase());
}
