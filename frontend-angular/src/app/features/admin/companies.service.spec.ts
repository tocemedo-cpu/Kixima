import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CompaniesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() chama GET /api/companies com o filtro de status', () => {
    service.list('PENDENTE').subscribe();
    const req = http.expectOne((r) => r.url === '/api/companies');
    expect(req.request.params.get('status')).toBe('PENDENTE');
    req.flush([]);
  });

  it('get() chama GET /api/companies/:id', () => {
    service.get('c1').subscribe();
    http.expectOne({ url: '/api/companies/c1', method: 'GET' }).flush({});
  });

  it('decide() chama PATCH /api/companies/:id/decision com o corpo exacto', () => {
    service.decide('c1', { approve: true }).subscribe();
    const req = http.expectOne({ url: '/api/companies/c1/decision', method: 'PATCH' });
    expect(req.request.body).toEqual({ approve: true });
    req.flush({});
  });
});
