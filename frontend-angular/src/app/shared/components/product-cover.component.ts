// Porta de frontend/src/components/ProductCover.jsx + categoryVisual()
// (frontend/src/components/icons.jsx:81-97). Os nomes de ícone por categoria
// (valve, hydraulic, inspection, engineering, equipment, materials, offshore,
// consulting) ainda não foram portados para IconComponent — caem no mesmo
// 'box' que o original usa para qualquer categoria desconhecida, por isso o
// comportamento nunca fica pior do que o original, só menos específico até
// esses ícones serem portados (ver docs/migracao-angular/PLANO.md).
import { Component, Input } from '@angular/core';
import { IconComponent } from './icon.component';

const CATEGORY_ICON: Record<string, string> = {
  Válvulas: 'valve',
  Hidráulica: 'hydraulic',
  'Inspeção & Ensaios': 'inspection',
  'Logística & Transporte': 'truck',
  Engenharia: 'engineering',
  Equipamentos: 'equipment',
  'Formação & Certificação': 'certification',
  Materiais: 'materials',
  Offshore: 'offshore',
  Consultoria: 'consulting',
};

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
    return (this.category && CATEGORY_ICON[this.category]) || 'box';
  }
}
