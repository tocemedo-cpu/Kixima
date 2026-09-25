// Porta de frontend/src/pages/adminSistema/Companies.jsx. Directório de
// empresas credenciadas (Admin Sistema) — filtros de tipo/estado, expandir
// uma linha mostra a ficha detalhada. Reutiliza CompaniesService/
// CompanyListItem/CompanyDetail já existentes (DueDiligence.jsx).
import { Component, signal } from '@angular/core';
import { CompaniesService } from './companies.service';
import { CompanyDetail, CompanyListItem, CompanyStatus } from '../../core/models/company.model';
import { ApiError } from '../../core/models/api-error.model';
import { COMPANY_STATUS, formatDate } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { DataTableComponent } from '../../shared/components/data-table.component';
import { TableColumnDirective } from '../../shared/components/table-column.directive';
import { BadgeComponent } from '../../shared/components/badge.component';

@Component({
  selector: 'app-admin-companies',
  standalone: true,
  imports: [PageHeaderComponent, ErrorBannerComponent, LoadingComponent, DataTableComponent, TableColumnDirective, BadgeComponent],
  templateUrl: './admin-companies.component.html',
})
export class AdminCompaniesComponent {
  readonly companies = signal<CompanyListItem[] | null>(null);
  readonly error = signal('');
  readonly typeFilter = signal('');
  readonly statusFilter = signal('');
  readonly expanded = signal<string | null>(null);
  readonly expandedCompany = signal<CompanyDetail | null>(null);

  readonly COMPANY_STATUS = COMPANY_STATUS;
  readonly COMPANY_STATUS_KEYS = Object.keys(COMPANY_STATUS) as CompanyStatus[];
  readonly formatDate = formatDate;

  constructor(private readonly companiesService: CompaniesService) {
    this.load();
  }

  private load(): void {
    this.companiesService.list(this.statusFilter() || undefined, this.typeFilter() || undefined).subscribe({
      next: (data) => this.companies.set(data),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  setType(v: string): void {
    this.typeFilter.set(v);
    this.load();
  }

  setStatus(v: string): void {
    this.statusFilter.set(v);
    this.load();
  }

  toggle(row: CompanyListItem): void {
    if (this.expanded() === row.id) {
      this.expanded.set(null);
      this.expandedCompany.set(null);
      return;
    }
    this.expanded.set(row.id);
    this.expandedCompany.set(null);
    this.companiesService.get(row.id).subscribe({ next: (c) => this.expandedCompany.set(c), error: () => {} });
  }
}
