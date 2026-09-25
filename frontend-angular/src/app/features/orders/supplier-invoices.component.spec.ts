import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { SupplierInvoicesComponent } from './supplier-invoices.component';
import { OrdersService, PurchaseOrdersPage } from './orders.service';
import { ApiError } from '../../core/models/api-error.model';

function pagina(page: number): PurchaseOrdersPage {
  return { items: [], total: 0, page, pages: 3, limit: 15 };
}

describe('SupplierInvoicesComponent', () => {
  let ordersService: jasmine.SpyObj<OrdersService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['listPage']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  it('carrega a página 1 com invoiced=true e limit=15', () => {
    ordersService.listPage.and.returnValue(of(pagina(1)));
    const component = TestBed.runInInjectionContext(() => new SupplierInvoicesComponent(ordersService, router));

    expect(ordersService.listPage).toHaveBeenCalledWith({ invoiced: 'true', page: 1, limit: 15 });
    expect(component.data()?.page).toBe(1);
  });

  it('irPara() muda a página e recarrega', () => {
    ordersService.listPage.and.returnValue(of(pagina(1)));
    const component = TestBed.runInInjectionContext(() => new SupplierInvoicesComponent(ordersService, router));

    ordersService.listPage.and.returnValue(of(pagina(2)));
    component.irPara(2);

    expect(ordersService.listPage).toHaveBeenCalledWith({ invoiced: 'true', page: 2, limit: 15 });
    expect(component.page()).toBe(2);
    expect(component.data()?.page).toBe(2);
  });

  it('regista o erro quando o carregamento falha', () => {
    ordersService.listPage.and.returnValue(throwError(() => new ApiError('Falha ao carregar', 500)));
    const component = TestBed.runInInjectionContext(() => new SupplierInvoicesComponent(ordersService, router));

    expect(component.error()).toBe('Falha ao carregar');
  });

  it('verDetalhe() navega para /fornecedor/ordens/:id', () => {
    ordersService.listPage.and.returnValue(of(pagina(1)));
    const component = TestBed.runInInjectionContext(() => new SupplierInvoicesComponent(ordersService, router));

    component.verDetalhe('po1');

    expect(router.navigateByUrl).toHaveBeenCalledWith('/fornecedor/ordens/po1');
  });
});
