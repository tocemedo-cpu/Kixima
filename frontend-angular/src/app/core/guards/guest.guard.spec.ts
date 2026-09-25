import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { guestGuard } from './guest.guard';
import { AuthService } from '../services/auth.service';
import { KiximaUser } from '../models/user.model';

describe('guestGuard', () => {
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: auth }, provideRouter([])],
    });
  });

  function correr(): boolean | UrlTree {
    let resultado: boolean | UrlTree = false;
    TestBed.runInInjectionContext(() => {
      resultado = guestGuard({} as never, {} as never) as boolean | UrlTree;
    });
    return resultado;
  }

  it('deixa entrar no login quando não há sessão', () => {
    auth.user.and.returnValue(null);
    expect(correr()).toBeTrue();
  });

  it('manda quem já tem sessão para a sua área, sem mostrar o login outra vez', () => {
    const user: KiximaUser = {
      id: 'u1', name: 'Ana', email: 'a@a.co.ao', role: 'FINANCEIRO',
      adminAreas: [], companyId: 'c1', companyName: 'X', companyType: 'CLIENTE', avatarUrl: null,
    };
    auth.user.and.returnValue(user);
    const resultado = correr();
    expect((resultado as UrlTree).toString()).toBe('/financeiro');
  });
});
