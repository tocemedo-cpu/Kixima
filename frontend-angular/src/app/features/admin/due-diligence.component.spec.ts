import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DueDiligenceComponent } from './due-diligence.component';
import { CompaniesService } from './companies.service';
import { CompanyListItem } from '../../core/models/company.model';
import { ApiError } from '../../core/models/api-error.model';

function empresa(id: string): CompanyListItem {
  return { id, name: `Empresa ${id}`, taxId: 'AO-1', type: 'CLIENTE', status: 'PENDENTE', contactEmail: 'a@a.co', createdAt: '2026-01-01' };
}

describe('DueDiligenceComponent', () => {
  let companiesService: jasmine.SpyObj<CompaniesService>;

  beforeEach(() => {
    companiesService = jasmine.createSpyObj<CompaniesService>('CompaniesService', ['list']);
    TestBed.configureTestingModule({});
  });

  it('carrega só as empresas PENDENTE ao arrancar', () => {
    companiesService.list.and.returnValue(of([empresa('1'), empresa('2')]));
    const component = TestBed.runInInjectionContext(() => new DueDiligenceComponent(companiesService));

    expect(companiesService.list).toHaveBeenCalledWith('PENDENTE');
    expect(component.companies()?.length).toBe(2);
  });

  it('toggle() expande/colapsa uma empresa de cada vez', () => {
    companiesService.list.and.returnValue(of([empresa('1'), empresa('2')]));
    const component = TestBed.runInInjectionContext(() => new DueDiligenceComponent(companiesService));

    component.toggle('1');
    expect(component.expandedId()).toBe('1');

    component.toggle('2');
    expect(component.expandedId()).toBe('2');

    component.toggle('2');
    expect(component.expandedId()).toBeNull();
  });

  it('reload() volta a chamar o serviço (usado depois de uma decisão)', () => {
    companiesService.list.and.returnValue(of([empresa('1')]));
    const component = TestBed.runInInjectionContext(() => new DueDiligenceComponent(companiesService));

    companiesService.list.and.returnValue(of([]));
    component.reload();

    expect(companiesService.list).toHaveBeenCalledTimes(2);
    expect(component.companies()?.length).toBe(0);
  });

  it('regista o erro quando o carregamento falha', () => {
    companiesService.list.and.returnValue(throwError(() => new ApiError('Sem permissão', 403)));
    const component = TestBed.runInInjectionContext(() => new DueDiligenceComponent(companiesService));

    expect(component.error()).toBe('Sem permissão');
  });
});
