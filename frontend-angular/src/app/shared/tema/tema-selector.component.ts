// Porta de SeletorDeFundo em frontend/src/tema/TemaContext.jsx:88-105.
import { Component, Input } from '@angular/core';
import { TemaService } from './tema.service';

@Component({
  selector: 'app-tema-selector',
  standalone: true,
  template: `
    <div [class]="'tema' + (compacto ? ' tema-compacto' : '')" role="group" aria-label="Fundo">
      @for (op of tema.TEMAS; track op.id) {
        <button
          type="button"
          [attr.data-tema]="op.id"
          [attr.aria-pressed]="tema.tema() === op.id"
          [title]="op.titulo"
          (click)="tema.setTema(op.id)"
        >{{ op.label }}</button>
      }
    </div>
  `,
})
export class TemaSelectorComponent {
  @Input() compacto = false;
  constructor(readonly tema: TemaService) {}
}
