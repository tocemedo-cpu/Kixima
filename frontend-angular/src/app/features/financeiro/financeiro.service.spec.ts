import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FinanceiroService } from './financeiro.service';

describe('FinanceiroService', () => {
  let service: FinanceiroService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FinanceiroService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('overview() chama GET /api/financeiro/overview', () => {
    service.overview().subscribe();
    http.expectOne({ url: '/api/financeiro/overview', method: 'GET' }).flush({});
  });

  it('invoices() chama GET /api/financeiro/invoices', () => {
    service.invoices().subscribe();
    http.expectOne({ url: '/api/financeiro/invoices', method: 'GET' }).flush({ kpis: {}, items: [] });
  });

  it('payments() chama GET /api/financeiro/payments com/sem filtro de status', () => {
    service.payments('PENDENTE').subscribe();
    const comStatus = http.expectOne((r) => r.url === '/api/financeiro/payments');
    expect(comStatus.request.params.get('status')).toBe('PENDENTE');
    comStatus.flush({ kpis: {}, items: [] });

    service.payments().subscribe();
    const semStatus = http.expectOne((r) => r.url === '/api/financeiro/payments');
    expect(semStatus.request.params.has('status')).toBeFalse();
    semStatus.flush({ kpis: {}, items: [] });
  });

  it('pay() envia POST multipart com o campo "proof" para /api/payments/invoices/:id/pay', () => {
    const ficheiro = new File(['x'], 'comprovativo.pdf', { type: 'application/pdf' });
    service.pay('inv1', ficheiro).subscribe();
    const req = http.expectOne({ url: '/api/payments/invoices/inv1/pay', method: 'POST' });
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('proof')).toBe(ficheiro);
    req.flush({});
  });
});
