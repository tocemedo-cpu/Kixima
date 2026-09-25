// Porta de Pill em frontend/src/components/BuyerUI.jsx:101-108.
import { Component, Input } from '@angular/core';

const TONES: Record<string, string> = {
  success: 'bz-pill-success', pending: 'bz-pill-pending', info: 'bz-pill-info',
  danger: 'bz-pill-danger', neutral: 'bz-pill-neutral',
};

@Component({
  selector: 'app-pill',
  standalone: true,
  template: `<span [class]="'bz-pill ' + classeDoTom"><ng-content></ng-content></span>`,
})
export class PillComponent {
  // `| undefined` — quem chama muitas vezes lê o tom de um mapa
  // (PO_STATUS[status]?.tone) que pode não ter entrada; cai no tom por
  // omissão tal como o React fazia com `tone={statusInfo.tone}` (undefined).
  @Input() tone: string | undefined = 'neutral';

  get classeDoTom(): string {
    return (this.tone && TONES[this.tone]) || TONES['neutral'];
  }
}
