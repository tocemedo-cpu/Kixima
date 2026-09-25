import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { QuotesService } from './quotes.service';

describe('QuotesService', () => {
  let service: QuotesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(QuotesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() chama GET /api/quotes', () => {
    service.list().subscribe();
    const req = http.expectOne('/api/quotes');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('create() envia POST /api/quotes com o corpo exacto', () => {
    const body = { supplierCompanyId: 's1', items: [{ productId: 'p1', quantity: 2 }], note: 'Urgente' };
    service.create(body).subscribe();
    const req = http.expectOne('/api/quotes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('respond() chama PATCH /api/quotes/:id/respond', () => {
    service.respond('q1', { price: 1000, leadDays: 5 }).subscribe();
    const req = http.expectOne('/api/quotes/q1/respond');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ price: 1000, leadDays: 5 });
    req.flush({});
  });

  it('close() chama PATCH /api/quotes/:id/close', () => {
    service.close('q1').subscribe();
    const req = http.expectOne('/api/quotes/q1/close');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });
});
