// Porta de frontend/src/pages/adminSistema/Cobrancas.jsx. É aqui, e só aqui,
// que um plano pago (ou um add-on pago) passa a estar ativo — a página tem
// duas listas de propósito (por confirmar / por pagar) mais as empresas em
// tolerância/restritas por vencimento. Contratos confirmados contra
// AssinaturaController.fila()/AddonController por um agente de pesquisa
// dedicado, dado envolver dinheiro real.
import { Component, signal } from '@angular/core';
import { AssinaturaService } from '../company-admin/assinatura.service';
import { AddonsService } from './addons.service';
import { AddonCobrancaDto, AssinaturaFila, AddonsFila, PlanoCobrancaDto } from '../../core/models/assinatura.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatDate, formatUsd } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { KpiRowComponent, KpiCard } from '../../shared/buyer-ui/kpi-row.component';
import { PillComponent } from '../../shared/buyer-ui/pill.component';
import { EmptyRowComponent } from '../../shared/buyer-ui/empty-row.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';

const NOME_CANAL: Record<string, string> = {
  EMIS_MULTICAIXA: 'Multicaixa Express',
  PAYPAY: 'PayPay',
  BAI: 'BAI',
  BFA: 'BFA',
  STANDARD_BANK_ANGOLA: 'Standard Bank Angola',
};

@Component({
  selector: 'app-cobrancas',
  standalone: true,
  imports: [CrumbsComponent, BuyerPageHeadComponent, KpiRowComponent, PillComponent, EmptyRowComponent, ErrorBannerComponent, SuccessBannerComponent],
  templateUrl: './cobrancas.component.html',
})
export class CobrancasComponent {
  readonly data = signal<AssinaturaFila | null>(null);
  readonly addons = signal<AddonsFila | null>(null);
  readonly catalogoAddons = signal<Record<string, string>>({});
  readonly error = signal('');
  readonly aviso = signal('');
  readonly busy = signal('');

  readonly formatDate = formatDate;
  readonly formatUsd = formatUsd;

  constructor(
    private readonly assinaturaService: AssinaturaService,
    private readonly addonsService: AddonsService,
  ) {
    this.carregar();
    this.addonsService.catalogo().subscribe({
      next: (lista) => this.catalogoAddons.set(Object.fromEntries(lista.map((a) => [a.addonKey, a.label]))),
      error: () => {},
    });
  }

  private carregar(): void {
    this.error.set('');
    this.assinaturaService.fila().subscribe({
      next: (d) => this.data.set(d),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
    this.addonsService.fila().subscribe({
      next: (d) => this.addons.set(d),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  porConfirmar(): PlanoCobrancaDto[] {
    return (this.data()?.emAberto || []).filter((c) => c.status === 'COMPROVATIVO_ENVIADO');
  }

  porPagar(): PlanoCobrancaDto[] {
    return (this.data()?.emAberto || []).filter((c) => c.status === 'PENDENTE');
  }

  addonsPorConfirmar(): AddonCobrancaDto[] {
    return (this.addons()?.emAberto || []).filter((c) => c.status === 'COMPROVATIVO_ENVIADO');
  }

  addonsPorPagar(): AddonCobrancaDto[] {
    return (this.addons()?.emAberto || []).filter((c) => c.status === 'PENDENTE');
  }

  kpis(): KpiCard[] {
    const d = this.data();
    return [
      { icon: 'wallet', tone: 'info', label: 'Por confirmar', value: d?.porConfirmar ?? '—', sub: '' },
      { icon: 'invoice', tone: 'pending', label: 'Por pagar', value: d?.porPagar ?? '—', sub: '' },
      { icon: 'policy', tone: 'pending', label: 'Em período de tolerância', value: d?.emGrace.length ?? '—', sub: '' },
      { icon: 'policy', tone: 'danger', label: 'Restritas (recursos premium bloqueados)', value: d?.restritas.length ?? '—', sub: '' },
    ];
  }

  addonsKpis(): KpiCard[] {
    const a = this.addons();
    return [
      { icon: 'wallet', tone: 'info', label: 'Por confirmar', value: a?.porConfirmar ?? '—', sub: '' },
      { icon: 'invoice', tone: 'pending', label: 'Por pagar', value: a?.porPagar ?? '—', sub: '' },
    ];
  }

  nomeCanal(canal: string | null | undefined): string {
    return NOME_CANAL[canal || ''] || canal || '';
  }

  nomeAddon(addonKey: string): string {
    return this.catalogoAddons()[addonKey] || addonKey;
  }

  confirmar(c: PlanoCobrancaDto): void {
    const ok = window.confirm(
      `Confirma que o valor de ${formatUsd(c.valorUsd)} referente a ${c.referencia} (${c.company?.name || ''}) entrou na conta da KIXIMA?`,
    );
    if (!ok) return;
    const notas = window.prompt('Nota interna (opcional) — ex.: data e banco da entrada.') || '';
    this.busy.set(c.id);
    this.error.set('');
    this.aviso.set('');
    this.assinaturaService.confirmar(c.id, { notas }).subscribe({
      next: () => {
        this.aviso.set(`${c.referencia} confirmada. A empresa ${c.company?.name || ''} está agora no plano ${c.planoNovo}.`);
        this.busy.set('');
        this.carregar();
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.busy.set('');
      },
    });
  }

  cancelar(c: PlanoCobrancaDto): void {
    const motivo = window.prompt(`Porque está a cancelar ${c.referencia}?`);
    if (!motivo) return;
    this.busy.set(c.id);
    this.error.set('');
    this.assinaturaService.cancelar(c.id, { motivo }).subscribe({
      next: () => {
        this.busy.set('');
        this.carregar();
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.busy.set('');
      },
    });
  }

  confirmarAddon(c: AddonCobrancaDto): void {
    const ok = window.confirm(
      `Confirma que o valor de ${formatUsd(c.valorUsd)} referente a ${c.referencia} (${c.company?.name || ''}) entrou na conta da KIXIMA?`,
    );
    if (!ok) return;
    const notas = window.prompt('Nota interna (opcional) — ex.: data e banco da entrada.') || '';
    this.busy.set(c.id);
    this.error.set('');
    this.aviso.set('');
    this.addonsService.confirmar(c.id, { notas }).subscribe({
      next: () => {
        this.aviso.set(`${c.referencia} confirmada. O add-on "${this.nomeAddon(c.addonKey)}" está ativo para ${c.company?.name || ''}.`);
        this.busy.set('');
        this.carregar();
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.busy.set('');
      },
    });
  }

  cancelarAddon(c: AddonCobrancaDto): void {
    const motivo = window.prompt(`Porque está a cancelar ${c.referencia}?`);
    if (!motivo) return;
    this.busy.set(c.id);
    this.error.set('');
    this.addonsService.cancelar(c.id, { motivo }).subscribe({
      next: () => {
        this.busy.set('');
        this.carregar();
      },
      error: (e) => {
        this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
        this.busy.set('');
      },
    });
  }
}
