// Porta de frontend/src/pages/comprador/SupplierCompare.jsx. Reúne 3-5
// (na prática 0-5, sem mínimo garantido pelo Java) fornecedores do mesmo
// item e compara preço, prazo, material, garantia, norma, origem, incoterm
// e avaliação. Liga a GET /api/marketplace/compare?productId=.
import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { MarketplaceService } from './marketplace.service';
import { CompareOffer, CompareResponse } from '../../core/models/marketplace-extra.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatMoney, joinNonEmpty } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { StarsComponent } from '../../shared/components/stars.component';

function precoDe(o: CompareOffer): number {
  return Number(o.promoPrice ?? o.unitPrice) || 0;
}

interface BarraItem {
  id: string;
  label: string;
  value: number | null;
  best: boolean;
}

@Component({
  selector: 'app-supplier-compare',
  standalone: true,
  imports: [CrumbsComponent, BuyerPageHeadComponent, LoadingComponent, ErrorBannerComponent, StarsComponent],
  templateUrl: './supplier-compare.component.html',
})
export class SupplierCompareComponent {
  readonly productId: string;
  readonly data = signal<CompareResponse | null>(null);
  readonly error = signal('');

  readonly formatMoney = formatMoney;
  readonly joinNonEmpty = joinNonEmpty;

  readonly offers = computed(() => this.data()?.offers || []);
  readonly itemName = computed(() => this.data()?.base?.unspscTitle || this.data()?.base?.name || 'Item');

  readonly bestPrice = computed(() => {
    const valores = this.offers().map(precoDe).filter((n) => n > 0);
    return valores.length ? Math.min(...valores) : 0;
  });
  readonly bestLead = computed(() => {
    const valores = this.offers()
      .map((o) => o.leadTimeDays)
      .filter((n): n is number => n != null);
    return valores.length ? Math.min(...valores) : null;
  });

  readonly precoItens = computed<BarraItem[]>(() =>
    this.offers().map((o) => ({ id: o.id, label: this.nomeCurto(o), value: precoDe(o), best: precoDe(o) === this.bestPrice() })),
  );
  readonly precoMax = computed(() => Math.max(1, ...this.precoItens().map((i) => i.value || 0)));

  readonly prazoItens = computed<BarraItem[]>(() =>
    this.offers().map((o) => ({
      id: o.id,
      label: this.nomeCurto(o),
      value: o.leadTimeDays ?? null,
      best: this.bestLead() != null && o.leadTimeDays === this.bestLead(),
    })),
  );
  readonly prazoMax = computed(() => Math.max(1, ...this.prazoItens().map((i) => i.value || 0)));

  constructor(
    route: ActivatedRoute,
    private readonly marketplaceService: MarketplaceService,
    private readonly location: Location,
  ) {
    this.productId = route.snapshot.queryParamMap.get('productId') || '';
    if (!this.productId) {
      this.error.set('Produto não indicado.');
      return;
    }
    this.marketplaceService.compare(this.productId).subscribe({
      next: (d) => this.data.set(d),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  nomeCurto(o: CompareOffer): string {
    return (o.supplier?.name || '—').split(',')[0];
  }

  precoDe(o: CompareOffer): number {
    return precoDe(o);
  }

  precoAltura(item: BarraItem): number {
    return ((item.value || 0) / this.precoMax()) * 62;
  }

  prazoAltura(item: BarraItem): number {
    return ((item.value || 0) / this.prazoMax()) * 62;
  }

  formatDias(v: number | null): string {
    return v != null ? `${v} dias` : '—';
  }

  voltar(): void {
    this.location.back();
  }
}
