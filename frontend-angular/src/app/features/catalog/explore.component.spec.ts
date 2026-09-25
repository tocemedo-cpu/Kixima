import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ExploreComponent, cache } from './explore.component';
import { MarketplaceService } from './marketplace.service';
import { ProductDto, MarketplaceSearchResult } from '../../core/models/product.model';
import { ApiError } from '../../core/models/api-error.model';

function produto(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: 'p1', supplierId: 's1', name: 'Bomba Centrífuga', category: 'Bombas',
    unitPrice: '20000', currency: 'AOA', kind: 'PRODUTO', certifications: [], tags: [],
    active: true, reviewCount: 0, viewCount: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    supplier: { id: 's1', name: 'Fornecedora Lda' },
    ...overrides,
  };
}

function resultado(items: ProductDto[] = [produto()]): MarketplaceSearchResult {
  return { items, total: items.length, page: 1, pages: 1, limit: 12 };
}

function montar(queryParams: Record<string, string> = {}) {
  const marketplaceService = jasmine.createSpyObj<MarketplaceService>('MarketplaceService', [
    'search', 'facets', 'addFavorite', 'removeFavorite', 'saveSearch',
  ]);
  marketplaceService.search.and.returnValue(of(resultado()));
  marketplaceService.facets.and.returnValue(of({ categories: [], kinds: [], countries: [], certifications: [], priceBounds: { min: 0, max: 0 } }));
  const route = {
    snapshot: { queryParams },
    queryParams: of(queryParams),
  } as unknown as ActivatedRoute;
  const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new ExploreComponent(marketplaceService, router, route));
  return { componente, marketplaceService, router };
}

describe('ExploreComponent', () => {
  beforeEach(() => cache.clear());

  it('lê todo o estado de filtros a partir do endereço, não só q', () => {
    const { componente } = montar({ q: 'bomba', category: 'Bombas', kind: 'PRODUTO', country: 'Angola', certs: 'ISO 9001,ISO 14001', sort: 'recentes', page: '2', limit: '24' });
    expect(componente.q()).toBe('bomba');
    expect(componente.category()).toBe('Bombas');
    expect(componente.kind()).toBe('PRODUTO');
    expect(componente.country()).toBe('Angola');
    expect(componente.certs()).toEqual(['ISO 9001', 'ISO 14001']);
    expect(componente.sort()).toBe('recentes');
    expect(componente.page()).toBe(2);
    expect(componente.limit()).toBe(24);
  });

  it('doSearch() aplica o pendingQ como q, volta à página 1 e sincroniza o endereço', () => {
    const { componente, marketplaceService, router } = montar();
    componente.onPendingQ('válvula');
    componente.doSearch();
    expect(componente.q()).toBe('válvula');
    expect(componente.page()).toBe(1);
    expect(marketplaceService.search).toHaveBeenCalledWith(jasmine.objectContaining({ q: 'válvula' }));
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: jasmine.objectContaining({ q: 'válvula' }), replaceUrl: true }));
  });

  it('chips() reflecte os filtros activos e cada chip limpa só o seu próprio filtro', () => {
    const { componente } = montar({ q: 'bomba', category: 'Bombas' });
    const chips = componente.chips();
    expect(chips.map((c) => c.k)).toEqual(['q', 'cat']);
    const chipQ = chips.find((c) => c.k === 'q')!;
    chipQ.clear();
    expect(componente.q()).toBe('');
  });

  it('clearAll() repõe todos os filtros', () => {
    const { componente } = montar({ q: 'bomba', category: 'Bombas', kind: 'PRODUTO', country: 'Angola', certs: 'ISO 9001' });
    componente.clearAll();
    expect(componente.q()).toBe('');
    expect(componente.category()).toBe('');
    expect(componente.kind()).toBe('');
    expect(componente.country()).toBe('');
    expect(componente.certs()).toEqual([]);
  });

  it('toggleFav() chama addFavorite/removeFavorite conforme o estado actual', () => {
    const { componente, marketplaceService } = montar();
    marketplaceService.addFavorite.and.returnValue(of({ productId: 'p1', favorite: true }));
    componente.toggleFav(produto({ isFavorite: false }));
    expect(marketplaceService.addFavorite).toHaveBeenCalledWith('p1');
    expect(componente.data()?.items[0].isFavorite).toBeTrue();
  });

  it('saveSearch() envia a query-string dos filtros actuais com o q entre aspas como label', () => {
    const { componente, marketplaceService } = montar({ q: 'bomba' });
    marketplaceService.saveSearch.and.returnValue(of({ id: 's1', userId: 'u1', label: '"bomba"', query: 'q=bomba', createdAt: '2026-01-01' }));
    componente.saveSearch();
    expect(marketplaceService.saveSearch).toHaveBeenCalledWith(jasmine.objectContaining({ label: '"bomba"' }));
    expect(componente.toast()).toBe('Pesquisa guardada.');
  });

  it('saveSearch() usa "Pesquisa" como label quando não há termo pesquisado', () => {
    const { componente, marketplaceService } = montar();
    marketplaceService.saveSearch.and.returnValue(of({ id: 's1', userId: 'u1', label: 'Pesquisa', query: '', createdAt: '2026-01-01' }));
    componente.saveSearch();
    expect(marketplaceService.saveSearch).toHaveBeenCalledWith(jasmine.objectContaining({ label: 'Pesquisa' }));
  });

  it('setLimit() muda o tamanho de página e volta à página 1', () => {
    const { componente } = montar();
    componente.setLimit('48');
    expect(componente.limit()).toBe(48);
    expect(componente.page()).toBe(1);
  });

  it('abrir() navega para /comprador/servicos/:slug', () => {
    const { componente, router } = montar();
    componente.abrir(produto({ slug: 'bomba-centrifuga' }));
    expect(router.navigate).toHaveBeenCalledWith(['/comprador/servicos', 'bomba-centrifuga']);
  });

  it('initials() extrai as iniciais das duas primeiras palavras do nome', () => {
    const { componente } = montar();
    expect(componente.initials('Fornecedora Industrial Lda')).toBe('FI');
    expect(componente.initials('')).toBe('?');
  });

  it('regista o erro quando a pesquisa falha', () => {
    const marketplaceService = jasmine.createSpyObj<MarketplaceService>('MarketplaceService', [
      'search', 'facets', 'addFavorite', 'removeFavorite', 'saveSearch',
    ]);
    marketplaceService.search.and.returnValue(throwError(() => new ApiError('Falha ao carregar.', 500)));
    marketplaceService.facets.and.returnValue(of({ categories: [], kinds: [], countries: [], certifications: [], priceBounds: { min: 0, max: 0 } }));
    const route = { snapshot: { queryParams: {} }, queryParams: of({}) } as unknown as ActivatedRoute;
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(() => new ExploreComponent(marketplaceService, router, route));
    expect(componente.error()).toBe('Falha ao carregar.');
  });
});
