// Porta de Kpi em frontend/src/pages/comprador/Home.jsx:204-213 — local a
// esta página de propósito (tem `tone` e disposição próprias, distintas do
// KpiRow partilhado usado por Company Admin/Financeiro).
import { Component, Input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-comprador-kpi',
  standalone: true,
  imports: [RouterLink, IconComponent, NgTemplateOutlet],
  template: `
    @if (!to) {
      <div [class]="'kpi kpi-' + tone">
        <ng-container *ngTemplateOutlet="corpo"></ng-container>
      </div>
    } @else {
      <a [class]="'kpi kpi-' + tone + ' kpi-link'" [routerLink]="to">
        <ng-container *ngTemplateOutlet="corpo"></ng-container>
      </a>
    }
    <ng-template #corpo>
      <div class="kpi-body">
        <div class="kpi-label">{{ label }}</div>
        <div class="kpi-value">{{ value }}</div>
        <div class="kpi-sub">{{ sub }}</div>
      </div>
      <span class="kpi-ico"><app-icon [name]="icon" [size]="20"></app-icon></span>
    </ng-template>
  `,
})
export class CompradorKpiComponent {
  @Input({ required: true }) icon = '';
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input() sub = '';
  @Input({ required: true }) tone = '';
  @Input() to?: string;
}
