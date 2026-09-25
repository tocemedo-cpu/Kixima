// Porta de frontend/src/components/Badge.jsx (sem a tradução automática —
// pendente, ver shared/domain.ts).
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-badge',
  standalone: true,
  template: `<span [class]="'badge badge-' + tone"><ng-content></ng-content></span>`,
})
export class BadgeComponent {
  // `string | undefined` (não a união estrita de tons) porque quem chama
  // muitas vezes lê o tom de um mapa (PO_STATUS[status]?.tone), tipado como
  // string genérica — o React aceitava exactamente o mesmo (`tone={string}`,
  // sem validação de tipo em tempo de execução).
  @Input() tone: string | undefined = 'neutral';
}
