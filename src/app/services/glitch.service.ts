import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

// Мост между интерфейсом и фоновым шейдером: кто угодно может запросить вспышку глитча
@Injectable({
  providedIn: 'root'
})
export class GlitchService {
  private readonly burstSubject = new Subject<void>();
  public readonly burst$: Observable<void> = this.burstSubject.asObservable();

  public burst(): void {
    this.burstSubject.next();
  }
}
