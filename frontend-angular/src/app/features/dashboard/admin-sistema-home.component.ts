// Porta de frontend/src/pages/adminSistema/Home.jsx.
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CompaniesService } from '../admin/companies.service';
import { CompanyListItem } from '../../core/models/company.model';
import { ApiError } from '../../core/models/api-error.model';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { StatCardComponent } from '../../shared/components/stat-card.component';

@Component({
  selector: 'app-admin-sistema-home',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, LoadingComponent, ErrorBannerComponent, StatCardComponent],
  templateUrl: './admin-sistema-home.component.html',
})
export class AdminSistemaHomeComponent {
  readonly companies = signal<CompanyListItem[] | null>(null);
  readonly error = signal('');
  readonly semAcesso = signal(false);

  readonly pendentes = computed(() => (this.companies() || []).filter((c) => c.status === 'PENDENTE'));
  readonly aprovadas = computed(() => (this.companies() || []).filter((c) => c.status === 'APROVADA'));

  constructor(private readonly companiesService: CompaniesService) {
    // Um 403 aqui não é uma falha — é um assessor cuja área não inclui
    // Cadastro & Empresas. Este painel é inteiro sobre isso (cadastros
    // pendentes, empresas ativas); mostrar o banner de erro vermelho da
    // aplicação assustaria alguém a fazer exatamente o que devia — entrar
    // com a conta que lhe foi dada.
    this.companiesService.list().subscribe({
      next: (companies) => this.companies.set(companies),
      error: (e) => {
        if (e instanceof ApiError && e.status === 403) this.semAcesso.set(true);
        else this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
      },
    });
  }
}
