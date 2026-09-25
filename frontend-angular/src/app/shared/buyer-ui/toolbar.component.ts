// Porta de Toolbar em frontend/src/components/BuyerUI.jsx:110-124.
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconComponent } from '../components/icon.component';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="bz-toolbar">
      <div class="bz-search">
        <app-icon name="search" [size]="16"></app-icon>
        <input [value]="q" (input)="onQ.emit($any($event.target).value)" [placeholder]="placeholder">
      </div>
      <div class="bz-toolbar-right">
        <ng-content></ng-content>
        <button class="btn btn-ghost btn-sm"><app-icon name="report" [size]="14"></app-icon> Filtros</button>
      </div>
    </div>
  `,
})
export class ToolbarComponent {
  @Input() placeholder = 'Pesquisar…';
  @Input() q = '';
  @Output() onQ = new EventEmitter<string>();
}
