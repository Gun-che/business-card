import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ShakingTextComponent } from 'src/app/components/shaking-text/shaking-text.component';

@Component({
  selector: 'app-business-card',
  standalone: true,
  imports: [
    ShakingTextComponent
  ],
  templateUrl: './business-card.component.html',
  styleUrl: './business-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush

})
export class BusinessCardComponent {}