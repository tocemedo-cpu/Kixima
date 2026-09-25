import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PasswordResetService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('forgotPassword() envia POST /api/auth/forgot-password com o email', () => {
    service.forgotPassword('a@a.co').subscribe();
    const req = http.expectOne({ url: '/api/auth/forgot-password', method: 'POST' });
    expect(req.request.body).toEqual({ email: 'a@a.co' });
    req.flush({ ok: true, message: '' });
  });

  it('resetPassword() envia POST /api/auth/reset-password com token e password', () => {
    service.resetPassword('tok1', 'novaSenha123').subscribe();
    const req = http.expectOne({ url: '/api/auth/reset-password', method: 'POST' });
    expect(req.request.body).toEqual({ token: 'tok1', password: 'novaSenha123' });
    req.flush({ ok: true });
  });
});
