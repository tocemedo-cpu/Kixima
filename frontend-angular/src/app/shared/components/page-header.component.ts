// Porta de PageHeader em frontend/src/components/Common.jsx:50-61.
// A tradução (tr()) ainda não foi portada — ver nota em shared/domain.ts.
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="page-header">
      <div>
        <h1>{{ title }}</h1>
        @if (subtitle) {
          <p>{{ subtitle }}</p>
        }
      </div>
      <ng-content select="[action]"></ng-content>
    </div>
  `,
})
export class PageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle?: string;
}
