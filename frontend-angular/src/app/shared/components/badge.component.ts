// Porta de frontend/src/components/Badge.jsx (sem a tradução automática —
// pendente, ver shared/domain.ts).
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-badge',
  standalone: true,
  template: `<span [class]="'badge badge-' + tone"><ng-content></ng-content></span>`,
})
export class BadgeComponent {
  @Input() tone: 'neutral' | 'pending' | 'info' | 'success' | 'danger' = 'neutral';
}
