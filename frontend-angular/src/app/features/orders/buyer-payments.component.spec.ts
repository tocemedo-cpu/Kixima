import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { BuyerPaymentsComponent } from './buyer-payments.component';
import { OrdersService } from './orders.service';
import { BuyerPaymentRow, BuyerPaymentsResponse } from '../../core/models/buyer-payments.model';
import { ApiError } from '../../core/models/api-error.model';

function linha(overrides: Partial<BuyerPaymentRow> = {}): BuyerPaymentRow {
  return {
    id: 'inv1', poId: 'po1', reference: 'PO-1', invoiceRef: 'FAT-1', supplier: { id: 's1', name: 'Kianda' },
    poDate: '2026-01-01', dueAt: '2026-01-08', amount: 1000, paid: 0, open: 1000, status: 'PENDENTE', currency: 'AOA',
    origin: 'Gerada a partir do Checkout', ...overrides,
  };
}

function resposta(items: BuyerPaymentRow[]): BuyerPaymentsResponse {
  return { kpis: { aPagar: 0, concluidos: 0, atrasados: 0, totalPO: 0 }, items };
}

describe('BuyerPaymentsComponent', () => {
  let ordersService: jasmine.SpyObj<OrdersService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['buyerPayments']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  it('carrega os pagamentos ao arrancar, sem filtros', () => {
    ordersService.buyerPayments.and.returnValue(of(resposta([linha()])));
    const component = TestBed.runInInjectionContext(() => new BuyerPaymentsComponent(ordersService, router));

    expect(ordersService.buyerPayments).toHaveBeenCalledWith(undefined, undefined);
    expect(component.items().length).toBe(1);
  });

  it('setTab() e onQ() recarregam com os novos parâmetros', () => {
    ordersService.buyerPayments.and.returnValue(of(resposta([])));
    const component = TestBed.runInInjectionContext(() => new BuyerPaymentsComponent(ordersService, router));

    component.setTab('ATRASADO');
    expect(ordersService.buyerPayments).toHaveBeenCalledWith('ATRASADO', undefined);

    component.onQ('kianda');
    expect(ordersService.buyerPayments).toHaveBeenCalledWith('ATRASADO', 'kianda');
  });

  it('verOrdem() navega para /comprador/ordens/:poId', () => {
    ordersService.buyerPayments.and.returnValue(of(resposta([])));
    const component = TestBed.runInInjectionContext(() => new BuyerPaymentsComponent(ordersService, router));

    component.verOrdem('po1');

    expect(router.navigateByUrl).toHaveBeenCalledWith('/comprador/ordens/po1');
  });

  it('irParaAjuda() navega para /ajuda', () => {
    ordersService.buyerPayments.and.returnValue(of(resposta([])));
    const component = TestBed.runInInjectionContext(() => new BuyerPaymentsComponent(ordersService, router));

    component.irParaAjuda();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/ajuda');
  });

  it('regista o erro quando o carregamento falha', () => {
    ordersService.buyerPayments.and.returnValue(throwError(() => new ApiError('Sem permissão', 403)));
    const component = TestBed.runInInjectionContext(() => new BuyerPaymentsComponent(ordersService, router));

    expect(component.error()).toBe('Sem permissão');
  });
});
