import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SecurityService } from './security.service';

describe('SecurityService', () => {
  let service: SecurityService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SecurityService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('changePassword() chama PATCH /api/auth/password com o corpo exacto', () => {
    service.changePassword({ currentPassword: 'atual12345', newPassword: 'novaSenha12345' }).subscribe();
    const req = http.expectOne({ url: '/api/auth/password', method: 'PATCH' });
    expect(req.request.body).toEqual({ currentPassword: 'atual12345', newPassword: 'novaSenha12345' });
    req.flush({ ok: true });
  });

  it('totpStatus() chama GET /api/auth/2fa/status', () => {
    service.totpStatus().subscribe();
    http.expectOne({ url: '/api/auth/2fa/status', method: 'GET' }).flush({ enabled: false, enabledAt: null, metodo: null, emailIndisponivel: null, email: 'a@a.co' });
  });

  it('enviarCodigoEmail() chama POST /api/auth/2fa/email/enviar', () => {
    service.enviarCodigoEmail().subscribe();
    http.expectOne({ url: '/api/auth/2fa/email/enviar', method: 'POST' }).flush({ enviadoPara: 'a@a.co', expiraEm: '2026-01-01', validadeMinutos: 10 });
  });

  it('reenviarCodigoEmail() chama POST /api/auth/2fa/email/reenviar', () => {
    service.reenviarCodigoEmail().subscribe();
    http.expectOne({ url: '/api/auth/2fa/email/reenviar', method: 'POST' }).flush({ enviadoPara: 'a@a.co', expiraEm: '2026-01-01', validadeMinutos: 10 });
  });

  it('setupTotp() chama POST /api/auth/2fa/setup', () => {
    service.setupTotp().subscribe();
    http.expectOne({ url: '/api/auth/2fa/setup', method: 'POST' }).flush({ secret: 'ABC', otpauthUrl: 'otpauth://...' });
  });

  it('enableTotp() chama POST /api/auth/2fa/enable com o código', () => {
    service.enableTotp({ code: '123456' }).subscribe();
    const req = http.expectOne({ url: '/api/auth/2fa/enable', method: 'POST' });
    expect(req.request.body).toEqual({ code: '123456' });
    req.flush({ enabled: true, enabledAt: '2026-01-01', metodo: 'TOTP' });
  });

  it('disableTotp() chama POST /api/auth/2fa/disable com o código', () => {
    service.disableTotp({ code: '654321' }).subscribe();
    const req = http.expectOne({ url: '/api/auth/2fa/disable', method: 'POST' });
    expect(req.request.body).toEqual({ code: '654321' });
    req.flush({ enabled: false });
  });

  it('dadosPessoais() chama GET /api/users/me/dados-pessoais', () => {
    service.dadosPessoais().subscribe();
    http.expectOne({ url: '/api/users/me/dados-pessoais', method: 'GET' }).flush({});
  });

  it('anonimizar() chama POST /api/users/me/anonimizar com o corpo exacto', () => {
    service.anonimizar({ password: 'senha12345' }).subscribe();
    const req = http.expectOne({ url: '/api/users/me/anonimizar', method: 'POST' });
    expect(req.request.body).toEqual({ password: 'senha12345' });
    req.flush({});
  });
});
