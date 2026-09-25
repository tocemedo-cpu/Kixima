import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { PaymentHistoryComponent } from './payment-history.component';
import { FinanceiroService } from './financeiro.service';
import { FinanceiroInvoiceRow, FinanceiroPaymentsResponse } from '../../core/models/financeiro.model';
import { ApiError } from '../../core/models/api-error.model';

function fatura(overrides: Partial<FinanceiroInvoiceRow> = {}): FinanceiroInvoiceRow {
  return {
    id: 'f1', reference: 'FAT-001', supplier: 'Kianda', poId: 'po1', poReference: 'PO-1',
    amount: 1000, currency: 'AOA', status: 'PENDENTE', issuedAt: '2026-01-01', dueAt: '2026-01-08',
    ...overrides,
  };
}

function resposta(items: FinanceiroInvoiceRow[]): FinanceiroPaymentsResponse {
  return { kpis: { aPagar: 0, pagosMes: 0, vencidos: 0, total: items.length }, items };
}

describe('PaymentHistoryComponent', () => {
  let financeiroService: jasmine.SpyObj<FinanceiroService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    financeiroService = jasmine.createSpyObj<FinanceiroService>('FinanceiroService', ['payments']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  it('carrega todos os pagamentos ao arrancar, sem filtro de separador', () => {
    financeiroService.payments.and.returnValue(of(resposta([fatura()])));
    const component = TestBed.runInInjectionContext(() => new PaymentHistoryComponent(financeiroService, router));

    expect(financeiroService.payments).toHaveBeenCalledWith(undefined);
    expect(component.items().length).toBe(1);
  });

  it('setTab() recarrega com o novo separador', () => {
    financeiroService.payments.and.returnValue(of(resposta([])));
    const component = TestBed.runInInjectionContext(() => new PaymentHistoryComponent(financeiroService, router));

    component.setTab('PAGO');

    expect(financeiroService.payments).toHaveBeenCalledWith('PAGO');
    expect(component.tab()).toBe('PAGO');
  });

  it('items() filtra por referência ou fornecedor', () => {
    financeiroService.payments.and.returnValue(of(resposta([
      fatura({ id: '1', reference: 'FAT-001', supplier: 'Kianda' }),
      fatura({ id: '2', reference: 'FAT-002', supplier: 'Outra' }),
    ])));
    const component = TestBed.runInInjectionContext(() => new PaymentHistoryComponent(financeiroService, router));

    component.q.set('FAT-002');
    expect(component.items().map((i) => i.id)).toEqual(['2']);
  });

  it('vencida() só é verdade para PENDENTE com dueAt no passado', () => {
    financeiroService.payments.and.returnValue(of(resposta([])));
    const component = TestBed.runInInjectionContext(() => new PaymentHistoryComponent(financeiroService, router));

    expect(component.vencida(fatura({ status: 'PENDENTE', dueAt: '2000-01-01' }))).toBeTrue();
    expect(component.vencida(fatura({ status: 'PAGA', dueAt: '2000-01-01' }))).toBeFalse();
  });

  it('verFatura()/verPo() navegam para as rotas de documento correctas', () => {
    financeiroService.payments.and.returnValue(of(resposta([])));
    const component = TestBed.runInInjectionContext(() => new PaymentHistoryComponent(financeiroService, router));

    component.verFatura('po1');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/documento/fatura/po1');

    component.verPo('po1');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/documento/po/po1');
  });

  it('regista o erro quando o carregamento falha', () => {
    financeiroService.payments.and.returnValue(throwError(() => new ApiError('Sem permissão', 403)));
    const component = TestBed.runInInjectionContext(() => new PaymentHistoryComponent(financeiroService, router));

    expect(component.error()).toBe('Sem permissão');
  });
});
