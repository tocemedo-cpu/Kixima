import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ContractsComponent } from './contracts.component';
import { ContractsService } from './contracts.service';
import { AuthService } from '../../core/services/auth.service';
import { ContractDto } from '../../core/models/contract.model';
import { KiximaUser } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(companyId = 'c1'): KiximaUser {
  return { id: 'u1', name: 'Bruno', email: 'b@a.co.ao', role: 'COMPANY_ADMIN', adminAreas: [], companyId, companyType: 'CLIENTE', avatarUrl: null };
}

function contrato(overrides: Partial<ContractDto> = {}): ContractDto {
  return {
    id: 'ct1', reference: 'CTR-2026-0001', clientCompanyId: 'c1', clientCompany: { id: 'c1', name: 'Cliente Lda' },
    supplierCompanyId: 's1', supplierCompany: { id: 's1', name: 'Fornecedora Lda' },
    categoriesCovered: ['valvulas'], totalValue: '1000000', currency: 'AOA', usedValue: '250000',
    billingPeriodicity: 'TRIMESTRAL', paymentTermDays: 30, status: 'ATIVO',
    validFrom: '2026-01-01', validUntil: '2026-12-31', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('ContractsComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let contractsService: jasmine.SpyObj<ContractsService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    contractsService = jasmine.createSpyObj<ContractsService>('ContractsService', ['list']);
    TestBed.configureTestingModule({});
  });

  it('contraparte() é o fornecedor quando a empresa do utilizador é a cliente do contrato', () => {
    auth.user.and.returnValue(utilizador('c1'));
    contractsService.list.and.returnValue(of([contrato()]));
    const component = TestBed.runInInjectionContext(() => new ContractsComponent(auth, contractsService));

    expect(component.contraparte(component.rows()![0])?.name).toBe('Fornecedora Lda');
  });

  it('contraparte() é o cliente quando a empresa do utilizador é a fornecedora do contrato', () => {
    auth.user.and.returnValue(utilizador('s1'));
    contractsService.list.and.returnValue(of([contrato()]));
    const component = TestBed.runInInjectionContext(() => new ContractsComponent(auth, contractsService));

    expect(component.contraparte(component.rows()![0])?.name).toBe('Cliente Lda');
  });

  it('kpis() conta ativos/a vencer/vencidos e soma o valor total — mesma regra de Contracts.jsx', () => {
    auth.user.and.returnValue(utilizador());
    const emBreve = new Date(Date.now() + 10 * 864e5).toISOString(); // dentro de 30 dias
    const longe = new Date(Date.now() + 200 * 864e5).toISOString();
    contractsService.list.and.returnValue(of([
      contrato({ id: '1', status: 'ATIVO', validUntil: emBreve, totalValue: '100' }),
      contrato({ id: '2', status: 'ATIVO', validUntil: longe, totalValue: '200' }),
      contrato({ id: '3', status: 'EXPIRADO', totalValue: '300' }),
    ]));
    const component = TestBed.runInInjectionContext(() => new ContractsComponent(auth, contractsService));

    const k = component.kpis();
    expect(k.total).toBe(3);
    expect(k.ativos).toBe(2);
    expect(k.aVencer).toBe(1);
    expect(k.vencidos).toBe(1);
    expect(k.valor).toBe(600);
  });

  it('list() filtra por referência ou nome da contraparte (case-insensitive)', () => {
    auth.user.and.returnValue(utilizador('c1'));
    contractsService.list.and.returnValue(of([
      contrato({ id: '1', reference: 'CTR-2026-0001', supplierCompany: { id: 's1', name: 'Kianda' } }),
      contrato({ id: '2', reference: 'CTR-2026-0002', supplierCompany: { id: 's2', name: 'Outra' } }),
    ]));
    const component = TestBed.runInInjectionContext(() => new ContractsComponent(auth, contractsService));

    component.q.set('kianda');
    expect(component.list().map((c) => c.id)).toEqual(['1']);

    component.q.set('0002');
    expect(component.list().map((c) => c.id)).toEqual(['2']);
  });

  it('proximosAVencer() só inclui ATIVO, ordenado por validUntil ascendente, no máximo 5', () => {
    auth.user.and.returnValue(utilizador());
    const rows = [
      contrato({ id: '1', status: 'ATIVO', validUntil: '2026-06-01' }),
      contrato({ id: '2', status: 'EXPIRADO', validUntil: '2026-02-01' }),
      contrato({ id: '3', status: 'ATIVO', validUntil: '2026-03-01' }),
    ];
    contractsService.list.and.returnValue(of(rows));
    const component = TestBed.runInInjectionContext(() => new ContractsComponent(auth, contractsService));

    expect(component.proximosAVencer().map((c) => c.id)).toEqual(['3', '1']);
  });

  it('regista o erro quando o carregamento falha', () => {
    auth.user.and.returnValue(utilizador());
    contractsService.list.and.returnValue(throwError(() => new ApiError('Sem permissão', 403)));
    const component = TestBed.runInInjectionContext(() => new ContractsComponent(auth, contractsService));

    expect(component.error()).toBe('Sem permissão');
  });
});
