import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrganizationService } from './organization.service';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OrganizationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('organizacao() chama GET /api/company-admin/organizacao', () => {
    service.organizacao().subscribe();
    http.expectOne({ url: '/api/company-admin/organizacao', method: 'GET' }).flush({});
  });

  it('getBankDetails() chama GET /api/companies/:id/bank-details', () => {
    service.getBankDetails('c1').subscribe();
    http.expectOne({ url: '/api/companies/c1/bank-details', method: 'GET' }).flush({});
  });

  it('setBankDetails() envia PUT com o corpo exacto', () => {
    const body = { bankName: 'BFA', iban: 'AO06', swift: 'BFMXAOLU' };
    service.setBankDetails('c1', body).subscribe();
    const req = http.expectOne({ url: '/api/companies/c1/bank-details', method: 'PUT' });
    expect(req.request.body).toEqual(body);
    req.flush(body);
  });
});
