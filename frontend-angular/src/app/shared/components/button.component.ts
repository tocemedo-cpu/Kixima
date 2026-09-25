// Porta de frontend/src/components/Button.jsx. Mesmo mapeamento papel→classe
// CSS (nenhuma aparência nova) e a mesma razão para existir `to`/`href`: um
// botão que navega tem de ser uma hiperligação real, não um <button> com
// onClick — para abrir em nova aba e ser anunciado como ligação.
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

const VARIANTES: Record<string, string> = {
  primary: 'btn-accent',
  secondary: 'btn-ghost',
  danger: 'btn-danger',
  dark: 'btn-dark',
};
const TAMANHOS: Record<string, string> = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (to) {
      <a [routerLink]="to" [class]="classes"><ng-content></ng-content></a>
    } @else if (href) {
      <a [href]="href" [class]="classes"><ng-content></ng-content></a>
    } @else {
      <button type="button" [class]="classes" [disabled]="disabled" (click)="clicked.emit()"><ng-content></ng-content></button>
    }
  `,
})
export class ButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'danger' | 'dark' = 'secondary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() to?: string;
  @Input() href?: string;
  @Input() disabled = false;
  @Input() extraClass = '';

  @Output() clicked = new EventEmitter<void>();

  get classes(): string {
    return ['btn', VARIANTES[this.variant] || VARIANTES['secondary'], TAMANHOS[this.size] || '', this.extraClass]
      .filter(Boolean)
      .join(' ');
  }
}
