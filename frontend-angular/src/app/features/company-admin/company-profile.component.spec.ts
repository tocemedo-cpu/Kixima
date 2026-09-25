import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CompanyProfileComponent } from './company-profile.component';
import { AuthService } from '../../core/services/auth.service';
import { CompaniesService } from '../admin/companies.service';
import { PoliciesService } from './policies.service';
import { CompanyDetail } from '../../core/models/company.model';
import { CompanyPoliciesDto, ClientPolicyDto } from '../../core/models/company-policies.model';
import { KiximaUser } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(): KiximaUser {
  return { id: 'u1', name: 'Bruno', email: 'b@a.co', role: 'COMPANY_ADMIN', adminAreas: [], companyId: 'c1', companyType: 'CLIENTE', avatarUrl: null };
}

function empresa(): CompanyDetail {
  return { id: 'c1', name: 'Petro Angola', taxId: 'AO-1', type: 'CLIENTE', status: 'APROVADA', contactEmail: 'a@a.co', verified: true, createdAt: '2026-01-01' };
}

function apoliceCliente(): ClientPolicyDto {
  return {
    id: 'p1', companyId: 'c1', policyNumber: 'POL-1', insurer: 'Seguradora', coverageAmount: '1000000', currency: 'AOA',
    status: 'APROVADA', validFrom: '2026-01-01', validUntil: '2026-12-31', createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

describe('CompanyProfileComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let companiesService: jasmine.SpyObj<CompaniesService>;
  let policiesService: jasmine.SpyObj<PoliciesService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    companiesService = jasmine.createSpyObj<CompaniesService>('CompaniesService', ['get']);
    policiesService = jasmine.createSpyObj<PoliciesService>('PoliciesService', ['forCompany']);
    TestBed.configureTestingModule({});
  });

  it('carrega a empresa e as apólices ao arrancar, para a empresa do utilizador', () => {
    auth.user.and.returnValue(utilizador());
    companiesService.get.and.returnValue(of(empresa()));
    policiesService.forCompany.and.returnValue(of({ supplierToKixima: [], kiximaToClient: [apoliceCliente()] }));
    const component = TestBed.runInInjectionContext(() => new CompanyProfileComponent(auth, companiesService, policiesService));

    expect(companiesService.get).toHaveBeenCalledWith('c1');
    expect(policiesService.forCompany).toHaveBeenCalledWith('c1');
    expect(component.company()?.name).toBe('Petro Angola');
  });

  it('clientPolicy() é a primeira apólice KIXIMA→Cliente, ou null quando não há nenhuma', () => {
    auth.user.and.returnValue(utilizador());
    companiesService.get.and.returnValue(of(empresa()));
    policiesService.forCompany.and.returnValue(of({ supplierToKixima: [], kiximaToClient: [] } as CompanyPoliciesDto));
    const semApolice = TestBed.runInInjectionContext(() => new CompanyProfileComponent(auth, companiesService, policiesService));
    expect(semApolice.clientPolicy()).toBeNull();

    policiesService.forCompany.and.returnValue(of({ supplierToKixima: [], kiximaToClient: [apoliceCliente()] }));
    const comApolice = TestBed.runInInjectionContext(() => new CompanyProfileComponent(auth, companiesService, policiesService));
    expect(comApolice.clientPolicy()?.policyNumber).toBe('POL-1');
  });

  it('regista o erro quando o carregamento falha', () => {
    auth.user.and.returnValue(utilizador());
    companiesService.get.and.returnValue(throwError(() => new ApiError('Sem permissão', 403)));
    policiesService.forCompany.and.returnValue(of({ supplierToKixima: [], kiximaToClient: [] }));
    const component = TestBed.runInInjectionContext(() => new CompanyProfileComponent(auth, companiesService, policiesService));

    expect(component.error()).toBe('Sem permissão');
  });
});
