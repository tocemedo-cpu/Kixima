// Porta de CompanyReviewCard em frontend/src/pages/adminSistema/DueDiligence.jsx:55-166.
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CompaniesService } from './companies.service';
import { CompanyDetail, CompanyListItem } from '../../core/models/company.model';
import { ApiError } from '../../core/models/api-error.model';
import { COMPANY_STATUS, POLICY_STATUS, formatDate, formatMoney } from '../../shared/domain';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { BadgeComponent } from '../../shared/components/badge.component';
import { IconComponent } from '../../shared/components/icon.component';

const DOC_LABELS: Record<string, string> = {
  CERTIDAO_COMERCIAL: 'Certidão Comercial',
  ALVARA_COMERCIAL: 'Alvará Comercial',
  LICENCA_ANPG: 'Licença da ANPG',
};

@Component({
  selector: 'app-company-review-card',
  standalone: true,
  imports: [LoadingComponent, ErrorBannerComponent, SuccessBannerComponent, BadgeComponent, IconComponent],
  templateUrl: './company-review-card.component.html',
})
export class CompanyReviewCardComponent implements OnChanges {
  @Input({ required: true }) company!: CompanyListItem;
  @Input() expanded = false;
  @Output() toggle = new EventEmitter<void>();
  @Output() decided = new EventEmitter<void>();

  detail: CompanyDetail | null = null;
  error = '';
  success = '';
  busy = false;

  readonly COMPANY_STATUS = COMPANY_STATUS;
  readonly POLICY_STATUS = POLICY_STATUS;
  readonly DOC_LABELS = DOC_LABELS;
  formatDate = formatDate;
  formatMoney = formatMoney;

  constructor(private readonly companiesService: CompaniesService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['expanded'] && this.expanded && !this.detail) {
      this.companiesService.get(this.company.id).subscribe({
        next: (detail) => (this.detail = detail),
        error: (e) => (this.error = e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
      });
    }
  }

  get supplierPolicy() {
    return this.detail?.supplierPolicies?.[0] ?? null;
  }

  get canApprove(): boolean {
    return this.company.type === 'CLIENTE' || Boolean(this.supplierPolicy);
  }

  docLabel(type: string): string {
    return DOC_LABELS[type] || type;
  }

  async decide(approve: boolean): Promise<void> {
    this.busy = true;
    this.error = '';
    this.success = '';
    try {
      await new Promise<void>((resolve, reject) => {
        this.companiesService.decide(this.company.id, { approve }).subscribe({
          next: () => resolve(),
          error: (e) => reject(e),
        });
      });
      this.success = approve ? 'Empresa aprovada.' : 'Cadastro rejeitado.';
      this.decided.emit();
    } catch (e) {
      this.error = e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.';
    } finally {
      this.busy = false;
    }
  }
}
