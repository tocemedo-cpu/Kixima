// Testa a mesma regra condicional de canApprove que o React usa: cliente
// aprova sempre, fornecedor só com apólice submetida — e o ciclo
// ngOnChanges → carrega o detalhe só quando expandido pela primeira vez.
import { TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CompanyReviewCardComponent } from './company-review-card.component';
import { CompaniesService } from './companies.service';
import { CompanyDetail, CompanyListItem, SupplierPolicyDto } from '../../core/models/company.model';
import { ApiError } from '../../core/models/api-error.model';

function empresa(overrides: Partial<CompanyListItem> = {}): CompanyListItem {
  return { id: 'c1', name: 'Kianda', taxId: 'AO-1', type: 'CLIENTE', status: 'PENDENTE', contactEmail: 'a@a.co', createdAt: '2026-01-01', ...overrides };
}

function apolice(overrides: Partial<SupplierPolicyDto> = {}): SupplierPolicyDto {
  return {
    id: 'p1', companyId: 'c1', policyNumber: 'POL-1', insurer: 'Seguradora', coverageAmount: '1000000', currency: 'AOA',
    status: 'SUBMETIDA', validFrom: '2026-01-01', validUntil: '2026-12-31', createdAt: '2026-01-01', updatedAt: '2026-01-01', ...overrides,
  };
}

describe('CompanyReviewCardComponent', () => {
  let companiesService: jasmine.SpyObj<CompaniesService>;

  beforeEach(() => {
    companiesService = jasmine.createSpyObj<CompaniesService>('CompaniesService', ['get', 'decide']);
    TestBed.configureTestingModule({});
  });

  function montar(company: CompanyListItem): CompanyReviewCardComponent {
    const c = TestBed.runInInjectionContext(() => new CompanyReviewCardComponent(companiesService));
    c.company = company;
    return c;
  }

  it('carrega o detalhe só quando expande pela primeira vez', () => {
    companiesService.get.and.returnValue(of({} as CompanyDetail));
    const c = montar(empresa());

    c.expanded = false;
    c.ngOnChanges({ expanded: new SimpleChange(true, false, true) });
    expect(companiesService.get).not.toHaveBeenCalled();

    c.expanded = true;
    c.ngOnChanges({ expanded: new SimpleChange(false, true, false) });
    expect(companiesService.get).toHaveBeenCalledWith('c1');
  });

  it('canApprove é sempre verdadeiro para CLIENTE', () => {
    const c = montar(empresa({ type: 'CLIENTE' }));
    expect(c.canApprove).toBeTrue();
  });

  it('canApprove exige apólice submetida para FORNECEDOR', () => {
    const c = montar(empresa({ type: 'FORNECEDOR' }));
    c.detail = { ...empresa({ type: 'FORNECEDOR' }), supplierPolicies: [] } as CompanyDetail;
    expect(c.canApprove).toBeFalse();

    c.detail = { ...empresa({ type: 'FORNECEDOR' }), supplierPolicies: [apolice()] } as CompanyDetail;
    expect(c.canApprove).toBeTrue();
  });

  it('decide() chama o serviço, mostra sucesso e emite decided', async () => {
    companiesService.decide.and.returnValue(of({} as CompanyDetail));
    const c = montar(empresa());
    const emitido = spyOn(c.decided, 'emit');

    await c.decide(true);

    expect(companiesService.decide).toHaveBeenCalledWith('c1', { approve: true });
    expect(c.success).toBe('Empresa aprovada.');
    expect(emitido).toHaveBeenCalled();
    expect(c.busy).toBeFalse();
  });

  it('decide() regista o erro quando o servidor recusa', async () => {
    companiesService.decide.and.returnValue(throwError(() => new ApiError('Sem apólice', 400)));
    const c = montar(empresa());

    await c.decide(true);

    expect(c.error).toBe('Sem apólice');
    expect(c.busy).toBeFalse();
  });
});
