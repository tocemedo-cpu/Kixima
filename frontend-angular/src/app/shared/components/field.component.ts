// Porta de Field em frontend/src/components/Common.jsx:124-152 — rótulo
// LIGADO ao controlo (a mesma razão de acessibilidade do original: um leitor
// de ecrã só anuncia o campo se o <label> tiver htmlFor/id, e clicar no
// rótulo só põe o cursor no campo com essa ligação).
//
// Uso: <app-field label="NIF" [obrigatorio]="true" #f="appField">
//        <input [id]="f.id" ... />
//      </app-field>
// (o Field original em React injectava o id via render-prop; em Angular
// expõe-se o id como propriedade pública lida pelo pai via referência de
// template, que é o equivalente idiomático.)
import { Component, Input } from '@angular/core';

let proximoId = 0;

@Component({
  selector: 'app-field',
  standalone: true,
  exportAs: 'appField',
  template: `
    <div class="field">
      <label [attr.for]="id">
        {{ label }}
        @if (obrigatorio) {
          <span aria-hidden="true" style="color: var(--brand-600)"> *</span>
        }
      </label>
      <ng-content></ng-content>
      @if (hint) {
        <small class="helptext">{{ hint }}</small>
      }
    </div>
  `,
})
export class FieldComponent {
  @Input({ required: true }) label = '';
  @Input() hint?: string;
  @Input() obrigatorio = false;

  readonly id = `campo-${(proximoId += 1)}`;
}
