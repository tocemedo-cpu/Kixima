import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MarketplaceService } from './marketplace.service';

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MarketplaceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('search() chama GET /api/marketplace/search com os filtros como query params', () => {
    service.search({ q: 'válvula', category: 'Válvulas', page: 2, limit: 24, sort: 'preco_asc' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/marketplace/search');
    expect(req.request.params.get('q')).toBe('válvula');
    expect(req.request.params.get('category')).toBe('Válvulas');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ items: [], total: 0, page: 2, pages: 1, limit: 24 });
  });

  it('facets() chama GET /api/marketplace/facets', () => {
    service.facets({ category: 'Válvulas' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/marketplace/facets');
    expect(req.request.params.get('category')).toBe('Válvulas');
    req.flush({ categories: [], kinds: [], countries: [], certifications: [], priceBounds: { min: 0, max: 0 } });
  });
});
