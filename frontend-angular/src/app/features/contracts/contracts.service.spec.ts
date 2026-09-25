import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ContractsService } from './contracts.service';

describe('ContractsService', () => {
  let service: ContractsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ContractsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() chama GET /api/contracts — o servidor decide o âmbito por papel', () => {
    service.list().subscribe();
    const req = http.expectOne({ url: '/api/contracts', method: 'GET' });
    req.flush([]);
  });

  it('create() chama POST /api/contracts com o corpo exacto', () => {
    const body = {
      clientCompanyId: 'c1', supplierCompanyId: 's1', categoriesCovered: ['Válvulas'],
      totalValue: 1000, currency: 'AOA', billingPeriodicity: 'TRIMESTRAL' as const,
      paymentTermDays: 30, validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2026-12-31T00:00:00.000Z',
    };
    service.create(body).subscribe();
    const req = http.expectOne({ url: '/api/contracts', method: 'POST' });
    expect(req.request.body).toEqual(body);
    req.flush({});
  });
});
