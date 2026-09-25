// Porta de KpiRow em frontend/src/components/BuyerUI.jsx:62-86.
import { Component, Input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../components/icon.component';

export interface KpiCard {
  icon: string;
  tone?: string;
  label: string;
  value: string | number;
  sub: string;
  to?: string;
}

@Component({
  selector: 'app-kpi-row',
  standalone: true,
  imports: [RouterLink, IconComponent, NgTemplateOutlet],
  template: `
    <div class="bz-kpis">
      @for (c of cards; track c.label) {
        @if (!c.to) {
          <div class="bz-kpi">
            <ng-container *ngTemplateOutlet="corpo; context: { c: c }"></ng-container>
          </div>
        } @else {
          <a class="bz-kpi bz-kpi-link" [routerLink]="c.to">
            <ng-container *ngTemplateOutlet="corpo; context: { c: c }"></ng-container>
          </a>
        }
      }
    </div>
    <ng-template #corpo let-c="c">
      <div [class]="'bz-kpi-ico ' + (c.tone || 'info')"><app-icon [name]="c.icon" [size]="20"></app-icon></div>
      <div class="bz-kpi-body">
        <span class="bz-kpi-label">{{ c.label }}</span>
        <strong class="bz-kpi-value">{{ c.value }}</strong>
        <span class="bz-kpi-sub">{{ c.sub }}</span>
      </div>
    </ng-template>
  `,
})
export class KpiRowComponent {
  @Input() cards: KpiCard[] = [];
}
