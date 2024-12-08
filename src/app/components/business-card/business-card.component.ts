import { ChangeDetectionStrategy, Component, HostListener, inject, OnInit } from '@angular/core';
import { ShakingTextComponent } from 'src/app/components/shaking-text/shaking-text.component';
import { MusicService } from 'src/app/services/music.service';
import { BehaviorSubject } from 'rxjs';
import { AsyncPipe, NgIf } from '@angular/common';
import { showHide } from 'src/app/animations/show-hide.animation';

@Component({
  selector: 'business-card',
  standalone: true,
  imports: [ShakingTextComponent, NgIf, AsyncPipe],
  templateUrl: './business-card.component.html',
  styleUrl: './business-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [showHide]
})
export class BusinessCardComponent implements OnInit {
  private readonly musicService: MusicService = inject(MusicService);
  public readonly loading$ = new BehaviorSubject(true);
  public readonly logoUrl = 'assets/images/vg4.png';

  public ngOnInit(): void {
    this.musicService.setAudio('assets/music/new-slaves.mp3');
    this.musicService.setVolume(0.3);
    this.observeLoading();
  }

  @HostListener('document:keydown', ['$event'])
  public togglePlay(event: KeyboardEvent): void {
    if (event.code !== 'KeyF') {
      return;
    }

    this.toggleRap();
  }

  public toggleRap(): void {
    this.musicService.togglePlay();
  }

  private observeLoading() {
    const img = new Image();

    img.src = this.logoUrl;

    img.onload = () => {
      this.loading$.next(false);
    };

    img.onerror = () => {
      this.loading$.next(false);
    };

    setTimeout(() => {
      this.loading$.next(false);
    }, 2000);
  }
}