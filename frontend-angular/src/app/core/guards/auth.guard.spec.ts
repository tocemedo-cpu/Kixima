import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { KiximaUser } from '../models/user.model';

describe('authGuard', () => {
  let auth: { user: ReturnType<typeof signal<KiximaUser | null>>; loading: ReturnType<typeof signal<boolean>>; sessaoIndeterminada: ReturnType<typeof signal<boolean>> };

  beforeEach(() => {
    auth = { user: signal(null), loading: signal(false), sessaoIndeterminada: signal(false) };
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: auth }, provideRouter([])],
    });
  });

  function correr() {
    let resultado: boolean | UrlTree = false;
    TestBed.runInInjectionContext(() => {
      (authGuard({} as never, {} as never) as Promise<boolean | UrlTree>).then((r) => (resultado = r));
    });
    return () => resultado;
  }

  it('deixa passar quando há utilizador autenticado', fakeAsync(() => {
    auth.user.set({ id: 'u1', name: 'Ana', email: 'a@a.co.ao', role: 'COMPRADOR', adminAreas: [], companyId: 'c1', companyName: 'X', companyType: 'CLIENTE', avatarUrl: null });
    const obter = correr();
    flushMicrotasks();
    expect(obter()).toBeTrue();
  }));

  it('manda para o login quando não há sessão nem indeterminação', fakeAsync(() => {
    const obter = correr();
    flushMicrotasks();
    expect((obter() as UrlTree).toString()).toBe('/login');
  }));

  it('deixa passar em sessão indeterminada — não expulsa por causa de um 429/falha de rede', fakeAsync(() => {
    auth.sessaoIndeterminada.set(true);
    const obter = correr();
    flushMicrotasks();
    expect(obter()).toBeTrue();
  }));
});
