import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { PendingInvoicesComponent } from './pending-invoices.component';
import { FinanceiroService } from './financeiro.service';
import { FinanceiroInvoiceRow, FinanceiroInvoicesResponse } from '../../core/models/financeiro.model';
import { PaymentDto } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';

function fatura(overrides: Partial<FinanceiroInvoiceRow> = {}): FinanceiroInvoiceRow {
  return {
    id: 'f1', reference: 'FAT-001', supplier: 'Kianda', poId: 'po1', poReference: 'PO-1',
    amount: 1000, currency: 'AOA', status: 'PENDENTE', issuedAt: '2026-01-01', dueAt: '2026-01-08',
    ...overrides,
  };
}

function resposta(items: FinanceiroInvoiceRow[]): FinanceiroInvoicesResponse {
  return { kpis: { pendentes: items.length, valorPendente: 0, aVencer7: 0, vencidas: 0, aprovadasMes: 0 }, items };
}

describe('PendingInvoicesComponent', () => {
  let financeiroService: jasmine.SpyObj<FinanceiroService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    financeiroService = jasmine.createSpyObj<FinanceiroService>('FinanceiroService', ['invoices', 'pay']);
    router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    TestBed.configureTestingModule({});
  });

  it('carrega as faturas pendentes ao arrancar', () => {
    financeiroService.invoices.and.returnValue(of(resposta([fatura()])));
    const component = TestBed.runInInjectionContext(() => new PendingInvoicesComponent(financeiroService, router));

    expect(component.items().length).toBe(1);
  });

  it('items() filtra por referência ou fornecedor', () => {
    financeiroService.invoices.and.returnValue(of(resposta([
      fatura({ id: '1', reference: 'FAT-001', supplier: 'Kianda' }),
      fatura({ id: '2', reference: 'FAT-002', supplier: 'Outra' }),
    ])));
    const component = TestBed.runInInjectionContext(() => new PendingInvoicesComponent(financeiroService, router));

    component.q.set('kianda');
    expect(component.items().map((i) => i.id)).toEqual(['1']);
  });

  it('vencida() compara dueAt com agora', () => {
    financeiroService.invoices.and.returnValue(of(resposta([])));
    const component = TestBed.runInInjectionContext(() => new PendingInvoicesComponent(financeiroService, router));

    expect(component.vencida(fatura({ dueAt: '2000-01-01' }))).toBeTrue();
    expect(component.vencida(fatura({ dueAt: '2999-01-01' }))).toBeFalse();
  });

  it('verFatura() navega para /documento/fatura/:poId', () => {
    financeiroService.invoices.and.returnValue(of(resposta([])));
    const component = TestBed.runInInjectionContext(() => new PendingInvoicesComponent(financeiroService, router));

    component.verFatura('po1');

    expect(router.navigateByUrl).toHaveBeenCalledWith('/documento/fatura/po1');
  });

  it('confirmarPagamento() exige comprovativo, chama o serviço e recarrega', fakeAsync(() => {
    financeiroService.invoices.and.returnValue(of(resposta([fatura()])));
    financeiroService.pay.and.returnValue(of({} as PaymentDto));
    const component = TestBed.runInInjectionContext(() => new PendingInvoicesComponent(financeiroService, router));

    component.abrirModal(fatura());
    component.confirmarPagamento(); // sem comprovativo — não deve chamar o serviço
    expect(financeiroService.pay).not.toHaveBeenCalled();

    const ficheiro = new File(['x'], 'comprovativo.pdf');
    component.proof.set(ficheiro);
    component.confirmarPagamento();
    flushMicrotasks();

    expect(financeiroService.pay).toHaveBeenCalledWith('f1', ficheiro);
    expect(component.payModal()).toBeNull();
    expect(component.toast()).toContain('FAT-001');
    expect(financeiroService.invoices).toHaveBeenCalledTimes(2);
  }));

  it('confirmarPagamento() regista o erro quando o servidor recusa', fakeAsync(() => {
    financeiroService.invoices.and.returnValue(of(resposta([fatura()])));
    financeiroService.pay.and.returnValue(throwError(() => new ApiError('SLA excedido', 409)));
    const component = TestBed.runInInjectionContext(() => new PendingInvoicesComponent(financeiroService, router));

    component.abrirModal(fatura());
    component.proof.set(new File(['x'], 'comprovativo.pdf'));
    component.confirmarPagamento();
    flushMicrotasks();

    expect(component.error()).toBe('SLA excedido');
    expect(component.paying()).toBeNull();
  }));

  it('regista o erro quando o carregamento inicial falha', () => {
    financeiroService.invoices.and.returnValue(throwError(() => new ApiError('Sem permissão', 403)));
    const component = TestBed.runInInjectionContext(() => new PendingInvoicesComponent(financeiroService, router));

    expect(component.error()).toBe('Sem permissão');
  });
});
