import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { of, throwError } from 'rxjs';
import { PrintableDocumentComponent } from './printable-document.component';
import { OrdersService } from '../orders/orders.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';

function poBase(overrides: Partial<PurchaseOrderDto> = {}): PurchaseOrderDto {
  return {
    id: 'po1', reference: 'PO-2026-0001', buyerCompanyId: 'b1', supplierCompanyId: 's1', createdById: 'u1',
    status: 'ACEITE_FORNECEDOR', totalAmount: '1140000', currency: 'AOA', isCallOff: false, erpManaged: false,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    buyerCompany: { id: 'b1', name: 'Compradora Lda', taxId: 'AO-B1', city: 'Luanda' },
    supplierCompany: { id: 's1', name: 'Fornecedora Lda', taxId: 'AO-S1', bankName: 'BAI', iban: 'AO06...', swift: 'BAIPAOLU' },
    items: [
      { id: 'i1', purchaseOrderId: 'po1', productId: 'p1', quantity: 2, unitPrice: '500000', lineTotal: '1000000', product: { id: 'p1', name: 'Válvula', category: 'Válvulas', kind: 'PRODUTO' } },
    ],
    ...overrides,
  };
}

function route(id: string, kind: 'po' | 'invoice', baixar = false): ActivatedRoute {
  return {
    snapshot: {
      paramMap: { get: () => id },
      queryParamMap: { get: (k: string) => (k === 'baixar' && baixar ? '1' : null) },
      data: { kind },
    },
  } as unknown as ActivatedRoute;
}

function montar(po: PurchaseOrderDto, kind: 'po' | 'invoice' = 'po', baixar = false) {
  // Alguns testes montam mais do que um componente na mesma função `it`
  // (ex.: reference()/delivery() comparam vários cenários) — sem isto, a
  // segunda chamada a configureTestingModule falha porque o TestBed já foi
  // instanciado pela primeira.
  TestBed.resetTestingModule();
  const ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['get']);
  ordersService.get.and.returnValue(of(po));
  const location = jasmine.createSpyObj<Location>('Location', ['back']);
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new PrintableDocumentComponent(route(po.id, kind, baixar), ordersService, location));
  return { componente, ordersService, location };
}

describe('PrintableDocumentComponent', () => {
  it('carrega a PO pelo id do endereço', () => {
    const { componente, ordersService } = montar(poBase());
    expect(ordersService.get).toHaveBeenCalledWith('po1');
    expect(componente.po()?.reference).toBe('PO-2026-0001');
    expect(componente.isInvoice).toBeFalse();
  });

  it('isInvoice reflecte os dados da rota (kind=invoice)', () => {
    const { componente } = montar(poBase({ invoice: { id: 'inv1', reference: 'FAT-1', amount: '1140000', currency: 'AOA', status: 'PAGA', issuedAt: '2026-01-02', dueAt: '2026-01-09', creditNotes: [], lines: [] } }), 'invoice');
    expect(componente.isInvoice).toBeTrue();
  });

  it('?baixar=1 dispara a impressão automática após carregar', (done) => {
    spyOn(window, 'print');
    montar(poBase(), 'po', true);
    setTimeout(() => {
      expect(window.print).toHaveBeenCalled();
      done();
    }, 400);
  });

  it('subtotal/net/tax calculam-se a partir dos itens quando a PO não tem os valores gravados', () => {
    const { componente } = montar(poBase());
    expect(componente.subtotal).toBe(1000000);
    expect(componente.net).toBe(1000000);
    expect(componente.tax).toBeCloseTo(140000, 5);
    expect(componente.estimado).toBeTrue();
  });

  it('net/tax usam os valores gravados no servidor quando presentes (não estimados)', () => {
    const { componente } = montar(poBase({ netAmount: '1000000', taxAmount: '140000', totalAmount: '1140000' }));
    expect(componente.net).toBe(1000000);
    expect(componente.tax).toBe(140000);
    expect(componente.estimado).toBeFalse();
  });

  it('withheld soma 6,5% só dos itens kind=SERVICO', () => {
    const { componente } = montar(poBase({
      items: [
        { id: 'i1', purchaseOrderId: 'po1', productId: 'p1', quantity: 1, unitPrice: '100000', lineTotal: '100000', product: { id: 'p1', name: 'Peça', kind: 'PRODUTO' } },
        { id: 'i2', purchaseOrderId: 'po1', productId: 'p2', quantity: 1, unitPrice: '200000', lineTotal: '200000', product: { id: 'p2', name: 'Inspeção', kind: 'SERVICO' } },
      ],
    }));
    expect(componente.withheld).toBeCloseTo(200000 * 0.065, 5);
  });

  it('reference() devolve a referência da PO ou da fatura conforme isInvoice', () => {
    const invoice = { id: 'inv1', reference: 'FAT-2026-0001', amount: '1140000', currency: 'AOA', status: 'PAGA', issuedAt: '2026-01-02', dueAt: '2026-01-09', creditNotes: [], lines: [] };
    const { componente: comPo } = montar(poBase(), 'po');
    expect(comPo.reference).toBe('PO-2026-0001');
    const { componente: comFatura } = montar(poBase({ invoice }), 'invoice');
    expect(comFatura.reference).toBe('FAT-2026-0001');
  });

  it('delivery() usa address, ou cidade/província/país, ou o texto por omissão', () => {
    const { componente: c1 } = montar(poBase({ buyerCompany: { id: 'b1', name: 'X', address: 'Rua 1' } }));
    expect(c1.delivery).toBe('Rua 1');
    const { componente: c2 } = montar(poBase({ buyerCompany: { id: 'b1', name: 'X', city: 'Luanda', country: 'Angola' } }));
    expect(c2.delivery).toBe('Luanda, Angola');
    const { componente: c3 } = montar(poBase({ buyerCompany: { id: 'b1', name: 'X' } }));
    expect(c3.delivery).toBe('A definir na receção');
  });

  it('numeroDocumentoAGT() formata série.ano/sequencial com 7 dígitos, ou null sem série', () => {
    const { componente } = montar(poBase());
    expect(componente.numeroDocumentoAGT({ serie: '000AB', numeroNaSerie: 1, issuedAt: '2026-03-01' })).toBe('000AB.2026/0000001');
    expect(componente.numeroDocumentoAGT({ serie: null, numeroNaSerie: null, issuedAt: '2026-03-01' })).toBeNull();
  });

  it('numeroDocumentoAGTCreditNota() cai na referência quando não há série', () => {
    const { componente } = montar(poBase());
    expect(componente.numeroDocumentoAGTCreditNota({ serie: null, numeroNaSerie: null, issuedAt: '2026-01-01', reference: 'NC-1' })).toBe('NC-1');
  });

  it('voltar() delega no Location.back()', () => {
    const { componente, location } = montar(poBase());
    componente.voltar();
    expect(location.back).toHaveBeenCalled();
  });

  it('regista o erro quando o carregamento falha', () => {
    const ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['get']);
    ordersService.get.and.returnValue(throwError(() => new ApiError('Falha ao carregar.', 500)));
    const location = jasmine.createSpyObj<Location>('Location', ['back']);
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(() => new PrintableDocumentComponent(route('po1', 'po'), ordersService, location));
    expect(componente.error()).toBe('Falha ao carregar.');
  });
});
