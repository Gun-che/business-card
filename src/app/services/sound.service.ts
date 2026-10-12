import { Injectable } from '@angular/core';

// Общая громкость эффектов относительно музыки (у неё 0.3)
const MASTER_VOLUME = 0.22;

type Wave = OscillatorType;

/**
 * 8-битные звуки игры, синтезируются через Web Audio без файлов.
 * AudioContext создаётся лениво при первом звуке — все вызовы идут после действия пользователя,
 * так что автоплей-политика браузера не мешает
 */
@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Короткий «блип» на нажатие клавиши / тап по черепу
  public hit(): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }
    const t = context.currentTime;
    this.tone('square', 880, 1320, t, 0.07, 0.5);
  }

  // Шумовой взрыв на уничтожение черепа
  public explode(): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }
    const t = context.currentTime;
    this.noise(t, 0.35, 1800, 200, 0.9);
    this.tone('square', 220, 40, t, 0.25, 0.4);
  }

  // Нисходящий тон на проигрыш
  public death(): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }
    const t = context.currentTime;
    this.tone('sawtooth', 440, 55, t, 0.9, 0.6);
    this.tone('square', 330, 41, t + 0.05, 0.9, 0.3);
    this.noise(t + 0.1, 0.8, 1200, 100, 0.5);
  }

  // Короткая фанфара на победу: C E G C
  public win(): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }
    const t = context.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, i) => {
      const start = t + i * 0.12;
      const length = i === notes.length - 1 ? 0.5 : 0.12;
      this.tone('square', frequency, frequency, start, length, 0.45);
      this.tone('triangle', frequency / 2, frequency / 2, start, length, 0.3);
    });
  }

  private ensureContext(): AudioContext | null {
    if (!this.context) {
      const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) {
        return null;
      }
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.gain.value = MASTER_VOLUME;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }
    return this.context;
  }

  // Тон с линейным скольжением частоты и быстрым затуханием
  private tone(wave: Wave, from: number, to: number, start: number, length: number, volume: number): void {
    const context = this.context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(to, 1), start + length);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + length + 0.05);
  }

  // Белый шум через фильтр с опускающейся частотой среза
  private noise(start: number, length: number, cutoffFrom: number, cutoffTo: number, volume: number): void {
    const context = this.context;
    const source = context.createBufferSource();
    source.buffer = this.getNoiseBuffer();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffFrom, start);
    filter.frequency.exponentialRampToValueAtTime(cutoffTo, start + length);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start);
    source.stop(start + length + 0.05);
  }

  private getNoiseBuffer(): AudioBuffer {
    if (!this.noiseBuffer) {
      const context = this.context;
      const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }
}
