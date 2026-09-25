import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PlansService } from './plans.service';

describe('PlansService', () => {
  let service: PlansService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlansService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('planos() chama GET /api/planos', () => {
    service.planos().subscribe();
    const req = http.expectOne('/api/planos');
    expect(req.request.method).toBe('GET');
    req.flush({ planos: [], taxaPorTransacao: { porOrdemUsd: 0, porFaturaUsd: 0, limiarUsd: 0, percentagemAcima: 0 } });
  });
});
