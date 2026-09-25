// Porta de frontend/src/components/ProductCover.jsx.
import { Component, Input } from '@angular/core';
import { IconComponent } from './icon.component';
import { categoryIcon } from '../category-visual';

@Component({
  selector: 'app-product-cover',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (imageUrl) {
      <img class="mk-photo" [src]="imageUrl" [alt]="name" loading="lazy">
    } @else if (caption) {
      <div class="mk-ph">
        <app-icon [name]="iconeCategoria" [size]="28"></app-icon>
        <span>Sem fotografia</span>
      </div>
    } @else {
      <div class="mk-ph" role="img" aria-label="Sem fotografia">
        <app-icon [name]="iconeCategoria" [size]="28"></app-icon>
      </div>
    }
  `,
})
export class ProductCoverComponent {
  @Input() imageUrl?: string | null;
  @Input() category?: string | null;
  @Input() name = '';
  @Input() caption = true;

  get iconeCategoria(): string {
    return categoryIcon(this.category);
  }
}
