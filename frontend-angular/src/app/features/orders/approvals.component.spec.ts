import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ApprovalsComponent } from './approvals.component';
import { OrdersService } from './orders.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';

function po(id: string): PurchaseOrderDto {
  return {
    id, reference: `PO-${id}`, buyerCompanyId: 'b1', supplierCompanyId: 's1', createdById: 'u1',
    status: 'AGUARDANDO_APROVACAO', totalAmount: '1000', currency: 'AOA', isCallOff: false, erpManaged: false,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', items: [],
    buyerCompany: { id: 'b1', name: 'Compradora' }, supplierCompany: { id: 's1', name: 'Fornecedora' },
  };
}

describe('ApprovalsComponent', () => {
  let ordersService: jasmine.SpyObj<OrdersService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['list']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  it('carrega apenas as POs em AGUARDANDO_APROVACAO', () => {
    ordersService.list.and.returnValue(of([po('1'), po('2')]));
    const component = TestBed.runInInjectionContext(() => new ApprovalsComponent(ordersService, router));

    expect(ordersService.list).toHaveBeenCalledWith('AGUARDANDO_APROVACAO');
    expect(component.orders()?.length).toBe(2);
    expect(component.error()).toBe('');
  });

  it('regista o erro quando o carregamento falha', () => {
    ordersService.list.and.returnValue(throwError(() => new ApiError('Sem permissão', 403)));
    const component = TestBed.runInInjectionContext(() => new ApprovalsComponent(ordersService, router));

    expect(component.error()).toBe('Sem permissão');
    expect(component.orders()).toBeNull();
  });

  it('rever() navega para /empresa/aprovacoes/:id', () => {
    ordersService.list.and.returnValue(of([]));
    const component = TestBed.runInInjectionContext(() => new ApprovalsComponent(ordersService, router));

    component.rever('po1');

    expect(router.navigateByUrl).toHaveBeenCalledWith('/empresa/aprovacoes/po1');
  });
});
