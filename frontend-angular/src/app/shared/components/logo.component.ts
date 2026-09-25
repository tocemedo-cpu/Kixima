// Porta de frontend/src/components/Logo.jsx. Mesmas duas imagens (marca e
// marca invertida), copiadas para public/brand/ — Angular serve tudo o que
// está em public/ na raiz (ver angular.json, assets: [{glob:'**/*', input:'public'}]).
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <div class="brand-logo">
      <span class="brand-mark" [style.width.px]="box" [style.height.px]="box" aria-hidden="true">
        <img [src]="light ? '/brand/kixima-mark-reversed.png' : '/brand/kixima-mark.png'" alt="KIXIMA"
             style="width:100%;height:100%;object-fit:contain;display:block">
      </span>
      <span class="brand-text">
        <span [class]="'brand-word' + (light ? ' brand-word-light' : '')" [style.font-size.px]="size">
          KIXIMA@if (net) {<i class="brand-net">.NET</i>}
        </span>
        @if (subtitle) {
          <span [class]="'brand-sub' + (light ? ' brand-sub-light' : '')">Plataforma de Procurement Garantido</span>
        }
      </span>
    </div>
  `,
})
export class LogoComponent {
  @Input() size = 22;
  @Input() subtitle = false;
  @Input() light = false;
  @Input() mark?: number;
  @Input() net = false;

  get box(): number {
    return this.mark ?? Math.round(this.size * 2.4);
  }
}
