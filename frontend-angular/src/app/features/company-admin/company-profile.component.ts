// Porta de frontend/src/pages/companyAdmin/CompanyProfile.jsx.
import { Component, computed, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CompaniesService } from '../admin/companies.service';
import { PoliciesService } from './policies.service';
import { CompanyDetail } from '../../core/models/company.model';
import { CompanyPoliciesDto } from '../../core/models/company-policies.model';
import { ApiError } from '../../core/models/api-error.model';
import { COMPANY_STATUS, POLICY_STATUS, formatDate, formatMoney } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { BadgeComponent } from '../../shared/components/badge.component';

@Component({
  selector: 'app-company-profile',
  standalone: true,
  imports: [PageHeaderComponent, LoadingComponent, ErrorBannerComponent, BadgeComponent],
  templateUrl: './company-profile.component.html',
})
export class CompanyProfileComponent {
  readonly company = signal<CompanyDetail | null>(null);
  readonly policies = signal<CompanyPoliciesDto | null>(null);
  readonly error = signal('');

  readonly COMPANY_STATUS = COMPANY_STATUS;
  readonly POLICY_STATUS = POLICY_STATUS;
  formatDate = formatDate;
  formatMoney = formatMoney;

  readonly clientPolicy = computed(() => this.policies()?.kiximaToClient?.[0] ?? null);

  constructor(
    auth: AuthService,
    companiesService: CompaniesService,
    policiesService: PoliciesService,
  ) {
    const companyId = auth.user()!.companyId!;
    forkJoin({
      company: companiesService.get(companyId),
      policies: policiesService.forCompany(companyId),
    }).subscribe({
      next: ({ company, policies }) => {
        this.company.set(company);
        this.policies.set(policies);
      },
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }
}
