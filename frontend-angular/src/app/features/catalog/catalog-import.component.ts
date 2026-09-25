// Porta de frontend/src/pages/fornecedor/CatalogImport.jsx. Importação de
// catálogo em massa (Excel .xlsx) — liga a POST /api/catalog/import.
import { Component, computed, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { PlansService } from '../../core/services/plans.service';
import { CatalogService } from './catalog.service';
import { PlanoDto } from '../../core/models/plan.model';
import { CatalogImportResult } from '../../core/models/catalog-import.model';
import { ApiError } from '../../core/models/api-error.model';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { FieldComponent } from '../../shared/components/field.component';

@Component({
  selector: 'app-catalog-import',
  standalone: true,
  imports: [PageHeaderComponent, ErrorBannerComponent, SuccessBannerComponent, FieldComponent],
  templateUrl: './catalog-import.component.html',
})
export class CatalogImportComponent {
  readonly file = signal<File | null>(null);
  readonly busy = signal(false);
  readonly error = signal<string | ApiError | null>(null);
  readonly result = signal<CatalogImportResult | null>(null);
  readonly planos = signal<PlanoDto[] | null>(null);

  readonly meuPlano = computed<PlanoDto | null>(() => {
    const alvo = this.auth.user()?.companyPlan || 'BASE';
    return (this.planos() || []).find((p) => p.plano === alvo) || null;
  });

  // A importação em massa é uma funcionalidade Pro — hoje só se descobria
  // com o erro do backend, depois de já se ter escolhido o ficheiro. Avisa antes.
  readonly semAcesso = computed(() => {
    const plano = this.meuPlano();
    return !!plano && !plano.features.carregamentoEmMassa;
  });

  constructor(
    private readonly auth: AuthService,
    private readonly plansService: PlansService,
    private readonly catalogService: CatalogService,
  ) {
    this.plansService.planos().subscribe({ next: (r) => this.planos.set(r.planos), error: () => {} });
  }

  onFileChange(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    this.file.set(input.files?.[0] || null);
    this.result.set(null);
  }

  async handleSubmit(): Promise<void> {
    this.error.set(null);
    this.result.set(null);
    const f = this.file();
    if (!f) {
      this.error.set('Escolha um ficheiro Excel (.xlsx).');
      return;
    }
    this.busy.set(true);
    try {
      const res = await new Promise<CatalogImportResult>((resolve, reject) => {
        this.catalogService.importCatalog(f).subscribe({ next: resolve, error: reject });
      });
      this.result.set(res);
    } catch (e) {
      this.error.set(e as ApiError);
    } finally {
      this.busy.set(false);
    }
  }

  fileSizeKb(): number {
    const f = this.file();
    return f ? Math.round(f.size / 1024) : 0;
  }
}
