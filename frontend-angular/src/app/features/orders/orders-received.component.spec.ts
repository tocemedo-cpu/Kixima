import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { OrdersReceivedComponent } from './orders-received.component';
import { OrdersService } from './orders.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';

function po(id: string, status: PurchaseOrderDto['status'] = 'AGUARDANDO_APROVACAO'): PurchaseOrderDto {
  return {
    id, reference: `PO-${id}`, buyerCompanyId: 'b1', supplierCompanyId: 's1', createdById: 'u1',
    status, totalAmount: '1000', currency: 'AOA', isCallOff: false, erpManaged: false,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', items: [],
    buyerCompany: { id: 'b1', name: 'Compradora' }, supplierCompany: { id: 's1', name: 'Fornecedora' },
  };
}

describe('OrdersReceivedComponent', () => {
  let ordersService: jasmine.SpyObj<OrdersService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['list']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  it('carrega todas as ordens ao arrancar, sem filtro de status', () => {
    ordersService.list.and.returnValue(of([po('1'), po('2')]));
    const component = TestBed.runInInjectionContext(() => new OrdersReceivedComponent(ordersService, router));

    expect(ordersService.list).toHaveBeenCalledWith(undefined);
    expect(component.orders()?.length).toBe(2);
  });

  it('setStatusFilter() recarrega com o novo estado', () => {
    ordersService.list.and.returnValue(of([po('1')]));
    const component = TestBed.runInInjectionContext(() => new OrdersReceivedComponent(ordersService, router));

    ordersService.list.and.returnValue(of([po('2', 'APROVADA')]));
    component.setStatusFilter('APROVADA');

    expect(ordersService.list).toHaveBeenCalledWith('APROVADA');
    expect(component.statusFilter()).toBe('APROVADA');
    expect(component.orders()?.[0].status).toBe('APROVADA');
  });

  it('regista o erro quando o carregamento falha', () => {
    ordersService.list.and.returnValue(throwError(() => new ApiError('Falha ao carregar', 500)));
    const component = TestBed.runInInjectionContext(() => new OrdersReceivedComponent(ordersService, router));

    expect(component.error()).toBe('Falha ao carregar');
  });

  it('verDetalhe() navega para /fornecedor/ordens/:id', () => {
    ordersService.list.and.returnValue(of([]));
    const component = TestBed.runInInjectionContext(() => new OrdersReceivedComponent(ordersService, router));

    component.verDetalhe('po1');

    expect(router.navigateByUrl).toHaveBeenCalledWith('/fornecedor/ordens/po1');
  });
});
