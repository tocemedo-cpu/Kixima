import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router, provideRouter } from '@angular/router';
import { CheckoutComponent } from './checkout.component';
import { CartService } from '../cart/cart.service';
import { OrdersService } from './orders.service';
import { ProductDto } from '../../core/models/product.model';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';

function produto(id: string, supplierId: string, unitPrice = '1000'): ProductDto {
  return {
    id, supplierId, name: `Produto ${id}`, category: 'Válvulas', unitPrice, currency: 'AOA',
    kind: 'PRODUTO', certifications: [], tags: [], active: true, reviewCount: 0, viewCount: 0,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', supplier: { id: supplierId, name: `Fornecedor ${supplierId}` },
  };
}

function po(reference: string): PurchaseOrderDto {
  return {
    id: reference, reference, buyerCompanyId: 'b1', supplierCompanyId: 's1', createdById: 'u1',
    status: 'AGUARDANDO_APROVACAO', totalAmount: '0', currency: 'AOA', isCallOff: false, erpManaged: false,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', items: [],
    buyerCompany: { id: 'b1', name: 'Compradora' }, supplierCompany: { id: 's1', name: 'Fornecedor' },
  };
}

describe('CheckoutComponent — agrupamento por fornecedor', () => {
  let component: CheckoutComponent;
  let cart: CartService;
  let ordersService: jasmine.SpyObj<OrdersService>;

  beforeEach(() => {
    ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['create']);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: OrdersService, useValue: ordersService }],
    });
    cart = TestBed.inject(CartService);
    cart.clear();
    component = TestBed.runInInjectionContext(() => new CheckoutComponent(cart, ordersService, TestBed.inject(Router)));
  });

  it('agrupa os itens da cesta por fornecedor — a mesma regra de Checkout.jsx (groups)', () => {
    cart.addItem(produto('p1', 's1'), 1);
    cart.addItem(produto('p2', 's1'), 2);
    cart.addItem(produto('p3', 's2'), 1);

    const grupos = component.groups();
    expect(grupos.length).toBe(2);
    const porFornecedor = new Map(grupos.map((g) => [g.supplier.id, g.items.length]));
    expect(porFornecedor.get('s1')).toBe(2);
    expect(porFornecedor.get('s2')).toBe(1);
  });

  it('confirm() cria UMA PO por fornecedor — nunca uma PO multi-fornecedor', async () => {
    cart.addItem(produto('p1', 's1', '1000'), 2);
    cart.addItem(produto('p2', 's2', '2000'), 1);
    ordersService.create.and.callFake((body) => of(po(`PO-${body.supplierCompanyId}`)));

    await component.confirm();

    expect(ordersService.create).toHaveBeenCalledTimes(2);
    expect(ordersService.create).toHaveBeenCalledWith({ supplierCompanyId: 's1', items: [{ productId: 'p1', quantity: 2 }] });
    expect(ordersService.create).toHaveBeenCalledWith({ supplierCompanyId: 's2', items: [{ productId: 'p2', quantity: 1 }] });
    expect(component.done()).toEqual(['PO-s1', 'PO-s2']);
    expect(cart.items()).toEqual([]); // a cesta esvazia depois do checkout
  });
});
