import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminContractsComponent } from './admin-contracts.component';
import { ContractsService } from '../contracts/contracts.service';
import { CompaniesService } from './companies.service';
import { ContractDto } from '../../core/models/contract.model';
import { CompanyListItem } from '../../core/models/company.model';
import { ApiError } from '../../core/models/api-error.model';

function empresa(id: string, overrides: Partial<CompanyListItem> = {}): CompanyListItem {
  return { id, name: `Empresa ${id}`, taxId: 'AO-1', type: 'CLIENTE', status: 'APROVADA', contactEmail: 'a@a.co', verified: true, createdAt: '2026-01-01', ...overrides };
}

function contrato(overrides: Partial<ContractDto> = {}): ContractDto {
  return {
    id: 'ct1', reference: 'CTR-2026-0001', clientCompanyId: 'c1', clientCompany: { id: 'c1', name: 'Cliente Lda' },
    supplierCompanyId: 's1', supplierCompany: { id: 's1', name: 'Fornecedora Lda' },
    categoriesCovered: ['Válvulas'], totalValue: '1000000', currency: 'AOA', usedValue: '0',
    billingPeriodicity: 'TRIMESTRAL', paymentTermDays: 30, status: 'ATIVO',
    validFrom: '2026-01-01T00:00:00Z', validUntil: '2026-12-31T00:00:00Z', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  };
}

function montar() {
  const contractsService = jasmine.createSpyObj<ContractsService>('ContractsService', ['list', 'create']);
  const companiesService = jasmine.createSpyObj<CompaniesService>('CompaniesService', ['list']);
  contractsService.list.and.returnValue(of([contrato()]));
  companiesService.list.and.returnValue(of([empresa('c1')]));
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new AdminContractsComponent(contractsService, companiesService));
  return { componente, contractsService, companiesService };
}

describe('AdminContractsComponent', () => {
  it('carrega os contratos e as empresas aprovadas (cliente e fornecedor) ao arrancar', () => {
    const { componente, contractsService, companiesService } = montar();
    expect(contractsService.list).toHaveBeenCalled();
    expect(companiesService.list).toHaveBeenCalledWith('APROVADA', 'CLIENTE');
    expect(companiesService.list).toHaveBeenCalledWith('APROVADA', 'FORNECEDOR');
    expect(componente.contracts()?.length).toBe(1);
  });

  it('toggleForm() alterna a visibilidade e limpa mensagens', () => {
    const { componente } = montar();
    componente.error.set('erro');
    componente.success.set('sucesso');
    componente.toggleForm();
    expect(componente.showForm()).toBeTrue();
    expect(componente.error()).toBe('');
    expect(componente.success()).toBe('');
  });

  it('submit() recusa quando não há categorias', () => {
    const { componente, contractsService } = montar();
    componente.form.set({
      clientCompanyId: 'c1', supplierCompanyId: 's1', categoriesCovered: '  , ,',
      totalValue: '1000', currency: 'AOA', billingPeriodicity: 'TRIMESTRAL',
      paymentTermDays: '30', validFrom: '2026-01-01', validUntil: '2026-12-31',
    });
    componente.submit();
    expect(componente.error()).toBe('Indique pelo menos uma categoria coberta pelo contrato.');
    expect(contractsService.create).not.toHaveBeenCalled();
  });

  it('submit() converte as datas do <input type=date> para instantes ISO completos', () => {
    const { componente, contractsService } = montar();
    contractsService.create.and.returnValue(of(contrato({ reference: 'CTR-2026-0002' })));
    componente.form.set({
      clientCompanyId: 'c1', supplierCompanyId: 's1', categoriesCovered: 'Válvulas, Tubagem',
      totalValue: '5000', currency: 'AOA', billingPeriodicity: 'SEMESTRAL',
      paymentTermDays: '45', validFrom: '2026-02-01', validUntil: '2026-08-01',
    });
    componente.submit();
    const corpo = contractsService.create.calls.mostRecent().args[0];
    expect(corpo.categoriesCovered).toEqual(['Válvulas', 'Tubagem']);
    expect(corpo.totalValue).toBe(5000);
    expect(corpo.paymentTermDays).toBe(45);
    expect(corpo.validFrom).toBe(new Date('2026-02-01').toISOString());
    expect(corpo.validUntil).toBe(new Date('2026-08-01').toISOString());
    expect(componente.success()).toBe('Contrato CTR-2026-0002 criado. As POs elegíveis passam agora a Call-off.');
    expect(componente.showForm()).toBeFalse();
  });

  it('submit() regista o erro do servidor (ex.: PLANO_INSUFICIENTE) sem limpar o formulário', () => {
    const { componente, contractsService } = montar();
    contractsService.create.and.returnValue(throwError(() => new ApiError('Requer o plano PRO.', 400, 'PLANO_INSUFICIENTE')));
    componente.form.set({
      clientCompanyId: 'c1', supplierCompanyId: 's1', categoriesCovered: 'Válvulas',
      totalValue: '5000', currency: 'AOA', billingPeriodicity: 'TRIMESTRAL',
      paymentTermDays: '30', validFrom: '2026-02-01', validUntil: '2026-08-01',
    });
    componente.submit();
    expect(componente.error()).toBe('Requer o plano PRO.');
    expect(componente.form().clientCompanyId).toBe('c1');
  });

  it('nomeEmpresa() devolve — quando o lado não vem preenchido', () => {
    const { componente } = montar();
    expect(componente.nomeEmpresa(contrato({ clientCompany: undefined }), 'client')).toBe('—');
    expect(componente.nomeEmpresa(contrato(), 'supplier')).toBe('Fornecedora Lda');
  });

  it('regista o erro quando o carregamento da lista falha', () => {
    const contractsService = jasmine.createSpyObj<ContractsService>('ContractsService', ['list', 'create']);
    const companiesService = jasmine.createSpyObj<CompaniesService>('CompaniesService', ['list']);
    contractsService.list.and.returnValue(throwError(() => new ApiError('Falha ao carregar.', 500)));
    companiesService.list.and.returnValue(of([]));
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(() => new AdminContractsComponent(contractsService, companiesService));
    expect(componente.error()).toBe('Falha ao carregar.');
  });
});
