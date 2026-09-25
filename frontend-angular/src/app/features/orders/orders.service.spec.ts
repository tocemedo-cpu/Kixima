import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OrdersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('buyerOrders() chama GET /api/buyer/orders com os parâmetros de filtro', () => {
    service.buyerOrders({ status: 'ANDAMENTO', q: 'PO-1', page: 2, limit: 15 }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/buyer/orders');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('ANDAMENTO');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ kpis: {}, items: [], total: 0, page: 2, pages: 1 });
  });

  it('buyerPayments() chama GET /api/buyer/payments com status e q opcionais', () => {
    service.buyerPayments('ATRASADO', 'kianda').subscribe();
    const req = http.expectOne((r) => r.url === '/api/buyer/payments');
    expect(req.request.params.get('status')).toBe('ATRASADO');
    expect(req.request.params.get('q')).toBe('kianda');
    req.flush({ kpis: {}, items: [] });

    service.buyerPayments().subscribe();
    const semFiltro = http.expectOne((r) => r.url === '/api/buyer/payments');
    expect(semFiltro.request.params.has('status')).toBeFalse();
    expect(semFiltro.request.params.has('q')).toBeFalse();
    semFiltro.flush({ kpis: {}, items: [] });
  });

  it('create() envia POST /api/purchase-orders com o corpo exacto (createPoSchema)', () => {
    const body = { supplierCompanyId: 's1', items: [{ productId: 'p1', quantity: 2 }] };
    service.create(body).subscribe();
    const req = http.expectOne('/api/purchase-orders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('as acções de PO chamam os endpoints PATCH correctos', () => {
    service.approve('po1').subscribe();
    http.expectOne({ url: '/api/purchase-orders/po1/approve', method: 'PATCH' }).flush({});

    service.reject('po1', { reason: 'sem verba' }).subscribe();
    const rejeitar = http.expectOne({ url: '/api/purchase-orders/po1/reject', method: 'PATCH' });
    expect(rejeitar.request.body).toEqual({ reason: 'sem verba' });
    rejeitar.flush({});

    service.accept('po1').subscribe();
    http.expectOne({ url: '/api/purchase-orders/po1/accept', method: 'PATCH' }).flush({});

    service.dispatch('po1').subscribe();
    http.expectOne({ url: '/api/purchase-orders/po1/dispatch', method: 'PATCH' }).flush({});

    service.markDelivered('po1').subscribe();
    http.expectOne({ url: '/api/purchase-orders/po1/delivered', method: 'PATCH' }).flush({});

    service.confirmReception('po1', { conforme: true }).subscribe();
    http.expectOne({ url: '/api/purchase-orders/po1/reception', method: 'PATCH' }).flush({});

    service.resolveDivergence('po1', { outcome: 'ACEITE' }).subscribe();
    http.expectOne({ url: '/api/purchase-orders/po1/resolve-divergence', method: 'PATCH' }).flush({});
  });

  it('history() chama GET /api/purchase-orders/:id/history', () => {
    service.history('po1').subscribe();
    http.expectOne({ url: '/api/purchase-orders/po1/history', method: 'GET' }).flush([]);
  });

  it('list() chama GET /api/purchase-orders sem `page` — array puro, com/sem filtro de status', () => {
    service.list('AGUARDANDO_APROVACAO').subscribe();
    const comStatus = http.expectOne((r) => r.url === '/api/purchase-orders');
    expect(comStatus.request.method).toBe('GET');
    expect(comStatus.request.params.get('status')).toBe('AGUARDANDO_APROVACAO');
    expect(comStatus.request.params.has('page')).toBeFalse();
    comStatus.flush([]);

    service.list().subscribe();
    const semStatus = http.expectOne((r) => r.url === '/api/purchase-orders');
    expect(semStatus.request.params.has('status')).toBeFalse();
    semStatus.flush([]);
  });

  it('listPage() chama GET /api/purchase-orders com `page` — envelope paginado', () => {
    service.listPage({ invoiced: 'true', page: 2, limit: 15 }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/purchase-orders');
    expect(req.request.params.get('invoiced')).toBe('true');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('15');
    req.flush({ items: [], total: 0, page: 2, pages: 1, limit: 15 });
  });

  it('confirmPaymentReceived() chama PATCH /api/payments/:paymentId/confirm-received', () => {
    service.confirmPaymentReceived('pay1').subscribe();
    http.expectOne({ url: '/api/payments/pay1/confirm-received', method: 'PATCH' }).flush({});
  });

  it('buyerDeliveries() chama GET /api/buyer/deliveries com stage e q', () => {
    service.buyerDeliveries('EM_TRANSITO', 'kianda').subscribe();
    const req = http.expectOne((r) => r.url === '/api/buyer/deliveries');
    expect(req.request.params.get('stage')).toBe('EM_TRANSITO');
    expect(req.request.params.get('q')).toBe('kianda');
    req.flush({ kpis: {}, items: [] });
  });

  it('buyerReceptions() chama GET /api/buyer/receptions com status e q', () => {
    service.buyerReceptions('DIVERGENCIA', 'valvula').subscribe();
    const req = http.expectOne((r) => r.url === '/api/buyer/receptions');
    expect(req.request.params.get('status')).toBe('DIVERGENCIA');
    expect(req.request.params.get('q')).toBe('valvula');
    req.flush({ kpis: {}, items: [] });
  });

  it('emitirNotaCredito() e anularFatura() chamam os endpoints de fatura correctos', () => {
    service.emitirNotaCredito('inv1', 'devolução', 500).subscribe();
    const nc = http.expectOne({ url: '/api/payments/invoices/inv1/notas-credito', method: 'POST' });
    expect(nc.request.body).toEqual({ motivo: 'devolução', amount: 500 });
    nc.flush({});

    service.anularFatura('inv1', 'cancelamento').subscribe();
    const anular = http.expectOne({ url: '/api/payments/invoices/inv1/anular', method: 'POST' });
    expect(anular.request.body).toEqual({ motivo: 'cancelamento' });
    anular.flush({});
  });
});
