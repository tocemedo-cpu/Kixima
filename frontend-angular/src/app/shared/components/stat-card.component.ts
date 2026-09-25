// Porta de StatCard em frontend/src/components/Common.jsx:35-47.
import { Component, Input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    @if (!to) {
      <div class="card stat-card">
        <ng-container *ngTemplateOutlet="corpo"></ng-container>
      </div>
    } @else {
      <a [routerLink]="to" class="card stat-card stat-card-link">
        <ng-container *ngTemplateOutlet="corpo"></ng-container>
      </a>
    }
    <ng-template #corpo>
      <div class="stat-label">{{ label }}</div>
      <div class="stat-value">{{ value }}</div>
      @if (sub) {
        <div class="stat-sub">{{ sub }}</div>
      }
    </ng-template>
  `,
})
export class StatCardComponent {
  @Input({ required: true }) label = '';
  @Input({ required: true }) value: string | number = '';
  @Input() sub?: string;
  @Input() to?: string;
}
