import { ChangeDetectionStrategy, Component, HostListener, inject, OnInit } from '@angular/core';
import { ShakingTextComponent } from 'src/app/components/shaking-text/shaking-text.component';
import { MusicService } from 'src/app/services/music.service';

@Component({
  selector: 'business-card',
  standalone: true,
  imports: [ShakingTextComponent],
  templateUrl: './business-card.component.html',
  styleUrl: './business-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class BusinessCardComponent implements OnInit {
  private readonly musicService: MusicService = inject(MusicService);

  public ngOnInit(): void {
    this.musicService.setAudio('assets/music/new-slaves.mp3');
    this.musicService.setVolume(0.3);
  }

  @HostListener('document:keydown', ['$event'])
  public togglePlay(event: KeyboardEvent): void {
    if (event.code !== 'KeyF') {
      return;
    }

    this.toggleRap();
  }

  public toggleRap(): void {
    this.musicService.toggle();
  }
}