import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { DeliveriesComponent } from './deliveries.component';
import { OrdersService } from './orders.service';
import { DeliveriesResponse, DeliveryRow } from '../../core/models/buyer-tracking.model';
import { ApiError } from '../../core/models/api-error.model';

function entrega(overrides: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    id: 'po1', reference: 'PO-1', supplier: { id: 's1', name: 'Kianda' }, itemsCount: 2,
    emittedAt: '2026-01-01', stage: 'EM_TRANSITO', label: 'Em Trânsito', progress: 75, location: 'Luanda, Angola',
    ...overrides,
  };
}

function resposta(items: DeliveryRow[]): DeliveriesResponse {
  return { kpis: { emTransito: 0, emPreparacao: 0, entregues: 0, canceladas: 0 }, items };
}

describe('DeliveriesComponent', () => {
  let ordersService: jasmine.SpyObj<OrdersService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['buyerDeliveries']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  it('carrega com o separador "TODAS" por omissão', () => {
    ordersService.buyerDeliveries.and.returnValue(of(resposta([entrega()])));
    const component = TestBed.runInInjectionContext(() => new DeliveriesComponent(ordersService, router));

    expect(ordersService.buyerDeliveries).toHaveBeenCalledWith('TODAS', undefined);
    expect(component.data()?.items.length).toBe(1);
  });

  it('setTab() e onQ() recarregam com os novos parâmetros', () => {
    ordersService.buyerDeliveries.and.returnValue(of(resposta([])));
    const component = TestBed.runInInjectionContext(() => new DeliveriesComponent(ordersService, router));

    component.setTab('ENTREGUE');
    expect(ordersService.buyerDeliveries).toHaveBeenCalledWith('ENTREGUE', undefined);

    component.onQ('kianda');
    expect(ordersService.buyerDeliveries).toHaveBeenCalledWith('ENTREGUE', 'kianda');
  });

  it('verOrdem() navega para /comprador/ordens/:id', () => {
    ordersService.buyerDeliveries.and.returnValue(of(resposta([])));
    const component = TestBed.runInInjectionContext(() => new DeliveriesComponent(ordersService, router));

    component.verOrdem('po1');

    expect(router.navigateByUrl).toHaveBeenCalledWith('/comprador/ordens/po1');
  });

  it('regista o erro quando o carregamento falha', () => {
    ordersService.buyerDeliveries.and.returnValue(throwError(() => new ApiError('Sem permissão', 403)));
    const component = TestBed.runInInjectionContext(() => new DeliveriesComponent(ordersService, router));

    expect(component.error()).toBe('Sem permissão');
  });
});
