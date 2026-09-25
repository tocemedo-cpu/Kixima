// Porta de Crumbs em frontend/src/components/BuyerUI.jsx:28-47.
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Trilho {
  label: string;
  to?: string;
}
export type TrilhoItem = string | Trilho;

@Component({
  selector: 'app-crumbs',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="bz-crumbs" aria-label="Caminho">
      @for (item of normalizado; track $index; let ultimo = $last) {
        <span>
          @if ($index > 0) {
            <span class="bz-crumb-sep" aria-hidden="true">›</span>
          }
          @if (ultimo) {
            <strong aria-current="page">{{ item.label }}</strong>
          } @else if (item.to) {
            <a class="bz-crumb-link" [routerLink]="item.to">{{ item.label }}</a>
          } @else {
            {{ item.label }}
          }
        </span>
      }
    </nav>
  `,
})
export class CrumbsComponent {
  @Input() trail: TrilhoItem[] = [];

  get normalizado(): Trilho[] {
    return this.trail.map((item) => (typeof item === 'string' ? { label: item } : item));
  }
}
