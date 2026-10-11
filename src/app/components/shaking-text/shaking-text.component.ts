import { ChangeDetectionStrategy, Component, computed, input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'shaking-text',
  standalone: true,
  imports: [],
  templateUrl: './shaking-text.component.html',
  styleUrl: './shaking-text.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShakingTextComponent {
  public readonly text = input.required<string>();
  // Array.from корректно делит строку с эмодзи и суррогатными парами
  public readonly letters = computed(() => Array.from(this.text()));
}
