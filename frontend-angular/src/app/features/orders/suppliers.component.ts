// Porta de frontend/src/pages/comprador/Suppliers.jsx — diretório de
// fornecedores do Comprador, com KPIs, abas de estado e Top 5 por avaliação.
import { Component, computed, signal } from '@angular/core';
import { BuyerSuppliersService } from './buyer-suppliers.service';
import { BuyerSuppliersResponse } from '../../core/models/marketplace-extra.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDate, joinNonEmpty } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { KpiRowComponent, KpiCard } from '../../shared/buyer-ui/kpi-row.component';
import { TabsComponent, TabDef } from '../../shared/buyer-ui/tabs.component';
import { ToolbarComponent } from '../../shared/buyer-ui/toolbar.component';
import { PillComponent } from '../../shared/buyer-ui/pill.component';
import { SupplierCellComponent } from '../../shared/buyer-ui/supplier-cell.component';
import { EmptyRowComponent } from '../../shared/buyer-ui/empty-row.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { IconComponent } from '../../shared/components/icon.component';
import { StarsComponent } from '../../shared/components/stars.component';

const TABS: TabDef[] = [
  { key: '', label: 'Todos' },
  { key: 'ATIVOS', label: 'Ativos' },
  { key: 'AVALIACAO', label: 'Em Avaliação' },
  { key: 'HOMOLOGADOS', label: 'Homologados' },
];

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [
    CrumbsComponent,
    BuyerPageHeadComponent,
    KpiRowComponent,
    TabsComponent,
    ToolbarComponent,
    PillComponent,
    SupplierCellComponent,
    EmptyRowComponent,
    ErrorBannerComponent,
    IconComponent,
    StarsComponent,
  ],
  templateUrl: './suppliers.component.html',
})
export class SuppliersComponent {
  readonly TABS = TABS;
  readonly tab = signal('');
  readonly q = signal('');
  readonly data = signal<BuyerSuppliersResponse | null>(null);
  readonly error = signal('');

  readonly formatDate = formatDate;
  readonly joinNonEmpty = joinNonEmpty;

  readonly top = computed(() =>
    (this.data()?.items || [])
      .filter((s) => s.rating)
      .slice()
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 5),
  );

  readonly kpis = computed<KpiCard[]>(() => {
    const k = this.data()?.kpis;
    return [
      { icon: 'suppliers', tone: 'info', label: 'Total de Fornecedores', value: k?.total ?? '—', sub: 'Cadastrados' },
      { icon: 'building', tone: 'success', label: 'Fornecedores Ativos', value: k?.ativos ?? '—', sub: 'Aprovados' },
      { icon: 'certification', tone: 'info', label: 'Novos Fornecedores', value: k?.novos ?? '—', sub: 'Últimos 30 dias' },
      { icon: 'approvals', tone: 'pending', label: 'Em Avaliação', value: k?.emAvaliacao ?? '—', sub: 'Documentação pendente' },
      { icon: 'shield', tone: 'success', label: 'Homologados', value: k?.homologados ?? '—', sub: 'Aprovados' },
    ];
  });

  constructor(private readonly buyerSuppliersService: BuyerSuppliersService) {
    this.load();
  }

  private load(): void {
    this.error.set('');
    this.buyerSuppliersService.list(this.tab() || undefined, this.q() || undefined).subscribe({
      next: (data) => this.data.set(data),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  onTab(key: string): void {
    this.tab.set(key);
    this.load();
  }

  onQ(valor: string): void {
    this.q.set(valor);
    this.load();
  }

  statusLabel(status: string): string {
    return status === 'APROVADA' ? 'Ativo' : 'Em Avaliação';
  }
}
