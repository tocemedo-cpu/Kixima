import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ReceptionsComponent } from './receptions.component';
import { OrdersService } from './orders.service';
import { ReceptionRow, ReceptionsResponse } from '../../core/models/buyer-tracking.model';
import { ApiError } from '../../core/models/api-error.model';

function item(overrides: Partial<ReceptionRow> = {}): ReceptionRow {
  return {
    id: 'po1:it1', poId: 'po1', reference: 'PO-1', supplier: { id: 's1', name: 'Kianda' },
    item: 'Válvula', sku: 'SKU-1', quantity: 2, status: 'A_RECEBER', ...overrides,
  };
}

function resposta(items: ReceptionRow[]): ReceptionsResponse {
  return { kpis: { aReceber: 0, recebidos: 0, divergencia: 0, total: 0 }, items };
}

describe('ReceptionsComponent', () => {
  let ordersService: jasmine.SpyObj<OrdersService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['buyerReceptions']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  it('carrega com o separador "TODOS" por omissão', () => {
    ordersService.buyerReceptions.and.returnValue(of(resposta([item()])));
    const component = TestBed.runInInjectionContext(() => new ReceptionsComponent(ordersService, router));

    expect(ordersService.buyerReceptions).toHaveBeenCalledWith('TODOS', undefined);
    expect(component.data()?.items.length).toBe(1);
  });

  it('setTab() e onQ() recarregam com os novos parâmetros', () => {
    ordersService.buyerReceptions.and.returnValue(of(resposta([])));
    const component = TestBed.runInInjectionContext(() => new ReceptionsComponent(ordersService, router));

    component.setTab('DIVERGENCIA');
    expect(ordersService.buyerReceptions).toHaveBeenCalledWith('DIVERGENCIA', undefined);

    component.onQ('válvula');
    expect(ordersService.buyerReceptions).toHaveBeenCalledWith('DIVERGENCIA', 'válvula');
  });

  it('verOrdem() navega para /comprador/ordens/:poId', () => {
    ordersService.buyerReceptions.and.returnValue(of(resposta([])));
    const component = TestBed.runInInjectionContext(() => new ReceptionsComponent(ordersService, router));

    component.verOrdem('po1');

    expect(router.navigateByUrl).toHaveBeenCalledWith('/comprador/ordens/po1');
  });

  it('regista o erro quando o carregamento falha', () => {
    ordersService.buyerReceptions.and.returnValue(throwError(() => new ApiError('Sem permissão', 403)));
    const component = TestBed.runInInjectionContext(() => new ReceptionsComponent(ordersService, router));

    expect(component.error()).toBe('Sem permissão');
  });
});
