// Porta de Tabs em frontend/src/components/BuyerUI.jsx:88-99.
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface TabDef {
  key: string;
  label: string;
  count?: number;
}

@Component({
  selector: 'app-tabs',
  standalone: true,
  template: `
    <div class="bz-tabs">
      @for (t of tabs; track t.key) {
        <button [class]="'bz-tab' + (value === t.key ? ' on' : '')" (click)="onChange.emit(t.key)">
          {{ t.label }}
          @if (t.count != null) {
            <span class="bz-tab-count">{{ t.count }}</span>
          }
        </button>
      }
    </div>
  `,
})
export class TabsComponent {
  @Input() tabs: TabDef[] = [];
  @Input() value = '';
  @Output() onChange = new EventEmitter<string>();
}
