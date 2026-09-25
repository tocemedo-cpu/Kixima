import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { AcceptInviteComponent } from './accept-invite.component';
import { InviteService } from './invite.service';
import { ResolvedInviteDto } from '../../core/models/invite.model';
import { ApiError } from '../../core/models/api-error.model';

function rota(token = 'tok1'): ActivatedRoute {
  return { snapshot: { paramMap: { get: () => token } } } as unknown as ActivatedRoute;
}

function convite(overrides: Partial<ResolvedInviteDto> = {}): ResolvedInviteDto {
  return { companyName: 'Kianda', companyType: 'FORNECEDOR', role: 'FORNECEDOR', name: null, email: null, ...overrides };
}

describe('AcceptInviteComponent', () => {
  let inviteService: jasmine.SpyObj<InviteService>;

  beforeEach(() => {
    inviteService = jasmine.createSpyObj<InviteService>('InviteService', ['resolve', 'accept']);
    TestBed.configureTestingModule({});
  });

  it('resolve o convite ao arrancar e pré-preenche nome/email quando vêm definidos', () => {
    inviteService.resolve.and.returnValue(of(convite({ name: 'Ana', email: 'ana@a.co' })));
    const c = TestBed.runInInjectionContext(() => new AcceptInviteComponent(rota(), inviteService));

    expect(inviteService.resolve).toHaveBeenCalledWith('tok1');
    expect(c.name()).toBe('Ana');
    expect(c.email()).toBe('ana@a.co');
  });

  it('isFounding() é verdadeiro só para convite de COMPANY_ADMIN', () => {
    inviteService.resolve.and.returnValue(of(convite({ role: 'COMPANY_ADMIN' })));
    const c = TestBed.runInInjectionContext(() => new AcceptInviteComponent(rota(), inviteService));
    expect(c.isFounding()).toBeTrue();
  });

  it('minimoSenha() é 12 para perfis sensíveis, 10 para os restantes', () => {
    inviteService.resolve.and.returnValue(of(convite({ role: 'FINANCEIRO' })));
    const sensivel = TestBed.runInInjectionContext(() => new AcceptInviteComponent(rota(), inviteService));
    expect(sensivel.minimoSenha()).toBe(12);

    inviteService.resolve.and.returnValue(of(convite({ role: 'COMPRADOR' })));
    const comum = TestBed.runInInjectionContext(() => new AcceptInviteComponent(rota(), inviteService));
    expect(comum.minimoSenha()).toBe(10);
  });

  it('regista o erro de carregamento quando o convite é inválido', () => {
    inviteService.resolve.and.returnValue(throwError(() => new ApiError('Convite expirado', 410)));
    const c = TestBed.runInInjectionContext(() => new AcceptInviteComponent(rota(), inviteService));
    expect(c.loadError()).toBe('Convite expirado');
  });

  it('submit() aceita o convite e mostra done', fakeAsync(() => {
    inviteService.resolve.and.returnValue(of(convite()));
    inviteService.accept.and.returnValue(of({ id: 'u1', name: 'Ana', email: 'a@a.co', role: 'FORNECEDOR', active: false, createdAt: '2026-01-01' }));
    const c = TestBed.runInInjectionContext(() => new AcceptInviteComponent(rota(), inviteService));
    c.name.set('Ana');
    c.email.set('ana@a.co');
    c.password.set('senha123456');

    c.submit();
    flushMicrotasks();

    expect(inviteService.accept).toHaveBeenCalledWith('tok1', { name: 'Ana', email: 'ana@a.co', password: 'senha123456', termsAccepted: true });
    expect(c.done()).toBeTrue();
  }));
});
