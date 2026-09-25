import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SupplierFinanceCenterComponent } from './supplier-finance-center.component';
import { AuthService } from '../../core/services/auth.service';
import { OrdersService } from '../orders/orders.service';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { PlatformFeesService } from '../admin/platform-fees.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { KiximaUser } from '../../core/models/user.model';

function utilizador(): KiximaUser {
  return { id: 'u1', name: 'Ana', email: 'a@a.co', role: 'FINANCEIRO', adminAreas: [], companyId: 'c1', companyType: 'FORNECEDOR', avatarUrl: null };
}

function po(overrides: Partial<PurchaseOrderDto> = {}): PurchaseOrderDto {
  return {
    id: 'po1', reference: 'PO-1', buyerCompanyId: 'b1', supplierCompanyId: 'c1', status: 'PAGA',
    totalAmount: '1000', currency: 'AOA', createdAt: '2026-01-01', ...overrides,
  } as PurchaseOrderDto;
}

describe('SupplierFinanceCenterComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let ordersService: jasmine.SpyObj<OrdersService>;
  let financeiroService: jasmine.SpyObj<FinanceiroService>;
  let platformFeesService: jasmine.SpyObj<PlatformFeesService>;
  let router: jasmine.SpyObj<{ navigateByUrl: (c: string) => void }>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['list']);
    financeiroService = jasmine.createSpyObj<FinanceiroService>('FinanceiroService', ['pendingInvoicesToPay']);
    platformFeesService = jasmine.createSpyObj<PlatformFeesService>('PlatformFeesService', ['forCompany']);
    router = jasmine.createSpyObj('Router', ['navigateByUrl']);
    auth.user.and.returnValue(utilizador());
    financeiroService.pendingInvoicesToPay.and.returnValue(of([]));
    platformFeesService.forCompany.and.returnValue(of({
      company: { id: 'c1', name: 'Kianda', taxId: 'AO-1' },
      fees: [], kpis: { total: 0, totalAOA: 0, pendingAOA: 0, chargedAOA: 0, pendentes: 0, cobradas: 0, currency: 'USD' },
      formula: { perPo: '0', perInvoice: '0', thresholdUsd: '0', percentAbove: '0', currency: 'USD' },
      generatedAt: '2026-01-01',
    }));
    TestBed.configureTestingModule({});
  });

  function montar(): SupplierFinanceCenterComponent {
    return TestBed.runInInjectionContext(
      () => new SupplierFinanceCenterComponent(auth, ordersService, financeiroService, platformFeesService, router as never),
    );
  }

  it('sales() só inclui as POs em que a própria empresa é a fornecedora', () => {
    ordersService.list.and.returnValue(of([
      po({ id: '1', supplierCompanyId: 'c1' }),
      po({ id: '2', supplierCompanyId: 'outra' }),
    ]));
    const c = montar();

    expect(c.sales().map((o) => o.id)).toEqual(['1']);
  });

  it('confirmados()/porConfirmar() separam pagamentos por receivedAt', () => {
    ordersService.list.and.returnValue(of([
      po({ id: '1', supplierCompanyId: 'c1', invoice: { id: 'inv1', payment: { id: 'p1', invoiceId: 'inv1', amount: '100', currency: 'AOA', status: 'PROCESSADO', canal: 'TRANSFERENCIA', reference: 'PAG-1', processedAt: '2026-01-01', receivedAt: '2026-01-02' } } as never }),
      po({ id: '2', supplierCompanyId: 'c1', invoice: { id: 'inv2', payment: { id: 'p2', invoiceId: 'inv2', amount: '200', currency: 'AOA', status: 'PROCESSADO', canal: 'TRANSFERENCIA', reference: 'PAG-2', processedAt: '2026-01-01' } } as never }),
    ]));
    const c = montar();

    expect(c.confirmados().map((p) => p.id)).toEqual(['p1']);
    expect(c.porConfirmar().map((p) => p.id)).toEqual(['p2']);
  });

  it('aPagar() soma o valor das faturas pendentes', () => {
    ordersService.list.and.returnValue(of([]));
    financeiroService.pendingInvoicesToPay.and.returnValue(of([
      { id: 'i1', reference: 'F1', amount: '300', currency: 'AOA', dueAt: '2026-02-01' },
      { id: 'i2', reference: 'F2', amount: '200', currency: 'AOA', dueAt: '2026-02-05' },
    ]));
    const c = montar();

    expect(c.aPagar()).toBe(500);
  });

  it('ir() navega para o caminho dado', () => {
    ordersService.list.and.returnValue(of([]));
    const c = montar();

    c.ir('/financeiro/faturas');

    expect(router.navigateByUrl).toHaveBeenCalledWith('/financeiro/faturas');
  });
});
