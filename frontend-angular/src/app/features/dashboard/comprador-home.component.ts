// Porta de frontend/src/pages/comprador/Home.jsx.
import { Component, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { MarketplaceService } from '../catalog/marketplace.service';
import { CompradorDashboardResponse } from '../../core/models/dashboard.model';
import { ProductDto, VerifiedSupplierCard } from '../../core/models/product.model';
import { NotificationDto } from '../../core/models/notification.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatMoney } from '../../shared/domain';
import { categoryIcon } from '../../shared/category-visual';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { IconComponent } from '../../shared/components/icon.component';
import { CompradorKpiComponent } from './comprador-kpi.component';
import { SectionHeadComponent } from './section-head.component';
import { MiniCardComponent } from './mini-card.component';

interface ComprasHomeData {
  dash: CompradorDashboardResponse;
  categories: Array<{ name: string; count: number }>;
  trending: ProductDto[];
  frequent: ProductDto[];
  suppliers: VerifiedSupplierCard[];
  notifs: NotificationDto[];
}

@Component({
  selector: 'app-comprador-home',
  standalone: true,
  imports: [RouterLink, LoadingComponent, ErrorBannerComponent, IconComponent, CompradorKpiComponent, SectionHeadComponent, MiniCardComponent],
  templateUrl: './comprador-home.component.html',
})
export class CompradorHomeComponent {
  readonly d = signal<ComprasHomeData | null>(null);
  readonly error = signal('');
  readonly q = signal('');

  readonly formatMoney = formatMoney;
  readonly categoryIcon = categoryIcon;

  readonly firstName = computed(() => (this.auth.user()?.name || '').split(' ')[0]);
  readonly saudacao = this.greeting();

  constructor(
    private readonly auth: AuthService,
    private readonly dashboardService: DashboardService,
    private readonly marketplaceService: MarketplaceService,
    private readonly notificationsService: NotificationsService,
    private readonly router: Router,
  ) {
    forkJoin({
      dash: this.dashboardService.comprador(),
      facets: this.marketplaceService.facets({}),
      trending: this.marketplaceService.search({ sort: 'solicitados', limit: 4 }),
      frequent: this.marketplaceService.search({ sort: 'vendidos', limit: 5 }),
      suppliers: this.marketplaceService.suppliers(),
      notifs: this.notificationsService.list(),
    }).subscribe({
      next: ({ dash, facets, trending, frequent, suppliers, notifs }) => {
        this.d.set({
          dash,
          categories: facets.categories || [],
          trending: trending.items || [],
          frequent: frequent.items || [],
          suppliers: suppliers || [],
          notifs: (notifs?.itens || []).slice(0, 6),
        });
      },
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  private greeting(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite';
  }

  timeAgo(iso: string): string {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 3600) return `há ${Math.max(1, Math.floor(s / 60))} min`;
    if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
    const dias = Math.floor(s / 86400);
    return dias > 1 ? `há ${dias} dias` : `há ${dias} dia`;
  }

  initials(name = ''): string {
    return (
      name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || '')
        .join('')
        .toUpperCase() || '?'
    );
  }

  submitSearch(): void {
    const termo = this.q().trim();
    this.router.navigateByUrl(`/comprador/servicos${termo ? `?q=${encodeURIComponent(termo)}` : ''}`);
  }

  verProduto(p: ProductDto): void {
    this.router.navigateByUrl(`/comprador/servicos/${p.slug || p.id}`);
  }
}
