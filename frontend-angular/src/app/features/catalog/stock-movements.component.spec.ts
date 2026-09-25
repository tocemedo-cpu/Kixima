import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { StockMovementsComponent } from './stock-movements.component';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from './catalog.service';
import { ProductDto } from '../../core/models/product.model';
import { KiximaUser } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(): KiximaUser {
  return { id: 'u1', name: 'Duarte', email: 'd@a.co', role: 'FORNECEDOR', adminAreas: [], companyId: 'c1', companyType: 'FORNECEDOR', avatarUrl: null };
}

function produto(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: 'p1', supplierId: 'c1', name: 'Válvula', category: 'Válvulas', unitPrice: '100', currency: 'AOA',
    kind: 'PRODUTO', certifications: [], tags: [], active: true, reviewCount: 0, viewCount: 0,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', stockQuantity: 5, ...overrides,
  };
}

function route(isEntrada: boolean): ActivatedRoute {
  return { snapshot: { data: { isEntrada } } } as unknown as ActivatedRoute;
}

describe('StockMovementsComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let catalogService: jasmine.SpyObj<CatalogService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    catalogService = jasmine.createSpyObj<CatalogService>('CatalogService', ['list', 'movements', 'createMovement']);
    auth.user.and.returnValue(utilizador());
    catalogService.list.and.returnValue(of([produto()]));
    catalogService.movements.and.returnValue(of({ itens: [], total: 0, pagina: 1, porPagina: 25, paginas: 0 }));
    TestBed.configureTestingModule({});
  });

  function montar(isEntrada = true): StockMovementsComponent {
    return TestBed.runInInjectionContext(() => new StockMovementsComponent(auth, catalogService, route(isEntrada)));
  }

  it('lê isEntrada dos dados da rota e ajusta o título/tipo', () => {
    const entradas = montar(true);
    expect(entradas.isEntrada).toBeTrue();
    expect(entradas.title).toBe('Entradas');
    expect(catalogService.movements).toHaveBeenCalledWith('ENTRADA', 100);

    const saidas = montar(false);
    expect(saidas.isEntrada).toBeFalse();
    expect(saidas.title).toBe('Saídas');
    expect(catalogService.movements).toHaveBeenCalledWith('SAIDA', 100);
  });

  it('handleSubmit() valida produto e quantidade antes de chamar o serviço', fakeAsync(() => {
    const c = montar();

    c.handleSubmit();
    flushMicrotasks();
    expect(c.error()).toBe('Escolha o produto.');
    expect(catalogService.createMovement).not.toHaveBeenCalled();

    c.update('productId', 'p1');
    c.handleSubmit();
    flushMicrotasks();
    expect(c.error()).toBe('Indique uma quantidade válida.');

    c.update('quantity', '0');
    c.handleSubmit();
    flushMicrotasks();
    expect(c.error()).toBe('Indique uma quantidade válida.');
  }));

  it('handleSubmit() regista o movimento, mostra sucesso e recarrega a lista', fakeAsync(() => {
    catalogService.createMovement.and.returnValue(of({ id: 'm1', productId: 'p1', type: 'ENTRADA', quantity: 10, createdById: 'u1', createdAt: '2026-01-01' }));
    const c = montar(true);
    c.update('productId', 'p1');
    c.update('quantity', '10');
    c.update('note', 'reposição');

    c.handleSubmit();
    flushMicrotasks();

    expect(catalogService.createMovement).toHaveBeenCalledWith({ productId: 'p1', type: 'ENTRADA', quantity: 10, note: 'reposição' });
    expect(c.success()).toBe('Entrada registada. O stock foi atualizado.');
    expect(c.form()).toEqual({ productId: '', quantity: '', note: '' });
    expect(catalogService.movements).toHaveBeenCalledTimes(2);
  }));

  it('handleSubmit() regista o erro quando o servidor recusa', fakeAsync(() => {
    catalogService.createMovement.and.returnValue(throwError(() => new ApiError('Produto não encontrado', 404)));
    const c = montar();
    c.update('productId', 'p1');
    c.update('quantity', '5');

    c.handleSubmit();
    flushMicrotasks();

    expect(c.error()).toBe('Produto não encontrado');
    expect(c.saving()).toBeFalse();
  }));

  it('productName() resolve o nome a partir da lista de produtos carregada', () => {
    catalogService.list.and.returnValue(of([produto({ id: 'p1', name: 'Bomba centrífuga' })]));
    const c = montar();

    expect(c.productName('p1')).toBe('Bomba centrífuga');
    expect(c.productName('inexistente')).toBe('—');
  });
});
