// Porta de SupplierCell em frontend/src/components/BuyerUI.jsx:126-137.
import { Component, Input } from '@angular/core';

export interface SupplierRef {
  name?: string | null;
  logoUrl?: string | null;
  city?: string | null;
  country?: string | null;
}

@Component({
  selector: 'app-supplier-cell',
  standalone: true,
  template: `
    <div class="bz-supplier">
      <span class="bz-supplier-logo">
        @if (supplier?.logoUrl) {
          <img [src]="supplier!.logoUrl" alt="">
        } @else {
          {{ iniciais }}
        }
      </span>
      <div>
        <strong>{{ supplier?.name || '—' }}</strong>
        @if (supplier?.city) {
          <span class="bz-supplier-loc">{{ supplier!.city }}, {{ supplier!.country || 'Angola' }}</span>
        }
      </div>
    </div>
  `,
})
export class SupplierCellComponent {
  @Input() supplier: SupplierRef | null = null;

  get iniciais(): string {
    return (this.supplier?.name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] || '')
      .join('')
      .toUpperCase();
  }
}
