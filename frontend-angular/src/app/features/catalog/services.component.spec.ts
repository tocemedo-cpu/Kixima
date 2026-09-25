import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ServicesComponent, cache } from './services.component';
import { MarketplaceService } from './marketplace.service';
import { QuotesService } from '../quotes/quotes.service';
import { ProductDto, MarketplaceSearchResult } from '../../core/models/product.model';
import { QuoteRequestDto } from '../../core/models/quote.model';
import { ApiError } from '../../core/models/api-error.model';

function produto(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: 'p1', supplierId: 's1', name: 'Inspecção de Tubagem', category: 'Serviços',
    unitPrice: '5000', currency: 'AOA', kind: 'SERVICO', certifications: [], tags: [],
    active: true, reviewCount: 0, viewCount: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    supplier: { id: 's1', name: 'Fornecedora Lda' },
    ...overrides,
  };
}

function resultado(items: ProductDto[] = [produto()]): MarketplaceSearchResult {
  return { items, total: items.length, page: 1, pages: 1, limit: 16 };
}

function montar(qInicial = '') {
  const marketplaceService = jasmine.createSpyObj<MarketplaceService>('MarketplaceService', [
    'search', 'facets', 'addFavorite', 'removeFavorite',
  ]);
  const quotesService = jasmine.createSpyObj<QuotesService>('QuotesService', ['create']);
  marketplaceService.search.and.returnValue(of(resultado()));
  marketplaceService.facets.and.returnValue(of({ categories: [], kinds: [], countries: [], certifications: [], priceBounds: { min: 0, max: 0 } }));
  const route = { snapshot: { queryParamMap: { get: () => qInicial || null } } } as unknown as ActivatedRoute;
  const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(
    () => new ServicesComponent(marketplaceService, quotesService, router, route),
  );
  return { componente, marketplaceService, quotesService, router };
}

describe('ServicesComponent', () => {
  beforeEach(() => cache.clear());

  it('pesquisa sempre com kind=SERVICO fixo', () => {
    const { marketplaceService } = montar();
    expect(marketplaceService.search).toHaveBeenCalledWith(jasmine.objectContaining({ kind: 'SERVICO' }));
  });

  it('carrega o q inicial a partir do endereço', () => {
    const { componente } = montar('inspecção');
    expect(componente.q()).toBe('inspecção');
    expect(componente.qDebounced()).toBe('inspecção');
  });

  it('setCategory() alterna a categoria e volta à página 1', () => {
    const { componente, marketplaceService } = montar();
    componente.setCategory('Serviços Industriais');
    expect(componente.category()).toBe('Serviços Industriais');
    expect(marketplaceService.search).toHaveBeenCalledWith(jasmine.objectContaining({ category: 'Serviços Industriais' }));
    componente.setCategory('Serviços Industriais');
    expect(componente.category()).toBe('');
  });

  it('toggleCert() adiciona e remove certificações da lista', () => {
    const { componente } = montar();
    componente.toggleCert('ISO 9001');
    expect(componente.certs()).toEqual(['ISO 9001']);
    componente.toggleCert('ISO 9001');
    expect(componente.certs()).toEqual([]);
  });

  it('clearFilters() repõe todos os filtros e a pesquisa', () => {
    const { componente } = montar();
    componente.category.set('X');
    componente.certs.set(['ISO 9001']);
    componente.verified.set(true);
    componente.country.set('Angola');
    componente.q.set('algo');
    componente.clearFilters();
    expect(componente.category()).toBe('');
    expect(componente.certs()).toEqual([]);
    expect(componente.verified()).toBeFalse();
    expect(componente.country()).toBe('');
    expect(componente.q()).toBe('');
  });

  it('toggleFav() chama addFavorite quando ainda não é favorito e actualiza o item na lista', () => {
    const { componente, marketplaceService } = montar();
    marketplaceService.addFavorite.and.returnValue(of({ productId: 'p1', favorite: true }));
    componente.toggleFav(produto({ isFavorite: false }));
    expect(marketplaceService.addFavorite).toHaveBeenCalledWith('p1');
    expect(componente.data()?.items[0].isFavorite).toBeTrue();
  });

  it('toggleFav() chama removeFavorite quando já é favorito', () => {
    const { componente, marketplaceService } = montar();
    marketplaceService.removeFavorite.and.returnValue(of({ productId: 'p1', favorite: false }));
    componente.toggleFav(produto({ isFavorite: true }));
    expect(marketplaceService.removeFavorite).toHaveBeenCalledWith('p1');
  });

  it('solicitarCotacao() chama QuotesService.create com o fornecedor e o serviço', () => {
    const { componente, quotesService } = montar();
    quotesService.create.and.returnValue(of({} as unknown as QuoteRequestDto));
    componente.solicitarCotacao(produto());
    expect(quotesService.create).toHaveBeenCalledWith({
      supplierCompanyId: 's1',
      items: [{ productId: 'p1', quantity: 1 }],
    });
  });

  it('abrir() navega para /comprador/servicos/:slug', () => {
    const { componente, router } = montar();
    componente.abrir(produto({ slug: 'inspecao-tubagem' }));
    expect(router.navigate).toHaveBeenCalledWith(['/comprador/servicos', 'inspecao-tubagem']);
  });

  it('availClass() devolve sobconsulta quando a disponibilidade é "Sob consulta"', () => {
    const { componente } = montar();
    expect(componente.availClass(produto({ availability: 'Sob consulta' }))).toBe('sobconsulta');
    expect(componente.availClass(produto({ availability: 'Disponível' }))).toBe('disponivel');
  });

  it('regista o erro quando a pesquisa falha', () => {
    const marketplaceService = jasmine.createSpyObj<MarketplaceService>('MarketplaceService', [
      'search', 'facets', 'addFavorite', 'removeFavorite',
    ]);
    const quotesService = jasmine.createSpyObj<QuotesService>('QuotesService', ['create']);
    marketplaceService.search.and.returnValue(throwError(() => new ApiError('Falha ao carregar serviços.', 500)));
    marketplaceService.facets.and.returnValue(of({ categories: [], kinds: [], countries: [], certifications: [], priceBounds: { min: 0, max: 0 } }));
    const route = { snapshot: { queryParamMap: { get: () => null } } } as unknown as ActivatedRoute;
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(
      () => new ServicesComponent(marketplaceService, quotesService, router, route),
    );
    expect(componente.error()).toBe('Falha ao carregar serviços.');
  });
});
