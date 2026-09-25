import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { SupplierPaymentsComponent } from './supplier-payments.component';
import { OrdersService } from './orders.service';
import { AuthService } from '../../core/services/auth.service';
import { PurchaseOrderDto, PaymentDto } from '../../core/models/purchase-order.model';
import { KiximaUser, PersonaRole } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(role: PersonaRole, companyId = 'c1'): KiximaUser {
  return { id: 'u1', name: 'Ana', email: 'a@a.co.ao', role, adminAreas: [], companyId, companyType: 'FORNECEDOR', avatarUrl: null };
}

function pagamento(overrides: Partial<PaymentDto> = {}): PaymentDto {
  return {
    id: 'pay1', invoiceId: 'inv1', amount: '1000', currency: 'AOA', status: 'PAGA',
    canal: 'TRANSFERENCIA', reference: 'RC-1', processedAt: '2026-01-01', ...overrides,
  };
}

function poComPagamento(supplierCompanyId: string, payment: PaymentDto | null): PurchaseOrderDto {
  return {
    id: 'po1', reference: 'PO-1', buyerCompanyId: 'b1', supplierCompanyId, createdById: 'u1',
    status: 'PAGA', totalAmount: '1000', currency: 'AOA', isCallOff: false, erpManaged: false,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', items: [],
    buyerCompany: { id: 'b1', name: 'Compradora' }, supplierCompany: { id: supplierCompanyId, name: 'Fornecedora' },
    invoice: payment
      ? { id: 'inv1', reference: 'FT-1', amount: '1000', currency: 'AOA', status: 'PAGA', issuedAt: '2026-01-01', dueAt: '2026-01-08', payment, creditNotes: [], lines: [] }
      : null,
  };
}

describe('SupplierPaymentsComponent', () => {
  let ordersService: jasmine.SpyObj<OrdersService>;
  let auth: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['list', 'confirmPaymentReceived']);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  it('paid() só inclui POs em que a empresa é a fornecedora e há pagamento — mesma regra de Payments.jsx', () => {
    auth.user.and.returnValue(utilizador('FORNECEDOR', 'c1'));
    ordersService.list.and.returnValue(of([
      poComPagamento('c1', pagamento()), // venda própria, paga — entra
      poComPagamento('c2', pagamento()), // outra empresa — não entra
      poComPagamento('c1', null), // sem pagamento ainda — não entra
    ]));
    const component = TestBed.runInInjectionContext(() => new SupplierPaymentsComponent(auth, ordersService, router));

    expect(component.paid().length).toBe(1);
  });

  it('orderPath() aponta para /fornecedor/ordens para o papel FORNECEDOR', () => {
    auth.user.and.returnValue(utilizador('FORNECEDOR'));
    ordersService.list.and.returnValue(of([]));
    const component = TestBed.runInInjectionContext(() => new SupplierPaymentsComponent(auth, ordersService, router));

    expect(component.orderPath()).toBe('/fornecedor/ordens');
  });

  it('orderPath() aponta para /financeiro/ordens para o papel FINANCEIRO', () => {
    auth.user.and.returnValue(utilizador('FINANCEIRO'));
    ordersService.list.and.returnValue(of([]));
    const component = TestBed.runInInjectionContext(() => new SupplierPaymentsComponent(auth, ordersService, router));

    expect(component.orderPath()).toBe('/financeiro/ordens');
  });

  it('confirmReceived() chama o serviço, mostra o toast e recarrega a lista', fakeAsync(() => {
    auth.user.and.returnValue(utilizador('FORNECEDOR', 'c1'));
    ordersService.list.and.returnValue(of([poComPagamento('c1', pagamento())]));
    ordersService.confirmPaymentReceived.and.returnValue(of({}));
    const component = TestBed.runInInjectionContext(() => new SupplierPaymentsComponent(auth, ordersService, router));

    component.confirmReceived({ id: 'pay1' });
    flushMicrotasks();

    expect(ordersService.confirmPaymentReceived).toHaveBeenCalledWith('pay1');
    expect(component.toast()).toBe('Receção do valor confirmada. Obrigado!');
    expect(component.confirming()).toBeNull();
    expect(ordersService.list).toHaveBeenCalledTimes(2); // carga inicial + recarga pós-confirmação
  }));

  it('confirmReceived() regista o erro quando o servidor recusa', fakeAsync(() => {
    auth.user.and.returnValue(utilizador('FORNECEDOR', 'c1'));
    ordersService.list.and.returnValue(of([poComPagamento('c1', pagamento())]));
    ordersService.confirmPaymentReceived.and.returnValue(throwError(() => new ApiError('Já confirmado', 409)));
    const component = TestBed.runInInjectionContext(() => new SupplierPaymentsComponent(auth, ordersService, router));

    component.confirmReceived({ id: 'pay1' });
    flushMicrotasks();

    expect(component.error()).toBe('Já confirmado');
    expect(component.confirming()).toBeNull();
  }));

  it('verDetalhe() navega usando orderPath()', () => {
    auth.user.and.returnValue(utilizador('FINANCEIRO'));
    ordersService.list.and.returnValue(of([]));
    const component = TestBed.runInInjectionContext(() => new SupplierPaymentsComponent(auth, ordersService, router));

    component.verDetalhe('po1');

    expect(router.navigateByUrl).toHaveBeenCalledWith('/financeiro/ordens/po1');
  });
});
