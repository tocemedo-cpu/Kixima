import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { PasswordResetComponent } from './password-reset.component';
import { PasswordResetService } from './password-reset.service';
import { ApiError } from '../../core/models/api-error.model';

function rota(token: string | null): ActivatedRoute {
  return { snapshot: { paramMap: { get: () => token } } } as unknown as ActivatedRoute;
}

describe('PasswordResetComponent — fase 1 (pedir o link)', () => {
  let service: jasmine.SpyObj<PasswordResetService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    service = jasmine.createSpyObj<PasswordResetService>('PasswordResetService', ['forgotPassword', 'resetPassword']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  it('sem token: requestLink() chama o serviço e mostra "sent"', fakeAsync(() => {
    service.forgotPassword.and.returnValue(of({ ok: true, message: '' }));
    const c = TestBed.runInInjectionContext(() => new PasswordResetComponent(rota(null), service, router));

    c.email.set('a@a.co');
    c.requestLink();
    flushMicrotasks();

    expect(service.forgotPassword).toHaveBeenCalledWith('a@a.co');
    expect(c.sent()).toBeTrue();
  }));

  it('tryAgain() volta ao formulário', () => {
    const c = TestBed.runInInjectionContext(() => new PasswordResetComponent(rota(null), service, router));
    c.sent.set(true);
    c.tryAgain();
    expect(c.sent()).toBeFalse();
  });

  it('regista o erro quando o pedido falha', fakeAsync(() => {
    service.forgotPassword.and.returnValue(throwError(() => new ApiError('Falhou', 500)));
    const c = TestBed.runInInjectionContext(() => new PasswordResetComponent(rota(null), service, router));

    c.requestLink();
    flushMicrotasks();

    expect(c.requestError()).toBe('Falhou');
  }));
});

describe('PasswordResetComponent — fase 2 (definir nova senha)', () => {
  let service: jasmine.SpyObj<PasswordResetService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    service = jasmine.createSpyObj<PasswordResetService>('PasswordResetService', ['forgotPassword', 'resetPassword']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  it('rejeita quando as senhas não coincidem, sem chamar o serviço', async () => {
    const c = TestBed.runInInjectionContext(() => new PasswordResetComponent(rota('tok1'), service, router));
    c.password.set('senha1234');
    c.confirm.set('outraSenha');

    await c.resetPassword();

    expect(c.resetError()).toBe('As senhas não coincidem.');
    expect(service.resetPassword).not.toHaveBeenCalled();
  });

  it('com token: chama resetPassword e mostra done', fakeAsync(() => {
    service.resetPassword.and.returnValue(of({ ok: true }));
    const c = TestBed.runInInjectionContext(() => new PasswordResetComponent(rota('tok1'), service, router));
    c.password.set('senha1234');
    c.confirm.set('senha1234');

    c.resetPassword();
    flushMicrotasks();

    expect(service.resetPassword).toHaveBeenCalledWith('tok1', 'senha1234');
    expect(c.done()).toBeTrue();
  }));

  it('mostrarNovoLink só é verdade para mensagens de token expirado/usado/inválido', fakeAsync(() => {
    service.resetPassword.and.returnValue(throwError(() => new ApiError('Token expirado.', 400)));
    const c = TestBed.runInInjectionContext(() => new PasswordResetComponent(rota('tok1'), service, router));
    c.password.set('senha1234');
    c.confirm.set('senha1234');

    c.resetPassword();
    flushMicrotasks();

    expect(c.mostrarNovoLink).toBeTrue();
  }));
});
