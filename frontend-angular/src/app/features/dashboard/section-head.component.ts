// Porta de SectionHead em frontend/src/pages/comprador/Home.jsx:191-199.
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-section-head',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="sec-head">
      <div>
        <strong>{{ title }}</strong>
        @if (sub) {
          <span class="sec-sub"> · {{ sub }}</span>
        }
      </div>
      @if (to) {
        <a [routerLink]="to" class="sec-link">Ver todas</a>
      }
    </div>
  `,
})
export class SectionHeadComponent {
  @Input({ required: true }) title = '';
  @Input() sub?: string;
  @Input() to?: string;
}
