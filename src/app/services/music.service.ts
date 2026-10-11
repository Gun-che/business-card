import { Injectable } from '@angular/core';

const PRELOAD_DELAY_MS = 3000;

@Injectable({
  providedIn: 'root'
})
export class MusicService {
  private readonly player: HTMLAudioElement = new Audio();

  constructor() {
    // Трек ~6 МБ: не качаем в момент открытия страницы, чтобы не мешать картинкам и шейдеру
    this.player.preload = 'none';
  }

  public setAudio(src: string): void {
    this.player.src = src;
    // Догружаем в фоне чуть позже — к первому нажатию F трек уже в кэше и стартует сразу
    setTimeout(() => {
      this.player.preload = 'auto';
      this.player.load();
    }, PRELOAD_DELAY_MS);
  }

  public play(): void {
    // play() отклоняется, если браузер заблокировал автовоспроизведение
    this.player.play().catch(() => {});
  }

  public pause(): void {
    this.player.pause();
  }

  public setVolume(volume: number): void {
    this.player.volume = volume;
  }

  public togglePlay(): void {
    if (this.player.paused) {
      this.play();
      return;
    }
    this.pause();
  }
}
