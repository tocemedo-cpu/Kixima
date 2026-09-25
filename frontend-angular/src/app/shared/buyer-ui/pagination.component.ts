// Porta de Pagination em frontend/src/components/BuyerUI.jsx:144-176.
import { Component, EventEmitter, Input, Output } from '@angular/core';

function pageNumbers(cur: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const s = Math.max(2, cur - 1);
  const e = Math.min(total - 1, cur + 1);
  if (s > 2) out.push('…');
  for (let i = s; i <= e; i++) out.push(i);
  if (e < total - 1) out.push('…');
  out.push(total);
  return out;
}

@Component({
  selector: 'app-pagination',
  standalone: true,
  template: `
    @if (!pages || pages <= 1) {
      @if (total != null && total > 0) {
        <div class="bz-pagcount">{{ total.toLocaleString('pt-PT') }} {{ unit }}</div>
      }
    } @else {
      <div class="bz-pag">
        <button class="btn btn-ghost btn-sm" [disabled]="page <= 1" (click)="onPage.emit(page - 1)">← Anterior</button>
        @for (n of numeros; track $index) {
          @if (n === '…') {
            <span class="bz-pag-ell">…</span>
          } @else {
            <button [class]="'bz-pagn' + (n === page ? ' on' : '')" (click)="onPage.emit(n)">{{ n }}</button>
          }
        }
        <button class="btn btn-ghost btn-sm" [disabled]="page >= pages" (click)="onPage.emit(page + 1)">Próximo →</button>
        @if (total != null) {
          <span class="bz-pagcount">{{ total.toLocaleString('pt-PT') }} {{ unit }}</span>
        }
      </div>
    }
  `,
})
export class PaginationComponent {
  @Input({ required: true }) page = 1;
  @Input({ required: true }) pages = 1;
  @Input() total: number | null = null;
  @Input() unit = 'registos';
  @Output() onPage = new EventEmitter<number>();

  get numeros(): (number | '…')[] {
    return pageNumbers(this.page, this.pages);
  }
}
