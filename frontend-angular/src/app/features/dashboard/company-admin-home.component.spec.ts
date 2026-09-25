import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CompanyAdminHomeComponent } from './company-admin-home.component';
import { DashboardService } from '../../core/services/dashboard.service';
import { CompanyAdminDashboardResponse } from '../../core/models/dashboard.model';
import { ApiError } from '../../core/models/api-error.model';

function resposta(): CompanyAdminDashboardResponse {
  return {
    kpis: { pedidos: 10, emExecucao: 3, volumeNegocios: 500000, aprovarPO: 2 },
    resumo: { usuariosAtivos: 5, contratosAtivos: 2, totalContratos: 3, concluidas: 8, compliance: 90 },
    volume: [{ label: 'Jan', value: 100 }, { label: 'Fev', value: 200 }],
    recent: [{ reference: 'PO-1', status: 'APROVADA', at: '2026-01-01', party: 'Kianda' }],
  };
}

describe('CompanyAdminHomeComponent', () => {
  let dashboardService: jasmine.SpyObj<DashboardService>;
  let router: jasmine.SpyObj<{ navigateByUrl: (c: string) => void }>;

  beforeEach(() => {
    dashboardService = jasmine.createSpyObj<DashboardService>('DashboardService', ['companyAdmin']);
    router = jasmine.createSpyObj('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  function montar(): CompanyAdminHomeComponent {
    return TestBed.runInInjectionContext(() => new CompanyAdminHomeComponent(dashboardService, router as never));
  }

  it('carrega o dashboard e monta os cartões de KPI', () => {
    dashboardService.companyAdmin.and.returnValue(of(resposta()));
    const c = montar();

    expect(c.kpisTopo().length).toBe(4);
    expect(c.kpisTopo()[0].value).toBe(10);
    expect(c.kpisResumo().length).toBe(4);
    expect(c.kpisResumo()[0].value).toBe(5);
  });

  it('alturaBarra() calcula a percentagem relativa ao máximo do volume', () => {
    dashboardService.companyAdmin.and.returnValue(of(resposta()));
    const c = montar();

    expect(c.alturaBarra(200)).toBe(100);
    expect(c.alturaBarra(100)).toBe(50);
  });

  it('regista o erro quando o carregamento falha', () => {
    dashboardService.companyAdmin.and.returnValue(throwError(() => new ApiError('Falha', 500)));
    const c = montar();

    expect(c.error()).toBe('Falha');
  });

  it('ir() navega para o caminho dado', () => {
    dashboardService.companyAdmin.and.returnValue(of(resposta()));
    const c = montar();

    c.ir('/empresa/utilizadores');

    expect(router.navigateByUrl).toHaveBeenCalledWith('/empresa/utilizadores');
  });
});
