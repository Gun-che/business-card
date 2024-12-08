import { animate, style, transition, trigger } from '@angular/animations';

export const showHide = trigger('showHide', [
  transition(':enter', [
    style({ transform: 'translateY(40%)', opacity: 0 }),
    animate('600ms cubic-bezier(0,.83,0,1.08)', style({ transform: 'translateY(0)', opacity: 1 }))
  ]),
  transition(':leave', [animate('200ms ease-in', style({ opacity: 0 }))])
]);
