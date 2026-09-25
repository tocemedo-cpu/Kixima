import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { NotificationsComponent } from './notifications.component';
import { NotificationsService } from '../../core/services/notifications.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationDto } from '../../core/models/notification.model';
import { KiximaUser } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(): KiximaUser {
  return { id: 'u1', name: 'Ana', email: 'a@a.co.ao', role: 'COMPRADOR', adminAreas: [], companyId: 'c1', companyType: 'CLIENTE', avatarUrl: null };
}

function notificacao(overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id: 'n1', userId: 'u1', type: 'PO_STATUS', channel: 'IN_APP', title: 'PO actualizada', message: 'A sua PO mudou de estado.',
    readAt: null, relatedEntityType: 'PurchaseOrder', relatedEntityId: 'po1', createdAt: '2026-01-01',
    ...overrides,
  };
}

function montar(notificacoes: NotificationDto[] = [notificacao()]) {
  const notificationsService = jasmine.createSpyObj<NotificationsService>('NotificationsService', ['list', 'markRead']);
  notificationsService.list.and.returnValue(of({ itens: notificacoes, total: notificacoes.length, pagina: 1, porPagina: 100, paginas: 1, porLer: notificacoes.filter((n) => !n.readAt).length }));
  const auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
  auth.user.and.returnValue(utilizador());
  const router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new NotificationsComponent(notificationsService, auth, router));
  return { componente, notificationsService, router };
}

describe('NotificationsComponent', () => {
  it('carrega as notificações ao arrancar', () => {
    const { componente } = montar();
    expect(componente.notifications()?.length).toBe(1);
  });

  it('destino() resolve a rota para uma PurchaseOrder do Comprador', () => {
    const { componente } = montar();
    expect(componente.destino(notificacao())).toBe('/comprador/ordens/po1');
  });

  it('clicavel() é true para não lidas, ou para lidas com destino conhecido', () => {
    const { componente } = montar();
    expect(componente.clicavel(notificacao({ readAt: null }))).toBeTrue();
    expect(componente.clicavel(notificacao({ readAt: '2026-01-02' }))).toBeTrue();
    expect(componente.clicavel(notificacao({ readAt: '2026-01-02', relatedEntityType: 'Desconhecido' }))).toBeFalse();
  });

  it('abrir() marca como lida (localmente, com a hora actual) e navega para o destino', () => {
    const { componente, notificationsService, router } = montar();
    notificationsService.markRead.and.returnValue(of(notificacao({ readAt: '2026-01-02' })));
    componente.abrir(notificacao());
    expect(notificationsService.markRead).toHaveBeenCalledWith('n1');
    expect(componente.notifications()![0].readAt).toBeTruthy();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/comprador/ordens/po1');
  });

  it('abrir() não marca de novo uma notificação já lida, só navega', () => {
    const { componente, notificationsService, router } = montar([notificacao({ readAt: '2026-01-02' })]);
    componente.abrir(notificacao({ readAt: '2026-01-02' }));
    expect(notificationsService.markRead).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/comprador/ordens/po1');
  });

  it('abrir() não faz nada quando não é clicável', () => {
    const { componente, notificationsService, router } = montar();
    const n = notificacao({ readAt: '2026-01-02', relatedEntityType: 'Desconhecido' });
    componente.abrir(n);
    expect(notificationsService.markRead).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('regista o erro quando o carregamento falha', () => {
    const notificationsService = jasmine.createSpyObj<NotificationsService>('NotificationsService', ['list', 'markRead']);
    notificationsService.list.and.returnValue(throwError(() => new ApiError('Falha ao carregar.', 500)));
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    auth.user.and.returnValue(utilizador());
    const router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(() => new NotificationsComponent(notificationsService, auth, router));
    expect(componente.error()).toBe('Falha ao carregar.');
  });
});
