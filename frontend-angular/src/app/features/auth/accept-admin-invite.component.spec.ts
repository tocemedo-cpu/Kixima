import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { AcceptAdminInviteComponent } from './accept-admin-invite.component';
import { AdminInviteService } from './admin-invite.service';
import { ApiError } from '../../core/models/api-error.model';

function rota(token = 'tok1'): ActivatedRoute {
  return { snapshot: { paramMap: { get: () => token } } } as unknown as ActivatedRoute;
}

describe('AcceptAdminInviteComponent', () => {
  let service: jasmine.SpyObj<AdminInviteService>;

  beforeEach(() => {
    service = jasmine.createSpyObj<AdminInviteService>('AdminInviteService', ['resolve', 'accept']);
    TestBed.configureTestingModule({});
  });

  it('resolve o convite ao arrancar', () => {
    service.resolve.and.returnValue(of({ name: 'Bruno', email: 'b@a.co', adminAreas: ['cadastro'] }));
    const c = TestBed.runInInjectionContext(() => new AcceptAdminInviteComponent(rota(), service));

    expect(service.resolve).toHaveBeenCalledWith('tok1');
    expect(c.invite()?.name).toBe('Bruno');
  });

  it('regista o erro de carregamento quando o convite é inválido', () => {
    service.resolve.and.returnValue(throwError(() => new ApiError('Convite expirado', 410)));
    const c = TestBed.runInInjectionContext(() => new AcceptAdminInviteComponent(rota(), service));
    expect(c.loadError()).toBe('Convite expirado');
  });

  it('submit() aceita o convite só com password + termsAccepted, e mostra done', fakeAsync(() => {
    service.resolve.and.returnValue(of({ name: 'Bruno', email: 'b@a.co', adminAreas: [] }));
    service.accept.and.returnValue(of({ id: 'u1', name: 'Bruno', email: 'b@a.co', role: 'ADMIN_SISTEMA', active: true, createdAt: '2026-01-01' }));
    const c = TestBed.runInInjectionContext(() => new AcceptAdminInviteComponent(rota(), service));
    c.password.set('senha123456');

    c.submit();
    flushMicrotasks();

    expect(service.accept).toHaveBeenCalledWith('tok1', { password: 'senha123456', termsAccepted: true });
    expect(c.done()).toBeTrue();
  }));

  it('submit() regista o erro quando o servidor recusa', fakeAsync(() => {
    service.resolve.and.returnValue(of({ name: 'Bruno', email: 'b@a.co', adminAreas: [] }));
    service.accept.and.returnValue(throwError(() => new ApiError('Senha fraca', 400)));
    const c = TestBed.runInInjectionContext(() => new AcceptAdminInviteComponent(rota(), service));
    c.password.set('123');

    c.submit();
    flushMicrotasks();

    expect(c.error()).toBe('Senha fraca');
  }));
});
