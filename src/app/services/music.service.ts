import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MusicService {
  private readonly player: HTMLAudioElement = new Audio();

  public setAudio(src: string): void {
    this.player.src = src;
    this.player.load();
  }

  public play(): void {
    this.player.play();
  }

  public pause(): void {
    this.player.pause();
  }

  public setVolume(volume: number): void {
    this.player.volume = volume;
  }

  public toggle(): void {
    if (this.player.paused) {
      this.play();
      return;
    }
    this.pause();
  }
}
