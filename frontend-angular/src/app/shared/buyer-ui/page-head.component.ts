// Porta de PageHead em frontend/src/components/BuyerUI.jsx:49-60. Distinto
// de shared/components/page-header.component.ts (classes CSS diferentes:
// bz-head, usado nos ecrãs "Bancada" do Comprador) — por isso um nome
// próprio (app-buyer-page-head) em vez de colidir com app-page-header.
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-buyer-page-head',
  standalone: true,
  template: `
    <div class="bz-head">
      <div>
        <h1 class="bz-title">{{ title }}</h1>
        @if (subtitle) {
          <p class="bz-sub">{{ subtitle }}</p>
        }
      </div>
      <div class="bz-head-actions"><ng-content></ng-content></div>
    </div>
  `,
})
export class BuyerPageHeadComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle?: string;
}
