import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CatalogInsightsComponent } from './catalog-insights.component';
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

function route(seg: string): ActivatedRoute {
  return { snapshot: { data: { seg } } } as unknown as ActivatedRoute;
}

describe('CatalogInsightsComponent', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let catalogService: jasmine.SpyObj<CatalogService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    catalogService = jasmine.createSpyObj<CatalogService>('CatalogService', ['list']);
    auth.user.and.returnValue(utilizador());
    TestBed.configureTestingModule({});
  });

  function montar(seg: string): CatalogInsightsComponent {
    return TestBed.runInInjectionContext(() => new CatalogInsightsComponent(auth, catalogService, route(seg)));
  }

  it('categorias: agrega por category e ordena por contagem decrescente', () => {
    catalogService.list.and.returnValue(of([
      produto({ id: '1', category: 'Válvulas' }),
      produto({ id: '2', category: 'Válvulas' }),
      produto({ id: '3', category: 'Bombas' }),
    ]));
    const c = montar('categorias');

    expect(c.title).toBe('Categorias');
    expect(c.mostraTabela()).toBeFalse();
    expect(c.agregacao()).toEqual([{ key: 'Válvulas', count: 2, units: 0 }, { key: 'Bombas', count: 1, units: 0 }]);
  });

  it('armazens: agrega por warehouse e soma as unidades em stock', () => {
    catalogService.list.and.returnValue(of([
      produto({ id: '1', warehouse: 'Luanda', stockQuantity: 10 }),
      produto({ id: '2', warehouse: 'Luanda', stockQuantity: 5 }),
      produto({ id: '3', warehouse: null }),
    ]));
    const c = montar('armazens');

    expect(c.title).toBe('Armazéns');
    expect(c.agregacao()).toEqual([{ key: 'Luanda', count: 2, units: 15 }]);
  });

  it('promocoes: filtra produtos com promoPrice > 0, mostra tabela', () => {
    catalogService.list.and.returnValue(of([
      produto({ id: '1', promoPrice: '80' }),
      produto({ id: '2', promoPrice: null }),
      produto({ id: '3', promoPrice: '0' }),
    ]));
    const c = montar('promocoes');

    expect(c.mostraTabela()).toBeTrue();
    expect(c.linhasProdutos().map((p) => p.id)).toEqual(['1']);
  });

  it('servicos: filtra pelas categorias de serviço', () => {
    catalogService.list.and.returnValue(of([
      produto({ id: '1', category: 'Engenharia' }),
      produto({ id: '2', category: 'Válvulas' }),
    ]));
    const c = montar('servicos');

    expect(c.linhasProdutos().map((p) => p.id)).toEqual(['1']);
  });

  it('regista o erro quando o carregamento falha', () => {
    catalogService.list.and.returnValue(throwError(() => new ApiError('Falha', 500)));
    const c = montar('categorias');

    expect(c.error()).toBe('Falha');
  });
});
