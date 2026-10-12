import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AchievementService } from 'src/app/services/achievement.service';
import { GameService } from 'src/app/services/game.service';
import { showHide } from 'src/app/animations/show-hide.animation';
import { SKULL_BASE } from 'src/app/game/skull-pixels';

interface Pixel {
  x: number;
  y: number;
  kind: 'bone' | 'shade' | 'glow';
}

// Бейдж «Dungeon master» в правом верхнем углу: пиксельный неоновый череп
@Component({
  selector: 'achievement-badge',
  standalone: true,
  imports: [],
  templateUrl: './achievement-badge.component.html',
  styleUrl: './achievement-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [showHide]
})
export class AchievementBadgeComponent {
  public readonly achievements: AchievementService = inject(AchievementService);
  public readonly game: GameService = inject(GameService);
  public readonly size = SKULL_BASE.length;
  public readonly pixels: Pixel[] = this.buildPixels();

  // Тот же алгоритм, что у спрайтов игры: кость, тень и автоматический контур свечения
  private buildPixels(): Pixel[] {
    const at = (x: number, y: number) => SKULL_BASE[y]?.[x] ?? '.';
    const isBone = (x: number, y: number) => at(x, y) !== '.';
    const pixels: Pixel[] = [];
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const pixel = at(x, y);
        if (pixel === '#') {
          pixels.push({ x, y, kind: 'bone' });
        } else if (pixel === 'x') {
          pixels.push({ x, y, kind: 'shade' });
        } else if (isBone(x - 1, y) || isBone(x + 1, y) || isBone(x, y - 1) || isBone(x, y + 1)) {
          pixels.push({ x, y, kind: 'glow' });
        }
      }
    }
    return pixels;
  }
}
