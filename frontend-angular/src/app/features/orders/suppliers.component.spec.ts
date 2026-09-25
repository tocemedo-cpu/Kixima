import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SuppliersComponent } from './suppliers.component';
import { BuyerSuppliersService } from './buyer-suppliers.service';
import { BuyerSuppliersResponse } from '../../core/models/marketplace-extra.model';
import { ApiError } from '../../core/models/api-error.model';

function resposta(): BuyerSuppliersResponse {
  return {
    kpis: { total: 10, ativos: 6, homologados: 3, emAvaliacao: 2, novos: 1 },
    items: [
      { id: 's1', name: 'Alfa', verified: true, status: 'APROVADA', rating: 4.8 },
      { id: 's2', name: 'Beta', verified: false, status: 'PENDENTE', rating: 4.9 },
      { id: 's3', name: 'Gama', verified: true, status: 'APROVADA', rating: null },
    ],
  };
}

function montar() {
  const buyerSuppliersService = jasmine.createSpyObj<BuyerSuppliersService>('BuyerSuppliersService', ['list']);
  buyerSuppliersService.list.and.returnValue(of(resposta()));
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new SuppliersComponent(buyerSuppliersService));
  return { componente, buyerSuppliersService };
}

describe('SuppliersComponent', () => {
  it('carrega o directório de fornecedores sem filtros na primeira vez', () => {
    const { buyerSuppliersService } = montar();
    expect(buyerSuppliersService.list).toHaveBeenCalledWith(undefined, undefined);
  });

  it('top() traz só quem tem rating, ordenado por rating decrescente, no máximo 5', () => {
    const { componente } = montar();
    expect(componente.top().map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('onTab() recarrega com o filtro de estado seleccionado', () => {
    const { componente, buyerSuppliersService } = montar();
    componente.onTab('ATIVOS');
    expect(buyerSuppliersService.list).toHaveBeenCalledWith('ATIVOS', undefined);
  });

  it('onQ() recarrega com o termo de pesquisa', () => {
    const { componente, buyerSuppliersService } = montar();
    componente.onQ('petro');
    expect(buyerSuppliersService.list).toHaveBeenCalledWith(undefined, 'petro');
  });

  it('statusLabel() traduz APROVADA para Ativo, o resto para Em Avaliação', () => {
    const { componente } = montar();
    expect(componente.statusLabel('APROVADA')).toBe('Ativo');
    expect(componente.statusLabel('PENDENTE')).toBe('Em Avaliação');
  });

  it('regista o erro quando o carregamento falha', () => {
    const buyerSuppliersService = jasmine.createSpyObj<BuyerSuppliersService>('BuyerSuppliersService', ['list']);
    buyerSuppliersService.list.and.returnValue(throwError(() => new ApiError('Falha ao carregar', 500)));
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(() => new SuppliersComponent(buyerSuppliersService));
    expect(componente.error()).toBe('Falha ao carregar');
  });
});
