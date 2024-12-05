import { ChangeDetectionStrategy, Component, Input, OnInit, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'shaking-text',
  standalone: true,
  imports: [],
  templateUrl: './shaking-text.component.html',
  styleUrl: './shaking-text.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShakingTextComponent implements OnInit {
  @Input({ required: true }) public text: string;
  public shakingText: string = '';

  public ngOnInit(): void {
    this.shakingText = this.text.split('').map(letter => `<span class="letter">${letter}</span>`).join('');
  }
}
