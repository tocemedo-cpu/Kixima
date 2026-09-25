import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { InventoryComponent } from './inventory.component';
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
    createdAt: '2026-01-01', updatedAt: '2026-01-01', ...overrides,
  };
}

describe('InventoryComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let catalogService: jasmine.SpyObj<CatalogService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    catalogService = jasmine.createSpyObj<CatalogService>('CatalogService', ['list', 'updateStock']);
    auth.user.and.returnValue(utilizador());
    TestBed.configureTestingModule({});
  });

  function montar(): InventoryComponent {
    return TestBed.runInInjectionContext(() => new InventoryComponent(auth, catalogService));
  }

  it('carrega os produtos do fornecedor e calcula unidades totais / abaixo do mínimo', () => {
    catalogService.list.and.returnValue(of([
      produto({ id: '1', stockQuantity: 10, minStock: 5 }),
      produto({ id: '2', stockQuantity: 2, minStock: 5 }),
      produto({ id: '3', stockQuantity: null, minStock: null }),
    ]));
    const c = montar();

    expect(catalogService.list).toHaveBeenCalledWith({ supplierId: 'c1' });
    expect(c.totalUnits()).toBe(12);
    expect(c.lowCount()).toBe(1);
  });

  it('startEdit() preenche o rascunho a partir do produto', () => {
    catalogService.list.and.returnValue(of([]));
    const c = montar();

    c.startEdit(produto({ id: 'p1', stockQuantity: 8, minStock: 3, warehouse: 'Armazém A', availability: 'Em stock' }));

    expect(c.editing()).toBe('p1');
    expect(c.draft()).toEqual({ stockQuantity: '8', minStock: '3', warehouse: 'Armazém A', availability: 'Em stock' });
  });

  it('save() envia só os campos preenchidos e recarrega a lista', fakeAsync(() => {
    catalogService.list.and.returnValue(of([produto()]));
    catalogService.updateStock.and.returnValue(of(produto()));
    const c = montar();
    c.startEdit(produto({ id: 'p1' }));
    c.updateDraft('stockQuantity', '20');
    c.updateDraft('minStock', '');
    c.updateDraft('warehouse', 'Armazém B');

    c.save('p1');
    flushMicrotasks();

    expect(catalogService.updateStock).toHaveBeenCalledWith('p1', { stockQuantity: 20, minStock: undefined, warehouse: 'Armazém B', availability: 'Em stock' });
    expect(c.success()).toBe('Inventário atualizado.');
    expect(c.editing()).toBeNull();
    expect(catalogService.list).toHaveBeenCalledTimes(2);
  }));

  it('save() regista o erro quando o servidor recusa', fakeAsync(() => {
    catalogService.list.and.returnValue(of([]));
    catalogService.updateStock.and.returnValue(throwError(() => new ApiError('Stock inválido', 400)));
    const c = montar();
    c.startEdit(produto({ id: 'p1' }));

    c.save('p1');
    flushMicrotasks();

    expect(c.error()).toBe('Stock inválido');
    expect(c.saving()).toBeFalse();
  }));
});
