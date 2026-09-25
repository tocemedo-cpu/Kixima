// Coluna de <app-data-table>: `<ng-template appTableColumn key="..." header="...">`
// com a própria linha disponível como contexto (`let-r`). Ver
// data-table.component.ts. O contexto não é genérico de propósito — tal como
// o `render(row)` de DataTable.jsx original, que também não tinha o tipo de
// `row` verificado em tempo de compilação dentro de cada coluna.
import { Directive, Input, TemplateRef } from '@angular/core';

@Directive({ selector: '[appTableColumn]', standalone: true })
export class TableColumnDirective {
  @Input({ required: true }) key = '';
  @Input({ required: true }) header = '';

  constructor(readonly templateRef: TemplateRef<{ $implicit: unknown }>) {}

  static ngTemplateContextGuard(dir: TableColumnDirective, ctx: unknown): ctx is { $implicit: any } {
    return true;
  }
}
