import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { FornecedorHomeComponent } from './fornecedor-home.component';
import { OrdersService } from '../orders/orders.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';

function po(overrides: Partial<PurchaseOrderDto> = {}): PurchaseOrderDto {
  return {
    id: 'po1', reference: 'PO-1', buyerCompanyId: 'b1', supplierCompanyId: 's1', status: 'APROVADA',
    totalAmount: '1000', currency: 'AOA', createdAt: '2026-01-01', ...overrides,
  } as PurchaseOrderDto;
}

describe('FornecedorHomeComponent', () => {
  let ordersService: jasmine.SpyObj<OrdersService>;
  let router: jasmine.SpyObj<{ navigate: (c: unknown[]) => void }>;

  beforeEach(() => {
    ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['list']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({});
  });

  function montar(): FornecedorHomeComponent {
    return TestBed.runInInjectionContext(() => new FornecedorHomeComponent(ordersService, router as never));
  }

  it('carrega as ordens e classifica novas/aguardando pagamento/pagas', () => {
    ordersService.list.and.returnValue(of([
      po({ id: '1', status: 'APROVADA' }),
      po({ id: '2', status: 'ACEITE_FORNECEDOR' }),
      po({ id: '3', status: 'AGUARDANDO_PAGAMENTO' }),
      po({ id: '4', status: 'CONCLUIDA', paidAt: '2026-02-01' }),
    ]));
    const c = montar();

    expect(ordersService.list).toHaveBeenCalledWith();
    expect(c.novas().map((o) => o.id)).toEqual(['1']);
    expect(c.aguardandoPagamento().map((o) => o.id)).toEqual(['2', '3']);
    expect(c.pagas().map((o) => o.id)).toEqual(['4']);
  });

  it('recentes() mostra só os primeiros 8', () => {
    const lista = Array.from({ length: 10 }, (_, i) => po({ id: `p${i}` }));
    ordersService.list.and.returnValue(of(lista));
    const c = montar();

    expect(c.recentes().length).toBe(8);
  });

  it('regista o erro quando o carregamento falha', () => {
    ordersService.list.and.returnValue(throwError(() => new ApiError('Falha', 500)));
    const c = montar();

    expect(c.error()).toBe('Falha');
  });

  it('verOrdem() navega para o detalhe da PO', () => {
    ordersService.list.and.returnValue(of([]));
    const c = montar();

    c.verOrdem(po({ id: 'po9' }));

    expect(router.navigate).toHaveBeenCalledWith(['/fornecedor/ordens', 'po9']);
  });
});
