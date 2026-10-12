import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BackgroundComponent } from './components/background/background.component';
import { GameOverlayComponent } from './components/game-overlay/game-overlay.component';
import { AchievementBadgeComponent } from './components/achievement-badge/achievement-badge.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, BackgroundComponent, GameOverlayComponent, AchievementBadgeComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
}
