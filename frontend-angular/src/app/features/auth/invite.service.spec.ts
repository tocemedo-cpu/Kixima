import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InviteService } from './invite.service';

describe('InviteService', () => {
  let service: InviteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(InviteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('resolve() chama GET /api/companies/invite/:token', () => {
    service.resolve('tok1').subscribe();
    http.expectOne({ url: '/api/companies/invite/tok1', method: 'GET' }).flush({});
  });

  it('accept() envia POST /api/companies/invite/:token/accept com o corpo exacto', () => {
    const body = { name: 'Ana', email: 'ana@a.co', password: 'senha1234', termsAccepted: true as const };
    service.accept('tok1', body).subscribe();
    const req = http.expectOne({ url: '/api/companies/invite/tok1/accept', method: 'POST' });
    expect(req.request.body).toEqual(body);
    req.flush({});
  });
});
