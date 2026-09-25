import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { UsersComponent } from './users.component';
import { AuthService } from '../../core/services/auth.service';
import { CompaniesService } from '../admin/companies.service';
import { TeamService } from './team.service';
import { CompanyDetail } from '../../core/models/company.model';
import { CompanyUserDto } from '../../core/models/invite.model';
import { KiximaUser } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(): KiximaUser {
  return { id: 'admin1', name: 'Bruno', email: 'b@a.co', role: 'COMPANY_ADMIN', adminAreas: [], companyId: 'c1', companyType: 'CLIENTE', avatarUrl: null };
}

function empresa(type: 'CLIENTE' | 'FORNECEDOR' = 'CLIENTE'): CompanyDetail {
  return { id: 'c1', name: 'Petro Angola', taxId: 'AO-1', type, status: 'APROVADA', contactEmail: 'a@a.co', verified: true, createdAt: '2026-01-01' };
}

function membro(overrides: Partial<CompanyUserDto> = {}): CompanyUserDto {
  return { id: 'u1', name: 'Ana', email: 'ana@a.co', role: 'COMPRADOR', active: true, createdAt: '2026-01-01', ...overrides };
}

describe('UsersComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let companiesService: jasmine.SpyObj<CompaniesService>;
  let teamService: jasmine.SpyObj<TeamService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    companiesService = jasmine.createSpyObj<CompaniesService>('CompaniesService', ['get']);
    teamService = jasmine.createSpyObj<TeamService>('TeamService', [
      'listUsers', 'listInvites', 'createInvite', 'resendInvite', 'cancelInvite', 'activateUser', 'removeUser',
    ]);
    auth.user.and.returnValue(utilizador());
    companiesService.get.and.returnValue(of(empresa()));
    teamService.listUsers.and.returnValue(of([membro()]));
    teamService.listInvites.and.returnValue(of([]));
    TestBed.configureTestingModule({});
  });

  function montar(): UsersComponent {
    return TestBed.runInInjectionContext(() => new UsersComponent(auth, companiesService, teamService));
  }

  it('carrega a empresa, os utilizadores e os convites ao arrancar', () => {
    const c = montar();

    expect(companiesService.get).toHaveBeenCalledWith('c1');
    expect(c.users()?.length).toBe(1);
  });

  it('options() reflecte o tipo da empresa — CLIENTE não pode convidar Vendedor', () => {
    companiesService.get.and.returnValue(of(empresa('CLIENTE')));
    const cliente = montar();
    expect(cliente.options().map((o) => o.value)).toEqual(['COMPRADOR', 'FINANCEIRO']);

    companiesService.get.and.returnValue(of(empresa('FORNECEDOR')));
    const fornecedor = montar();
    expect(fornecedor.options().map((o) => o.value)).toEqual(['COMPRADOR', 'FORNECEDOR', 'FINANCEIRO']);
  });

  it('roleLabel() chama FORNECEDOR de "Vendedor" numa empresa FORNECEDORA', () => {
    companiesService.get.and.returnValue(of(empresa('FORNECEDOR')));
    const c = montar();
    expect(c.roleLabel('FORNECEDOR')).toBe('Vendedor');
    expect(c.roleLabel('COMPANY_ADMIN')).toBe('Company Admin');
  });

  it('pending() só inclui utilizadores inactivos; list() filtra por nome/email', () => {
    teamService.listUsers.and.returnValue(of([
      membro({ id: '1', name: 'Ana Silva', email: 'ana@a.co', active: true }),
      membro({ id: '2', name: 'Bruno Costa', email: 'bruno@a.co', active: false }),
    ]));
    const c = montar();

    expect(c.pending().map((u) => u.id)).toEqual(['2']);

    c.q.set('silva');
    expect(c.list().map((u) => u.id)).toEqual(['1']);
  });

  it('openInviteModal() reinicia o formulário com o primeiro perfil disponível', () => {
    const c = montar();
    c.name.set('lixo');
    c.email.set('lixo@a.co');

    c.openInviteModal();

    expect(c.modal()).toBeTrue();
    expect(c.name()).toBe('');
    expect(c.email()).toBe('');
    expect(c.role()).toBe('COMPRADOR');
  });

  it('sendInvite() chama o serviço, fecha o modal e recarrega os convites', fakeAsync(() => {
    teamService.createInvite.and.returnValue(of({}));
    const c = montar();
    c.modal.set(true);
    c.name.set('Carlos');
    c.email.set('carlos@a.co');
    c.role.set('FINANCEIRO');

    c.sendInvite();
    flushMicrotasks();

    expect(teamService.createInvite).toHaveBeenCalledWith({ role: 'FINANCEIRO', name: 'Carlos', email: 'carlos@a.co' });
    expect(c.modal()).toBeFalse();
    expect(c.toast()).toContain('Convite enviado');
    expect(teamService.listInvites).toHaveBeenCalledTimes(2);
  }));

  it('sendInvite() regista o erro (objecto ApiError completo, não só a mensagem)', fakeAsync(() => {
    const erro = new ApiError('Limite de utilizadores do plano atingido', 403, 'PLANO_INSUFICIENTE');
    teamService.createInvite.and.returnValue(throwError(() => erro));
    const c = montar();

    c.sendInvite();
    flushMicrotasks();

    expect(c.formError()).toBe(erro);
  }));

  it('accept()/reject() chamam o serviço e recarregam os utilizadores', () => {
    teamService.activateUser.and.returnValue(of({}));
    teamService.removeUser.and.returnValue(of({}));
    const c = montar();

    c.accept('u1', 'Ana');
    expect(teamService.activateUser).toHaveBeenCalledWith('u1');
    expect(c.toast()).toContain('aceite');

    c.reject('u1', 'Ana');
    expect(teamService.removeUser).toHaveBeenCalledWith('u1');
    expect(c.toast()).toContain('removido');
  });

  it('resendInvite()/cancelInvite() chamam o serviço e recarregam os convites', () => {
    teamService.resendInvite.and.returnValue(of({}));
    teamService.cancelInvite.and.returnValue(of({}));
    const c = montar();

    c.resendInvite('inv1', 'ana@a.co');
    expect(teamService.resendInvite).toHaveBeenCalledWith('inv1');

    c.cancelInvite('inv1');
    expect(teamService.cancelInvite).toHaveBeenCalledWith('inv1');
  });
});
