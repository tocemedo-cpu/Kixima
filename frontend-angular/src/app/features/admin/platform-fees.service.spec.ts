import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlatformFeesService } from './platform-fees.service';

describe('PlatformFeesService', () => {
  let service: PlatformFeesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlatformFeesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() chama GET /api/admin/platform-fees', () => {
    service.list().subscribe();
    http.expectOne({ url: '/api/admin/platform-fees', method: 'GET' }).flush({ fees: [], kpis: {} });
  });

  it('charge() chama PATCH /api/admin/platform-fees/:id/charge', () => {
    service.charge('fee1').subscribe();
    http.expectOne({ url: '/api/admin/platform-fees/fee1/charge', method: 'PATCH' }).flush({});
  });

  it('forCompany() chama GET /api/companies/:id/platform-fees', () => {
    service.forCompany('c1').subscribe();
    http.expectOne({ url: '/api/companies/c1/platform-fees', method: 'GET' }).flush({});
  });
});
