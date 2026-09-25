import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DashboardService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('companyAdmin() chama GET /api/company-admin/dashboard', () => {
    service.companyAdmin().subscribe();
    const req = http.expectOne('/api/company-admin/dashboard');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('comprador() chama GET /api/dashboard/comprador', () => {
    service.comprador().subscribe();
    const req = http.expectOne('/api/dashboard/comprador');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});
