import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CompradorHomeComponent } from './comprador-home.component';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { NotificationsService } from '../../core/services/notifications.service';
import { MarketplaceService } from '../catalog/marketplace.service';
import { CompradorDashboardResponse } from '../../core/models/dashboard.model';
import { KiximaUser } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(): KiximaUser {
  return { id: 'u1', name: 'Ana Silva', email: 'a@a.co', role: 'COMPRADOR', adminAreas: [], companyId: 'c1', companyType: 'CLIENTE', avatarUrl: null };
}

function dash(): CompradorDashboardResponse {
  return {
    kpis: { emAndamento: 3, aguardandoPagamento: { count: 1, total: 500 }, emEntrega: { count: 2, total: 800 }, recebidasMes: 4 },
    minhasOrdens: [{ label: 'Em aprovação', count: 2 }],
  };
}

describe('CompradorHomeComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let dashboardService: jasmine.SpyObj<DashboardService>;
  let marketplaceService: jasmine.SpyObj<MarketplaceService>;
  let notificationsService: jasmine.SpyObj<NotificationsService>;
  let router: jasmine.SpyObj<{ navigateByUrl: (c: string) => void }>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    dashboardService = jasmine.createSpyObj<DashboardService>('DashboardService', ['comprador']);
    marketplaceService = jasmine.createSpyObj<MarketplaceService>('MarketplaceService', ['facets', 'search', 'suppliers']);
    notificationsService = jasmine.createSpyObj<NotificationsService>('NotificationsService', ['list']);
    router = jasmine.createSpyObj('Router', ['navigateByUrl']);
    auth.user.and.returnValue(utilizador());
    dashboardService.comprador.and.returnValue(of(dash()));
    marketplaceService.facets.and.returnValue(of({ categories: [{ name: 'Válvulas', count: 3 }], kinds: [], countries: [], certifications: [], priceBounds: { min: 0, max: 0 } }));
    marketplaceService.search.and.returnValue(of({ items: [], total: 0, page: 1, pages: 1, limit: 4 }));
    marketplaceService.suppliers.and.returnValue(of([]));
    notificationsService.list.and.returnValue(of({ itens: [], total: 0, pagina: 1, porPagina: 20, paginas: 0, porLer: 0 }));
    TestBed.configureTestingModule({});
  });

  function montar(): CompradorHomeComponent {
    return TestBed.runInInjectionContext(
      () => new CompradorHomeComponent(auth, dashboardService, marketplaceService, notificationsService, router as never),
    );
  }

  it('carrega os 6 pedidos em paralelo e combina os dados', () => {
    const c = montar();

    expect(dashboardService.comprador).toHaveBeenCalled();
    expect(marketplaceService.facets).toHaveBeenCalled();
    expect(marketplaceService.search).toHaveBeenCalledWith({ sort: 'solicitados', limit: 4 });
    expect(marketplaceService.search).toHaveBeenCalledWith({ sort: 'vendidos', limit: 5 });
    expect(marketplaceService.suppliers).toHaveBeenCalled();
    expect(notificationsService.list).toHaveBeenCalled();
    expect(c.d()?.categories.length).toBe(1);
    expect(c.firstName()).toBe('Ana');
  });

  it('notifs fica limitado aos primeiros 6', () => {
    notificationsService.list.and.returnValue(
      of({ itens: Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, userId: 'u1', type: 'X', channel: 'IN_APP', message: 'm', createdAt: '2026-01-01' })), total: 10, pagina: 1, porPagina: 20, paginas: 1, porLer: 0 }),
    );
    const c = montar();

    expect(c.d()?.notifs.length).toBe(6);
  });

  it('regista o erro quando algum dos pedidos falha', () => {
    marketplaceService.suppliers.and.returnValue(throwError(() => new ApiError('Falha', 500)));
    const c = montar();

    expect(c.error()).toBe('Falha');
  });

  it('timeAgo() formata minutos/horas/dias', () => {
    const c = montar();
    const agora = Date.now();
    expect(c.timeAgo(new Date(agora - 5 * 60_000).toISOString())).toBe('há 5 min');
    expect(c.timeAgo(new Date(agora - 3 * 3600_000).toISOString())).toBe('há 3h');
  });

  it('initials() extrai as iniciais do nome', () => {
    const c = montar();
    expect(c.initials('Fornecedora Industrial Kianda')).toBe('FI');
    expect(c.initials('')).toBe('?');
  });

  it('submitSearch() navega para /comprador/servicos com o termo', () => {
    const c = montar();
    c.q.set('válvula');

    c.submitSearch();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/comprador/servicos?q=v%C3%A1lvula');
  });
});
