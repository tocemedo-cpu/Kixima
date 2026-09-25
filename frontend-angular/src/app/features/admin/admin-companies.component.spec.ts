import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminCompaniesComponent } from './admin-companies.component';
import { CompaniesService } from './companies.service';
import { CompanyDetail, CompanyListItem } from '../../core/models/company.model';
import { ApiError } from '../../core/models/api-error.model';

function empresa(id: string, overrides: Partial<CompanyListItem> = {}): CompanyListItem {
  return { id, name: `Empresa ${id}`, taxId: 'AO-1', type: 'CLIENTE', status: 'APROVADA', contactEmail: 'a@a.co', verified: true, createdAt: '2026-01-01', ...overrides };
}

function montar() {
  const companiesService = jasmine.createSpyObj<CompaniesService>('CompaniesService', ['list', 'get']);
  companiesService.list.and.returnValue(of([empresa('1'), empresa('2')]));
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new AdminCompaniesComponent(companiesService));
  return { componente, companiesService };
}

describe('AdminCompaniesComponent', () => {
  it('carrega todas as empresas sem filtros ao arrancar', () => {
    const { componente, companiesService } = montar();
    expect(companiesService.list).toHaveBeenCalledWith(undefined, undefined);
    expect(componente.companies()?.length).toBe(2);
  });

  it('setType() recarrega com o filtro de tipo', () => {
    const { componente, companiesService } = montar();
    componente.setType('FORNECEDOR');
    expect(companiesService.list).toHaveBeenCalledWith(undefined, 'FORNECEDOR');
  });

  it('setStatus() recarrega com o filtro de estado', () => {
    const { componente, companiesService } = montar();
    componente.setStatus('PENDENTE');
    expect(companiesService.list).toHaveBeenCalledWith('PENDENTE', undefined);
  });

  it('setType() e setStatus() combinam-se no mesmo pedido', () => {
    const { componente, companiesService } = montar();
    componente.setType('CLIENTE');
    componente.setStatus('APROVADA');
    expect(companiesService.list).toHaveBeenCalledWith('APROVADA', 'CLIENTE');
  });

  it('toggle() expande uma linha e carrega a ficha detalhada', () => {
    const { componente, companiesService } = montar();
    const detalhe: CompanyDetail = { ...empresa('1'), contactPhone: '923000000' };
    companiesService.get.and.returnValue(of(detalhe));
    componente.toggle(empresa('1'));
    expect(companiesService.get).toHaveBeenCalledWith('1');
    expect(componente.expanded()).toBe('1');
    expect(componente.expandedCompany()).toEqual(detalhe);
  });

  it('toggle() na mesma linha colapsa em vez de recarregar', () => {
    const { componente, companiesService } = montar();
    companiesService.get.and.returnValue(of(empresa('1')));
    componente.toggle(empresa('1'));
    componente.toggle(empresa('1'));
    expect(componente.expanded()).toBeNull();
    expect(componente.expandedCompany()).toBeNull();
  });

  it('regista o erro quando o carregamento falha', () => {
    const companiesService = jasmine.createSpyObj<CompaniesService>('CompaniesService', ['list', 'get']);
    companiesService.list.and.returnValue(throwError(() => new ApiError('Falha ao carregar.', 500)));
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(() => new AdminCompaniesComponent(companiesService));
    expect(componente.error()).toBe('Falha ao carregar.');
  });
});
