import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';
import { KiximaUser } from '../models/user.model';

function utilizador(role: KiximaUser['role']): KiximaUser {
  return { id: 'u1', name: 'Ana', email: 'a@a.co.ao', role, adminAreas: [], companyId: 'c1', companyName: 'X', companyType: 'CLIENTE', avatarUrl: null };
}

describe('roleGuard', () => {
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: auth }, provideRouter([])],
    });
  });

  function correr(...papeis: KiximaUser['role'][]): boolean | UrlTree {
    let resultado: boolean | UrlTree = false;
    TestBed.runInInjectionContext(() => {
      resultado = roleGuard(...papeis)({} as never, {} as never) as boolean | UrlTree;
    });
    return resultado;
  }

  it('deixa passar quando o papel do utilizador está na lista', () => {
    auth.user.and.returnValue(utilizador('FORNECEDOR'));
    expect(correr('FORNECEDOR', 'COMPANY_ADMIN')).toBeTrue();
  });

  it('manda o utilizador para a SUA área quando o papel não corresponde — não para a área pedida', () => {
    auth.user.and.returnValue(utilizador('FORNECEDOR'));
    const resultado = correr('ADMIN_SISTEMA');
    expect(resultado).not.toBe(true);
    expect((resultado as UrlTree).toString()).toBe('/fornecedor');
  });

  it('manda para o login quando não há sessão', () => {
    auth.user.and.returnValue(null);
    const resultado = correr('COMPRADOR');
    expect((resultado as UrlTree).toString()).toBe('/login');
  });
});
