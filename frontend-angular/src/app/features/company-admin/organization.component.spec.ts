import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OrganizationComponent } from './organization.component';
import { AuthService } from '../../core/services/auth.service';
import { OrganizationService } from './organization.service';
import { OrganizacaoResponse } from '../../core/models/organizacao.model';
import { KiximaUser } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(): KiximaUser {
  return { id: 'u1', name: 'Bruno', email: 'b@a.co', role: 'COMPANY_ADMIN', adminAreas: [], companyId: 'c1', companyType: 'CLIENTE', avatarUrl: null };
}

function resposta(overrides: Partial<OrganizacaoResponse['company']> = {}): OrganizacaoResponse {
  return {
    company: {
      id: 'c1', name: 'Petro Angola', taxId: 'AO-1', type: 'CLIENTE', status: 'APROVADA', contactEmail: 'a@a.co',
      verified: true, city: 'Luanda', province: 'Luanda', country: 'Angola', createdAt: '2026-01-01', ...overrides,
    },
    summary: { users: 5, contracts: 2, documents: 3, certifications: 1 },
  };
}

describe('OrganizationComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let organizationService: jasmine.SpyObj<OrganizationService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    organizationService = jasmine.createSpyObj<OrganizationService>('OrganizationService', ['organizacao']);
    TestBed.configureTestingModule({});
  });

  it('carrega a organização ao arrancar', () => {
    auth.user.and.returnValue(utilizador());
    organizationService.organizacao.and.returnValue(of(resposta()));
    const component = TestBed.runInInjectionContext(() => new OrganizationComponent(auth, organizationService));

    expect(component.data()?.summary.users).toBe(5);
  });

  it('typeLabel() distingue CLIENTE de FORNECEDOR', () => {
    auth.user.and.returnValue(utilizador());
    organizationService.organizacao.and.returnValue(of(resposta({ type: 'CLIENTE' })));
    const cliente = TestBed.runInInjectionContext(() => new OrganizationComponent(auth, organizationService));
    expect(cliente.typeLabel()).toBe('Empresa Cliente');

    organizationService.organizacao.and.returnValue(of(resposta({ type: 'FORNECEDOR' })));
    const fornecedor = TestBed.runInInjectionContext(() => new OrganizationComponent(auth, organizationService));
    expect(fornecedor.typeLabel()).toBe('Prestadora de Serviços');
  });

  it('location() junta cidade, província e país', () => {
    auth.user.and.returnValue(utilizador());
    organizationService.organizacao.and.returnValue(of(resposta({ city: 'Luanda', province: 'Luanda', country: 'Angola' })));
    const component = TestBed.runInInjectionContext(() => new OrganizationComponent(auth, organizationService));

    expect(component.location()).toBe('Luanda, Luanda, Angola');
  });

  it('regista o erro quando o carregamento falha', () => {
    auth.user.and.returnValue(utilizador());
    organizationService.organizacao.and.returnValue(throwError(() => new ApiError('Sem permissão', 403)));
    const component = TestBed.runInInjectionContext(() => new OrganizationComponent(auth, organizationService));

    expect(component.error()).toBe('Sem permissão');
  });
});
