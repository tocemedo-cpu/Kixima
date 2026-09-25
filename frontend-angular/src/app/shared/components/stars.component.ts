// Porta de Stars em frontend/src/components/icons.jsx:68-77.
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-stars',
  standalone: true,
  template: `
    <span class="stars" [style.font-size.px]="size" [attr.aria-label]="value + ' de 5'">{{ texto }}</span>
  `,
})
export class StarsComponent {
  @Input() value = 0;
  @Input() size = 13;

  get texto(): string {
    const full = Math.floor(this.value);
    const half = this.value - full >= 0.5;
    return '★'.repeat(full) + (half ? '⯪' : '');
  }
}
