// Porta de MiniCard em frontend/src/pages/comprador/Home.jsx:215-226.
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProductDto } from '../../core/models/product.model';
import { formatMoney } from '../../shared/domain';
import { ProductCoverComponent } from '../../shared/components/product-cover.component';
import { StarsComponent } from '../../shared/components/stars.component';

@Component({
  selector: 'app-mini-card',
  standalone: true,
  imports: [ProductCoverComponent, StarsComponent],
  template: `
    <div class="mini-card" (click)="cardClick.emit()">
      <div class="mini-img">
        <app-product-cover [imageUrl]="p.imageUrl" [category]="p.category" [name]="p.name" [caption]="false"></app-product-cover>
      </div>
      <div class="mini-name">{{ p.name }}</div>
      <div class="mini-company">{{ p.supplier?.name }}</div>
      <div class="mini-price">
        @if (fromPrice) {
          <span class="mini-from">A partir de </span>
        }
        {{ formatMoney(p.promoPrice || p.unitPrice, p.currency) }}
      </div>
      @if (!fromPrice && p.rating) {
        <div class="mini-rating">
          <app-stars [value]="p.rating"></app-stars>
          <span>{{ p.rating.toFixed(1) }} {{ p.reviewCount ? '(' + p.reviewCount + ')' : '' }}</span>
        </div>
      }
    </div>
  `,
})
export class MiniCardComponent {
  @Input({ required: true }) p!: ProductDto;
  @Input() fromPrice = false;
  @Output() readonly cardClick = new EventEmitter<void>();

  readonly formatMoney = formatMoney;
}
