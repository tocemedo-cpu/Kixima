import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { WalletComponent } from './wallet.component';
import { AuthService } from '../../core/services/auth.service';
import { OrdersService } from './orders.service';
import { PlatformFeesService } from '../admin/platform-fees.service';
import { PurchaseOrderDto, PaymentDto } from '../../core/models/purchase-order.model';
import { KiximaUser } from '../../core/models/user.model';
import { PlatformFeeStatementDto } from '../../core/models/platform-fee.model';

function utilizador(): KiximaUser {
  return { id: 'u1', name: 'Duarte', email: 'd@a.co', role: 'FORNECEDOR', adminAreas: [], companyId: 'c1', companyType: 'FORNECEDOR', avatarUrl: null };
}

function pagamento(overrides: Partial<PaymentDto> = {}): PaymentDto {
  return { id: 'p1', invoiceId: 'i1', amount: '100', currency: 'AOA', status: 'PROCESSADO', canal: 'TRANSFERENCIA', reference: 'PAG-1', processedAt: '2026-01-01', ...overrides };
}

function po(overrides: Partial<PurchaseOrderDto> = {}): PurchaseOrderDto {
  return {
    id: 'po1', reference: 'PO-1', buyerCompanyId: 'b1', supplierCompanyId: 'c1', status: 'PAGA',
    totalAmount: '1000', currency: 'AOA', createdAt: '2026-01-01', ...overrides,
  } as PurchaseOrderDto;
}

function statement(overrides: Partial<PlatformFeeStatementDto['kpis']> = {}): PlatformFeeStatementDto {
  return {
    company: { id: 'c1', name: 'Kianda', taxId: 'AO-1' },
    fees: [], kpis: { total: 0, totalAOA: 0, pendingAOA: 0, chargedAOA: 0, pendentes: 0, cobradas: 0, currency: 'USD', ...overrides },
    formula: { perPo: '0', perInvoice: '0', thresholdUsd: '0', percentAbove: '0', currency: 'USD' },
    generatedAt: '2026-01-01',
  };
}

describe('WalletComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let ordersService: jasmine.SpyObj<OrdersService>;
  let platformFeesService: jasmine.SpyObj<PlatformFeesService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['list']);
    platformFeesService = jasmine.createSpyObj<PlatformFeesService>('PlatformFeesService', ['forCompany']);
    auth.user.and.returnValue(utilizador());
    platformFeesService.forCompany.and.returnValue(of(statement()));
    TestBed.configureTestingModule({});
  });

  function montar(): WalletComponent {
    return TestBed.runInInjectionContext(() => new WalletComponent(auth, ordersService, platformFeesService));
  }

  it('received()/pending() somam o totalAmount pelo grupo de estados', () => {
    ordersService.list.and.returnValue(of([
      po({ id: '1', status: 'PAGA', totalAmount: '100' }),
      po({ id: '2', status: 'EM_EXECUCAO', totalAmount: '200' }),
      po({ id: '3', status: 'ACEITE_FORNECEDOR', totalAmount: '50' }),
      po({ id: '4', status: 'REJEITADA', totalAmount: '999' }),
    ]));
    const c = montar();

    expect(c.received()).toBe(300);
    expect(c.pending()).toBe(50);
  });

  it('recentPaid() só inclui ordens com invoice.payment, ordenadas pelas mais recentes, limitadas a 8', () => {
    const lista = [
      po({ id: '1', invoice: { id: 'i1', payment: pagamento({ processedAt: '2026-01-01' }) } as never }),
      po({ id: '2', invoice: { id: 'i2', payment: pagamento({ processedAt: '2026-03-01' }) } as never }),
      po({ id: '3' }),
    ];
    ordersService.list.and.returnValue(of(lista));
    const c = montar();

    expect(c.recentPaid().map((o) => o.id)).toEqual(['2', '1']);
  });

  it('carrega o extrato de taxas da própria empresa', () => {
    ordersService.list.and.returnValue(of([]));
    montar();

    expect(platformFeesService.forCompany).toHaveBeenCalledWith('c1');
  });
});
