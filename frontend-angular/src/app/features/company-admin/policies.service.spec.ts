import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PoliciesService } from './policies.service';

describe('PoliciesService', () => {
  let service: PoliciesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PoliciesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('forCompany() chama GET /api/policies/company/:companyId', () => {
    service.forCompany('c1').subscribe();
    http.expectOne({ url: '/api/policies/company/c1', method: 'GET' }).flush({});
  });
});
