// Porta de frontend/src/pages/adminSistema/DueDiligence.jsx.
import { Component, signal } from '@angular/core';
import { CompaniesService } from './companies.service';
import { CompanyListItem } from '../../core/models/company.model';
import { ApiError } from '../../core/models/api-error.model';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { CompanyReviewCardComponent } from './company-review-card.component';

@Component({
  selector: 'app-due-diligence',
  standalone: true,
  imports: [PageHeaderComponent, LoadingComponent, ErrorBannerComponent, CompanyReviewCardComponent],
  templateUrl: './due-diligence.component.html',
})
export class DueDiligenceComponent {
  readonly companies = signal<CompanyListItem[] | null>(null);
  readonly error = signal('');
  readonly expandedId = signal<string | null>(null);

  constructor(private readonly companiesService: CompaniesService) {
    this.load();
  }

  reload(): void {
    this.load();
  }

  private load(): void {
    this.companiesService.list('PENDENTE').subscribe({
      next: (companies) => this.companies.set(companies),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  toggle(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }
}
