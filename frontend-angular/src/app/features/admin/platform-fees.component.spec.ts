import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PlatformFeesComponent } from './platform-fees.component';
import { PlatformFeesService } from './platform-fees.service';
import { PlatformFeeBookDto, PlatformFeeDto } from '../../core/models/platform-fee.model';
import { ApiError } from '../../core/models/api-error.model';

function taxa(overrides: Partial<PlatformFeeDto> = {}): PlatformFeeDto {
  return {
    id: 'f1', companyId: 'c1', invoiceId: 'inv1', poCount: 1, perPo: '8', perInvoice: '15', amount: '23', currency: 'USD',
    basis: 'FIXO', status: 'PENDENTE', createdAt: '2026-01-01',
    company: { name: 'Kianda', type: 'FORNECEDOR' }, invoice: { reference: 'FAT-1', amount: '1000', currency: 'AOA' },
    ...overrides,
  };
}

function livro(fees: PlatformFeeDto[]): PlatformFeeBookDto {
  return { fees, kpis: { total: fees.length, totalAOA: 0, pendingAOA: 0, cobradas: 0 } };
}

describe('PlatformFeesComponent', () => {
  let platformFeesService: jasmine.SpyObj<PlatformFeesService>;

  beforeEach(() => {
    platformFeesService = jasmine.createSpyObj<PlatformFeesService>('PlatformFeesService', ['list', 'charge']);
    TestBed.configureTestingModule({});
  });

  it('carrega o livro de taxas ao arrancar', () => {
    platformFeesService.list.and.returnValue(of(livro([taxa()])));
    const component = TestBed.runInInjectionContext(() => new PlatformFeesComponent(platformFeesService));

    expect(component.fees().length).toBe(1);
  });

  it('fees() filtra por separador (status) e por pesquisa', () => {
    platformFeesService.list.and.returnValue(of(livro([
      taxa({ id: '1', status: 'PENDENTE', company: { name: 'Kianda' } }),
      taxa({ id: '2', status: 'COBRADO', company: { name: 'Outra' } }),
    ])));
    const component = TestBed.runInInjectionContext(() => new PlatformFeesComponent(platformFeesService));

    component.tab.set('PENDENTE');
    expect(component.fees().map((f) => f.id)).toEqual(['1']);

    component.tab.set('');
    component.q.set('outra');
    expect(component.fees().map((f) => f.id)).toEqual(['2']);
  });

  it('charge() chama o serviço, mostra sucesso e recarrega', fakeAsync(() => {
    platformFeesService.list.and.returnValue(of(livro([taxa()])));
    platformFeesService.charge.and.returnValue(of({} as PlatformFeeDto));
    const component = TestBed.runInInjectionContext(() => new PlatformFeesComponent(platformFeesService));

    component.charge('f1');
    flushMicrotasks();

    expect(platformFeesService.charge).toHaveBeenCalledWith('f1');
    expect(component.sucesso()).toBe('Taxa marcada como cobrada.');
    expect(component.busy()).toBe('');
    expect(platformFeesService.list).toHaveBeenCalledTimes(2);
  }));

  it('charge() regista o erro quando o servidor recusa', fakeAsync(() => {
    platformFeesService.list.and.returnValue(of(livro([taxa()])));
    platformFeesService.charge.and.returnValue(throwError(() => new ApiError('Já cobrada', 409)));
    const component = TestBed.runInInjectionContext(() => new PlatformFeesComponent(platformFeesService));

    component.charge('f1');
    flushMicrotasks();

    expect(component.error()).toBe('Já cobrada');
    expect(component.busy()).toBe('');
  }));

  it('regista o erro quando o carregamento inicial falha', () => {
    platformFeesService.list.and.returnValue(throwError(() => new ApiError('Sem permissão', 403)));
    const component = TestBed.runInInjectionContext(() => new PlatformFeesComponent(platformFeesService));

    expect(component.error()).toBe('Sem permissão');
  });
});
