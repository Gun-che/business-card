import { NgZone } from '@angular/core';
import { MonoTypeOperatorFunction, Observable, Subscriber, Subscription } from 'rxjs';
import { Nullable } from 'src/app/types/nullable';

export function subscribeOutsideAngular<T>(ngZone: NgZone): MonoTypeOperatorFunction<T> {
  return (source$: Observable<T>) =>
    new Observable<T>((subscriber: Subscriber<T>) => {
      let subscription: Nullable<Subscription> = null;

      ngZone.runOutsideAngular(() => {
        subscription = source$.subscribe(subscriber);
      });

      return { unsubscribe: () => subscription?.unsubscribe() };
    });
}