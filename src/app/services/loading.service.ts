import { computed, inject, Injectable, NgZone, signal } from '@angular/core';

// Что сейчас грузится: логотип визитки, фон (three.js), чанк игры, витрина босса
export type LoadingTask = 'logo' | 'background' | 'game' | 'showcase';

// Фоновые загрузки для индикатора «Loading...»: пока есть хоть одна задача, он виден
@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private readonly ngZone: NgZone = inject(NgZone);
  private readonly tasks = signal<ReadonlyMap<LoadingTask, number>>(new Map());
  public readonly busy = computed(() => this.tasks().size > 0);

  public has(task: LoadingTask): boolean {
    return this.tasks().has(task);
  }

  // Индикатор горит, пока промис не завершится (успешно или с ошибкой)
  public track<T>(task: LoadingTask, promise: Promise<T>): Promise<T> {
    this.update(task, 1);
    return promise.finally(() => this.update(task, -1));
  }

  private update(task: LoadingTask, delta: number): void {
    // Загрузки стартуют и вне зоны (фон крутится в runOutsideAngular) — меняем состояние в зоне
    this.ngZone.run(() => this.tasks.update(tasks => {
      const next = new Map(tasks);
      const count = (next.get(task) ?? 0) + delta;
      if (count > 0) {
        next.set(task, count);
      } else {
        next.delete(task);
      }
      return next;
    }));
  }
}
