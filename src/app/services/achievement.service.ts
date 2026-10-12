import { Injectable, signal } from '@angular/core';

export type Achievement = 'dungeonMaster';

const STORAGE_KEY = 'achievements';

// Ачивки хранятся в localStorage, чтобы пережить перезагрузку страницы
@Injectable({
  providedIn: 'root'
})
export class AchievementService {
  public readonly unlocked = signal<ReadonlySet<Achievement>>(this.load());

  public has(achievement: Achievement): boolean {
    return this.unlocked().has(achievement);
  }

  public unlock(achievement: Achievement): void {
    if (this.has(achievement)) {
      return;
    }
    const next = new Set(this.unlocked());
    next.add(achievement);
    this.unlocked.set(next);
    this.save(next);
  }

  private load(): Set<Achievement> {
    // localStorage может быть недоступен (приватный режим, запрет cookies) — тогда ачивки живут только в сессии
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(list) ? list : []);
    } catch {
      return new Set();
    }
  }

  private save(set: ReadonlySet<Achievement>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch {
      // Негде сохранить — не страшно
    }
  }
}
