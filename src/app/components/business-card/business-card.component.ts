import { ChangeDetectionStrategy, Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { ShakingTextComponent } from 'src/app/components/shaking-text/shaking-text.component';
import { MusicService } from 'src/app/services/music.service';
import { GlitchService } from 'src/app/services/glitch.service';
import { showHide } from 'src/app/animations/show-hide.animation';

@Component({
  selector: 'business-card',
  standalone: true,
  imports: [ShakingTextComponent],
  templateUrl: './business-card.component.html',
  styleUrl: './business-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [showHide]
})
export class BusinessCardComponent implements OnInit {
  private readonly musicService: MusicService = inject(MusicService);
  private readonly glitchService: GlitchService = inject(GlitchService);
  public readonly loading = signal(true);
  public readonly logoUrl = 'assets/images/vg4.webp';

  public ngOnInit(): void {
    this.musicService.setAudio('assets/music/new-slaves.mp3');
    this.musicService.setVolume(0.3);
    this.observeLoading();
  }

  @HostListener('document:keydown', ['$event'])
  public togglePlay(event: KeyboardEvent): void {
    if (event.code !== 'KeyF' || event.repeat) {
      return;
    }

    this.toggleRap();
    this.glitchService.burst();
  }

  public glitch(): void {
    this.glitchService.burst();
  }

  public toggleRap(): void {
    this.musicService.togglePlay();
  }

  private observeLoading() {
    const img = new Image();
    img.src = this.logoUrl;

    // decode() дожидается не только загрузки, но и декодирования — без рывка при появлении
    img.decode()
      .catch(() => {})
      .finally(() => this.loading.set(false));
  }
}
