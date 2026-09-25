import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminSistemaHomeComponent } from './admin-sistema-home.component';
import { CompaniesService } from '../admin/companies.service';
import { CompanyListItem } from '../../core/models/company.model';
import { ApiError } from '../../core/models/api-error.model';

function empresa(overrides: Partial<CompanyListItem> = {}): CompanyListItem {
  return {
    id: 'c1', name: 'Petro Angola', taxId: 'AO-1', type: 'CLIENTE', status: 'PENDENTE',
    contactEmail: 'a@a.co', verified: false, createdAt: '2026-01-01', ...overrides,
  };
}

describe('AdminSistemaHomeComponent', () => {
  let companiesService: jasmine.SpyObj<CompaniesService>;

  beforeEach(() => {
    companiesService = jasmine.createSpyObj<CompaniesService>('CompaniesService', ['list']);
    TestBed.configureTestingModule({});
  });

  function montar(): AdminSistemaHomeComponent {
    return TestBed.runInInjectionContext(() => new AdminSistemaHomeComponent(companiesService));
  }

  it('carrega as empresas e separa pendentes/aprovadas', () => {
    companiesService.list.and.returnValue(of([
      empresa({ id: '1', status: 'PENDENTE' }),
      empresa({ id: '2', status: 'APROVADA' }),
      empresa({ id: '3', status: 'PENDENTE' }),
    ]));
    const c = montar();

    expect(c.pendentes().map((e) => e.id)).toEqual(['1', '3']);
    expect(c.aprovadas().map((e) => e.id)).toEqual(['2']);
  });

  it('trata 403 como "sem acesso à área", não como erro', () => {
    companiesService.list.and.returnValue(throwError(() => new ApiError('Sem permissão', 403, 'FORBIDDEN')));
    const c = montar();

    expect(c.semAcesso()).toBeTrue();
    expect(c.error()).toBe('');
  });

  it('outros erros (não 403) ficam em error()', () => {
    companiesService.list.and.returnValue(throwError(() => new ApiError('Falha do servidor', 500)));
    const c = montar();

    expect(c.semAcesso()).toBeFalse();
    expect(c.error()).toBe('Falha do servidor');
  });
});
