import { animate, state, style, transition, trigger } from '@angular/animations';

const enterSteps = [
  style({ transform: 'translateY(40%)', opacity: 0 }),
  animate('600ms cubic-bezier(0,.83,0,1.08)', style({ transform: 'translateY(0)', opacity: 1 }))
];
const leaveSteps = [animate('200ms ease-in', style({ opacity: 0 }))];

export const showHide = trigger('showHide', [
  transition(':enter', enterSteps),
  transition(':leave', leaveSteps)
]);

// Номер уровня посреди экрана: быстро проявляется с лёгким увеличением и быстро гаснет, чтобы не мешать игре
export const levelBanner = trigger('levelBanner', [
  transition(':enter', [
    style({ transform: 'scale(0.7)', opacity: 0 }),
    animate('150ms ease-out', style({ transform: 'scale(1)', opacity: 1 }))
  ]),
  transition(':leave', [animate('250ms ease-in', style({ transform: 'scale(1.15)', opacity: 0 }))])
]);

// То же появление и уход, но без удаления из DOM: [@showHideState]="'shown' | 'hidden'".
// Нужен, когда пересоздание дорого — например, картинка заново декодируется и мигает
export const showHideState = trigger('showHideState', [
  state('hidden', style({ opacity: 0, visibility: 'hidden' })),
  transition('void => shown, hidden => shown', [style({ visibility: 'visible' }), ...enterSteps]),
  transition('shown => hidden', leaveSteps)
]);
