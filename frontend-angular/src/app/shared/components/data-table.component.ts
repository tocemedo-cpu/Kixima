// Porta de DataTable em frontend/src/components/DataTable.jsx. Colunas
// definidas por content-projection com `appTableColumn` — ver
// table-column.directive.ts. Uso:
//   <app-data-table [rows]="orders()" rowKey="id" (rowClick)="ver($event)">
//     <ng-template appTableColumn key="reference" header="Referência" let-r>
//       <span class="mono">{{ r.reference }}</span>
//     </ng-template>
//   </app-data-table>
import { AfterContentInit, Component, ContentChildren, EventEmitter, Input, Output, QueryList } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TableColumnDirective } from './table-column.directive';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    @if (!rows || rows.length === 0) {
      <div class="empty-state">
        <h3>{{ emptyTitle }}</h3>
        <p>{{ emptyBody }}</p>
      </div>
    } @else {
      <table>
        <thead>
          <tr>
            @for (col of colunas; track col.key) {
              <th>{{ col.header }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows; track rowIndex($index, row)) {
            <tr [class.row-link]="rowClick.observed" (click)="onRowClick(row)">
              @for (col of colunas; track col.key) {
                <td><ng-container *ngTemplateOutlet="col.templateRef; context: { $implicit: row }"></ng-container></td>
              }
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class DataTableComponent<T = Record<string, unknown>> implements AfterContentInit {
  @Input() rows: T[] | null = null;
  @Input({ required: true }) rowKey!: keyof T;
  @Input() emptyTitle = 'Nada por aqui ainda';
  @Input() emptyBody = 'Quando houver registos, vão aparecer nesta lista.';
  @Output() readonly rowClick = new EventEmitter<T>();

  @ContentChildren(TableColumnDirective) private readonly colunasQuery!: QueryList<TableColumnDirective>;
  colunas: TableColumnDirective[] = [];

  ngAfterContentInit(): void {
    this.colunas = this.colunasQuery.toArray();
  }

  rowIndex(index: number, row: T): unknown {
    return row[this.rowKey] ?? index;
  }

  onRowClick(row: T): void {
    if (this.rowClick.observed) this.rowClick.emit(row);
  }
}
