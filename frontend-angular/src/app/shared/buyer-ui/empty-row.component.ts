// Porta de EmptyRow em frontend/src/components/BuyerUI.jsx:139-142.
import { Component } from '@angular/core';

@Component({
  selector: 'app-empty-row',
  standalone: true,
  template: `<div class="bz-empty"><ng-content></ng-content></div>`,
})
export class EmptyRowComponent {}
