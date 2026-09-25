// Porta de SuccessBanner em frontend/src/components/Common.jsx:118-122.
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-success-banner',
  standalone: true,
  template: `
    @if (message) {
      <div class="banner banner-success">{{ message }}</div>
    }
  `,
})
export class SuccessBannerComponent {
  @Input() message: string | null = null;
}
