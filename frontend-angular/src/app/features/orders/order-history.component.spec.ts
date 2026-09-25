import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OrderHistoryComponent } from './order-history.component';
import { OrdersService } from './orders.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';

function po(overrides: Partial<PurchaseOrderDto> = {}): PurchaseOrderDto {
  return {
    id: 'po1', reference: 'PO-1', buyerCompanyId: 'b1', supplierCompanyId: 's1', status: 'APROVADA',
    totalAmount: '1000', currency: 'AOA', createdAt: '2026-01-01', ...overrides,
  } as PurchaseOrderDto;
}

describe('OrderHistoryComponent', () => {
  let ordersService: jasmine.SpyObj<OrdersService>;
  let router: jasmine.SpyObj<{ navigate: (c: unknown[]) => void }>;

  beforeEach(() => {
    ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['list']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({});
  });

  function montar(): OrderHistoryComponent {
    return TestBed.runInInjectionContext(() => new OrderHistoryComponent(ordersService, router as never));
  }

  it('closed() só inclui ordens fechadas (CONCLUIDA/RECEBIDA_CONFORME/RECEBIDA_COM_DIVERGENCIA)', () => {
    ordersService.list.and.returnValue(of([
      po({ id: '1', status: 'CONCLUIDA' }),
      po({ id: '2', status: 'APROVADA' }),
      po({ id: '3', status: 'RECEBIDA_CONFORME' }),
      po({ id: '4', status: 'RECEBIDA_COM_DIVERGENCIA' }),
      po({ id: '5', status: 'EM_EXECUCAO' }),
    ]));
    const c = montar();

    expect(c.closed().map((o) => o.id)).toEqual(['1', '3', '4']);
  });

  it('regista o erro quando o carregamento falha', () => {
    ordersService.list.and.returnValue(throwError(() => new ApiError('Falha', 500)));
    const c = montar();

    expect(c.error()).toBe('Falha');
  });

  it('verOrdem() navega para o detalhe da PO', () => {
    ordersService.list.and.returnValue(of([]));
    const c = montar();

    c.verOrdem('po9');

    expect(router.navigate).toHaveBeenCalledWith(['/fornecedor/ordens', 'po9']);
  });
});
