import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BuyerSuppliersService } from './buyer-suppliers.service';

describe('BuyerSuppliersService', () => {
  let service: BuyerSuppliersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BuyerSuppliersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() chama GET /api/buyer/suppliers sem filtros quando nenhum é indicado', () => {
    service.list().subscribe();
    const req = http.expectOne((r) => r.url === '/api/buyer/suppliers');
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ kpis: { total: 0, ativos: 0, homologados: 0, emAvaliacao: 0, novos: 0 }, items: [] });
  });

  it('list() envia status e q como query params quando indicados', () => {
    service.list('ATIVOS', 'petro').subscribe();
    const req = http.expectOne((r) => r.url === '/api/buyer/suppliers');
    expect(req.request.params.get('status')).toBe('ATIVOS');
    expect(req.request.params.get('q')).toBe('petro');
    req.flush({ kpis: { total: 0, ativos: 0, homologados: 0, emAvaliacao: 0, novos: 0 }, items: [] });
  });
});
