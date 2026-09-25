import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { of, throwError } from 'rxjs';
import { FeeStatementComponent } from './fee-statement.component';
import { PlatformFeesService } from '../admin/platform-fees.service';
import { PlatformFeeStatementDto } from '../../core/models/platform-fee.model';
import { ApiError } from '../../core/models/api-error.model';

function estatemento(overrides: Partial<PlatformFeeStatementDto> = {}): PlatformFeeStatementDto {
  return {
    company: { id: 'c1', name: 'Fornecedora Lda', taxId: 'AO-1', plan: 'CORE' },
    fees: [],
    kpis: { total: 0, totalAOA: 0, pendingAOA: 0, chargedAOA: 0, pendentes: 0, cobradas: 0, currency: 'USD' },
    formula: { perPo: 5, perInvoice: 10, thresholdUsd: 11500, percentAbove: 0.002, currency: 'USD' },
    generatedAt: '2026-01-01',
    ...overrides,
  };
}

function montar(companyId = 'c1') {
  const platformFeesService = jasmine.createSpyObj<PlatformFeesService>('PlatformFeesService', ['forCompany']);
  platformFeesService.forCompany.and.returnValue(of(estatemento()));
  const route = { snapshot: { paramMap: { get: () => companyId } } } as unknown as ActivatedRoute;
  const location = jasmine.createSpyObj<Location>('Location', ['back']);
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new FeeStatementComponent(route, platformFeesService, location));
  return { componente, platformFeesService, location };
}

describe('FeeStatementComponent', () => {
  it('carrega o extrato pelo companyId do endereço', () => {
    const { componente, platformFeesService } = montar('c1');
    expect(platformFeesService.forCompany).toHaveBeenCalledWith('c1');
    expect(componente.data()?.company.name).toBe('Fornecedora Lda');
  });

  it('percentAcima() converte a fracção para percentagem com vírgula decimal', () => {
    const { componente } = montar();
    expect(componente.percentAcima(0.002)).toBe('0,20%');
    expect(componente.percentAcima(0)).toBe('0,20%');
  });

  it('limiar() usa 11500 como valor por omissão quando ausente', () => {
    const { componente } = montar();
    expect(componente.limiar(0, 'USD')).toContain('11.500,00');
    expect(componente.limiar(20000, 'USD')).toContain('20.000,00');
  });

  it('voltar() delega no Location.back()', () => {
    const { componente, location } = montar();
    componente.voltar();
    expect(location.back).toHaveBeenCalled();
  });

  it('imprimir() chama window.print()', () => {
    const { componente } = montar();
    spyOn(window, 'print');
    componente.imprimir();
    expect(window.print).toHaveBeenCalled();
  });

  it('regista o erro quando o carregamento falha', () => {
    const platformFeesService = jasmine.createSpyObj<PlatformFeesService>('PlatformFeesService', ['forCompany']);
    platformFeesService.forCompany.and.returnValue(throwError(() => new ApiError('Falha ao carregar.', 500)));
    const route = { snapshot: { paramMap: { get: () => 'c1' } } } as unknown as ActivatedRoute;
    const location = jasmine.createSpyObj<Location>('Location', ['back']);
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(() => new FeeStatementComponent(route, platformFeesService, location));
    expect(componente.error()).toBe('Falha ao carregar.');
  });
});
