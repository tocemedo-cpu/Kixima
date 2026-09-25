// Porta de Loading em frontend/src/components/Common.jsx:63-66.
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading',
  standalone: true,
  template: `<div class="loading-text">{{ label }}</div>`,
})
export class LoadingComponent {
  @Input() label = 'A carregar…';
}
