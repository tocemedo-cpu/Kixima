import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { FinanceiroHomeComponent } from './financeiro-home.component';
import { AuthService } from '../../core/services/auth.service';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { FinanceiroOverviewResponse } from '../../core/models/financeiro.model';
import { KiximaUser } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(companyType: 'CLIENTE' | 'FORNECEDOR'): KiximaUser {
  return { id: 'u1', name: 'Ana', email: 'a@a.co', role: 'FINANCEIRO', adminAreas: [], companyId: 'c1', companyType, avatarUrl: null };
}

function overview(): FinanceiroOverviewResponse {
  return {
    kpis: { pagamentosPendentes: 1000, pagamentosPendentesCount: 2, faturasRecebidas: 10, pagosMes: 500, aprovacoesPendentes: 1, aVencer7: 1 },
    series: [{ label: 'Jan', faturas: 10, pagamentos: 5 }, { label: 'Fev', faturas: 20, pagamentos: 15 }],
    pendentes: [{ id: 'i1', reference: 'FAT-1', supplier: 'Kianda', amount: 500, currency: 'AOA', status: 'PENDENTE', issuedAt: '2026-01-01', dueAt: '2026-01-10' }],
  };
}

describe('FinanceiroHomeComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let financeiroService: jasmine.SpyObj<FinanceiroService>;
  let router: jasmine.SpyObj<{ navigateByUrl: (c: string) => void }>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    financeiroService = jasmine.createSpyObj<FinanceiroService>('FinanceiroService', ['overview']);
    router = jasmine.createSpyObj('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  function montar(): FinanceiroHomeComponent {
    return TestBed.runInInjectionContext(() => new FinanceiroHomeComponent(auth, financeiroService, router as never));
  }

  it('empresa CLIENTE: carrega /api/financeiro/overview e monta os KPIs', () => {
    auth.user.and.returnValue(utilizador('CLIENTE'));
    financeiroService.overview.and.returnValue(of(overview()));
    const c = montar();

    expect(c.isSupplierSide).toBeFalse();
    expect(financeiroService.overview).toHaveBeenCalled();
    expect(c.kpis().length).toBe(4);
  });

  it('empresa FORNECEDORA: não chama overview() — delega ao SupplierFinanceCenter', () => {
    auth.user.and.returnValue(utilizador('FORNECEDOR'));
    const c = montar();

    expect(c.isSupplierSide).toBeTrue();
    expect(financeiroService.overview).not.toHaveBeenCalled();
  });

  it('alturaBarra() calcula a percentagem relativa ao máximo da série', () => {
    auth.user.and.returnValue(utilizador('CLIENTE'));
    financeiroService.overview.and.returnValue(of(overview()));
    const c = montar();

    expect(c.alturaBarra(20)).toBe(100);
    expect(c.alturaBarra(10)).toBe(50);
  });

  it('regista o erro quando o carregamento falha (lado CLIENTE)', () => {
    auth.user.and.returnValue(utilizador('CLIENTE'));
    financeiroService.overview.and.returnValue(throwError(() => new ApiError('Falha', 500)));
    const c = montar();

    expect(c.error()).toBe('Falha');
  });
});
