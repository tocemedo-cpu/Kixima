import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminInviteService } from './admin-invite.service';

describe('AdminInviteService', () => {
  let service: AdminInviteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AdminInviteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('resolve() chama GET /api/admin/invite/:token', () => {
    service.resolve('tok1').subscribe();
    http.expectOne({ url: '/api/admin/invite/tok1', method: 'GET' }).flush({});
  });

  it('accept() envia POST /api/admin/invite/:token/accept com o corpo exacto', () => {
    service.accept('tok1', { password: 'senha123456', termsAccepted: true }).subscribe();
    const req = http.expectOne({ url: '/api/admin/invite/tok1/accept', method: 'POST' });
    expect(req.request.body).toEqual({ password: 'senha123456', termsAccepted: true });
    req.flush({});
  });
});
