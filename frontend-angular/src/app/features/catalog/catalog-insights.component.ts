// Porta de frontend/src/pages/fornecedor/CatalogInsights.jsx. Vistas do
// catálogo derivadas dos produtos da própria empresa (agrega /api/catalog).
// Um só componente serve Categorias/Marcas/Promoções/Armazéns — o segmento
// activo vem de `data.seg` na rota (a app real nunca alcança 'servicos' por
// routing — só CatalogManage.jsx serve /catalogo/servicos — por isso essa
// chave não tem rota própria aqui, tal como no React).
import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from './catalog.service';
import { ProductDto } from '../../core/models/product.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatMoney } from '../../shared/domain';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';

type Segmento = 'categorias' | 'marcas' | 'armazens' | 'servicos' | 'promocoes';

const TITLES: Record<Segmento, string> = {
  categorias: 'Categorias',
  marcas: 'Marcas',
  servicos: 'Serviços',
  promocoes: 'Promoções',
  armazens: 'Armazéns',
};

// Categorias tratadas como "serviço" (não têm stock físico).
const SERVICE_CATEGORIES = new Set(['Consultoria', 'Engenharia', 'Inspeção & Ensaios', 'Formação & Certificação', 'Logística & Transporte']);

interface Agregado {
  key: string;
  count: number;
  units: number;
}

@Component({
  selector: 'app-catalog-insights',
  standalone: true,
  imports: [PageHeaderComponent, LoadingComponent, ErrorBannerComponent],
  templateUrl: './catalog-insights.component.html',
})
export class CatalogInsightsComponent {
  readonly seg: Segmento;
  readonly title: string;

  readonly products = signal<ProductDto[] | null>(null);
  readonly error = signal('');

  readonly formatMoney = formatMoney;

  readonly agregacao = computed<Agregado[]>(() => {
    const produtos = this.products();
    if (!produtos || this.seg === 'servicos' || this.seg === 'promocoes') return [];
    const campo = this.seg === 'categorias' ? 'category' : this.seg === 'marcas' ? 'brand' : 'warehouse';
    const m = new Map<string, Agregado>();
    for (const p of produtos) {
      const k = p[campo as 'category' | 'brand' | 'warehouse'];
      if (!k) continue;
      const cur = m.get(k) || { key: k, count: 0, units: 0 };
      cur.count += 1;
      cur.units += p.stockQuantity || 0;
      m.set(k, cur);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  });

  readonly linhasProdutos = computed<ProductDto[]>(() => {
    const produtos = this.products();
    if (!produtos) return [];
    if (this.seg === 'servicos') return produtos.filter((p) => SERVICE_CATEGORIES.has(p.category));
    if (this.seg === 'promocoes') return produtos.filter((p) => p.promoPrice != null && Number(p.promoPrice) > 0);
    return [];
  });

  readonly mostraTabela = computed(() => this.seg === 'servicos' || this.seg === 'promocoes');

  constructor(
    auth: AuthService,
    private readonly catalogService: CatalogService,
    route: ActivatedRoute,
  ) {
    this.seg = (route.snapshot.data['seg'] as Segmento) || 'categorias';
    this.title = TITLES[this.seg] || 'Catálogo';

    const companyId = auth.user()!.companyId!;
    this.catalogService.list({ supplierId: companyId }).subscribe({
      next: (produtos) => this.products.set(produtos),
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }
}
