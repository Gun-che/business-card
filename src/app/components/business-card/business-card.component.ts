import { ChangeDetectionStrategy, Component, computed, effect, HostListener, inject, OnInit, signal } from '@angular/core';
import { ShakingTextComponent } from 'src/app/components/shaking-text/shaking-text.component';
import { MusicService } from 'src/app/services/music.service';
import { GlitchService } from 'src/app/services/glitch.service';
import { GameService } from 'src/app/services/game.service';
import { showHide, showHideState } from 'src/app/animations/show-hide.animation';
import { LoadingService } from 'src/app/services/loading.service';

@Component({
  selector: 'business-card',
  standalone: true,
  imports: [ShakingTextComponent],
  templateUrl: './business-card.component.html',
  styleUrl: './business-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [showHide, showHideState]
})
export class BusinessCardComponent implements OnInit {
  private readonly musicService: MusicService = inject(MusicService);
  private readonly glitchService: GlitchService = inject(GlitchService);
  private readonly loadingService: LoadingService = inject(LoadingService);
  public readonly game: GameService = inject(GameService);
  // Логотип загружен и декодирован — визитку можно показывать
  public readonly ready = signal(false);
  // Во время игры и витрины босса визитка спрятана
  public readonly visible = computed(() => this.game.phase() === 'idle' && !this.game.showcase());
  public readonly logoUrl = 'assets/images/vg4.webp';
  // Держим ссылку на декодированную картинку, чтобы браузер не выкидывал её из кэша декодирования
  private readonly logo = new Image();

  constructor() {
    // Во время игры трек крутится по кругу; вне игры доигрывает и останавливается, как раньше
    effect(() => this.musicService.setLoop(this.game.phase() !== 'idle'));
  }

  public ngOnInit(): void {
    this.musicService.setAudio('assets/music/new-slaves.mp3');
    this.musicService.setVolume(0.3);
    this.observeLoading();
  }

  @HostListener('document:keydown', ['$event'])
  public onKeydown(event: KeyboardEvent): void {
    // Во время игры все буквы отданы игре
    if (event.repeat || this.game.phase() !== 'idle') {
      return;
    }

    if (event.code === 'KeyF') {
      this.toggleRap();
      this.glitchService.burst();
    } else if (event.code === 'KeyZ') {
      this.startGame();
    }
  }

  public startGame(): void {
    if (this.game.hintVisible()) {
      this.game.start();
    }
  }

  public glitch(): void {
    this.glitchService.burst();
  }

  public toggleRap(): void {
    this.musicService.togglePlay();
    this.game.showHint();
  }

  private observeLoading() {
    this.logo.src = this.logoUrl;

    // decode() дожидается не только загрузки, но и декодирования — без рывка при появлении
    this.loadingService.track('logo', this.logo.decode().catch(() => {}))
      .then(() => this.ready.set(true));
  }
}
