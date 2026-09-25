// Porta de frontend/src/pages/adminSistema/PlatformFees.jsx.
import { Component, computed, signal } from '@angular/core';
import { PlatformFeesService } from './platform-fees.service';
import { PlatformFeeBookDto } from '../../core/models/platform-fee.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDateTime, formatMoney } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { KpiRowComponent, KpiCard } from '../../shared/buyer-ui/kpi-row.component';
import { PillComponent } from '../../shared/buyer-ui/pill.component';
import { ToolbarComponent } from '../../shared/buyer-ui/toolbar.component';
import { EmptyRowComponent } from '../../shared/buyer-ui/empty-row.component';
import { TabsComponent, TabDef } from '../../shared/buyer-ui/tabs.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';

const STATUS_TONE: Record<string, string> = { PENDENTE: 'pending', COBRADO: 'success' };
const STATUS_LABEL: Record<string, string> = { PENDENTE: 'Pendente', COBRADO: 'Cobrada' };
const TABS: TabDef[] = [
  { key: '', label: 'Todas' }, { key: 'PENDENTE', label: 'Pendentes' }, { key: 'COBRADO', label: 'Cobradas' },
];

@Component({
  selector: 'app-platform-fees',
  standalone: true,
  imports: [
    CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, PillComponent, ToolbarComponent,
    EmptyRowComponent, TabsComponent, SuccessBannerComponent,
  ],
  templateUrl: './platform-fees.component.html',
})
export class PlatformFeesComponent {
  readonly tabs = TABS;
  readonly data = signal<PlatformFeeBookDto | null>(null);
  readonly tab = signal('');
  readonly q = signal('');
  readonly error = signal('');
  readonly sucesso = signal('');
  readonly busy = signal('');

  readonly STATUS_TONE = STATUS_TONE;
  readonly STATUS_LABEL = STATUS_LABEL;
  formatMoney = formatMoney;
  formatDateTime = formatDateTime;

  readonly kpiCards = computed<KpiCard[]>(() => {
    const k = this.data()?.kpis;
    return [
      { icon: 'payment', tone: 'info', label: 'Taxas geradas', value: k?.total ?? '—', sub: 'Total de registos' },
      { icon: 'wallet', tone: 'success', label: 'Valor total', value: k ? formatMoney(k.totalAOA, 'USD') : '—', sub: 'Acumulado' },
      { icon: 'invoice', tone: 'pending', label: 'Por cobrar', value: k ? formatMoney(k.pendingAOA, 'USD') : '—', sub: 'Pendentes' },
      { icon: 'orders', tone: 'success', label: 'Cobradas', value: k?.cobradas ?? '—', sub: 'Liquidadas' },
    ];
  });

  readonly fees = computed(() => {
    let fees = this.data()?.fees || [];
    if (this.tab()) fees = fees.filter((f) => f.status === this.tab());
    const termo = this.q().toLowerCase();
    if (termo) {
      fees = fees.filter((f) => (f.company?.name || '').toLowerCase().includes(termo) || (f.invoice?.reference || '').toLowerCase().includes(termo));
    }
    return fees;
  });

  constructor(private readonly platformFeesService: PlatformFeesService) {
    this.load();
  }

  private load(): void {
    this.platformFeesService.list().subscribe({
      next: (data) => this.data.set(data),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  async charge(id: string): Promise<void> {
    this.busy.set(id);
    this.error.set('');
    try {
      await new Promise<void>((resolve, reject) => {
        this.platformFeesService.charge(id).subscribe({ next: () => resolve(), error: (e) => reject(e) });
      });
      this.sucesso.set('Taxa marcada como cobrada.');
      setTimeout(() => this.sucesso.set(''), 3500);
      this.load();
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
    } finally {
      this.busy.set('');
    }
  }

  verExtrato(companyId: string): void {
    window.open(`/documento/taxas/${companyId}`, '_blank');
  }
}
