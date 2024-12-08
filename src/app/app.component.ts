import { ChangeDetectionStrategy, Component, DestroyRef, inject, NgZone } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BackgroundComponent } from './components/background/background.component';
import { NgOptimizedImage } from '@angular/common';
import { fromEvent, map, Observable, shareReplay, startWith } from 'rxjs';
import { subscribeOutsideAngular } from 'src/app/rxjs/operators/subscribe-outside-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, BackgroundComponent, NgOptimizedImage],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly ngZone: NgZone = inject(NgZone);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly innerHeightChanges$: Observable<number> = fromEvent(window, 'resize').pipe(
    startWith(null),
    subscribeOutsideAngular(this.ngZone),
    map(() => window.innerHeight),
    shareReplay({ refCount: true, bufferSize: 1 })
  );

  constructor() {
    this.subscribeToWindowResize();
  }

  private subscribeToWindowResize(): void {
    this.innerHeightChanges$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((height: number) => {
      this.setInnerHeight(height);
    });
  }

  private setInnerHeight(height: number): void {
    window.document.documentElement.style.setProperty(`--inner-height`, `${height}`);
  }
}
