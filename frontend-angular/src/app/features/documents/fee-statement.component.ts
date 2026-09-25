// Porta de frontend/src/pages/shared/FeeStatement.jsx. Extrato/documento de
// cobrança da Taxa KIXIMA de um fornecedor (folha A4 imprimível). Reutiliza
// PlatformFeesService.forCompany()/PlatformFeeStatementDto já confirmados e
// usados por SupplierFinanceCenter (financeiro/Home.jsx).
import { Component, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { PlatformFeesService } from '../admin/platform-fees.service';
import { PlatformFeeStatementDto } from '../../core/models/platform-fee.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatMoneyDoc, formatDateDoc } from '../../shared/print-document';
import { joinNonEmpty } from '../../shared/domain';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';

@Component({
  selector: 'app-fee-statement',
  standalone: true,
  imports: [LoadingComponent, ErrorBannerComponent],
  templateUrl: './fee-statement.component.html',
})
export class FeeStatementComponent {
  readonly data = signal<PlatformFeeStatementDto | null>(null);
  readonly error = signal('');

  readonly formatMoneyDoc = formatMoneyDoc;
  readonly formatDateDoc = formatDateDoc;
  readonly joinNonEmpty = joinNonEmpty;

  constructor(
    route: ActivatedRoute,
    private readonly platformFeesService: PlatformFeesService,
    private readonly location: Location,
  ) {
    const companyId = route.snapshot.paramMap.get('companyId') || '';
    this.platformFeesService.forCompany(companyId).subscribe({
      next: (d) => this.data.set(d),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  voltar(): void {
    this.location.back();
  }

  imprimir(): void {
    window.print();
  }

  percentAcima(v: number): string {
    return `${((v || 0.002) * 100).toFixed(2).replace('.', ',')}%`;
  }

  limiar(v: number, cur: string): string {
    return formatMoneyDoc(v || 11500, cur);
  }
}
