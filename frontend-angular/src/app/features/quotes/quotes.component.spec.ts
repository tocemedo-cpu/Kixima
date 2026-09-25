import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { QuotesComponent } from './quotes.component';
import { QuotesService } from './quotes.service';
import { CatalogService } from '../catalog/catalog.service';
import { ProductDto } from '../../core/models/product.model';
import { QuoteRequestDto } from '../../core/models/quote.model';

const COTACAO_CRIADA: QuoteRequestDto = {
  id: 'q1', buyerCompanyId: 'b1', supplierCompanyId: 's1', createdById: 'u1',
  status: 'ABERTA', note: null, responsePrice: null, responseLeadDays: null,
  responseNote: null, respondedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01',
  items: [], buyerCompany: { id: 'b1', name: 'Compradora' }, supplierCompany: { id: 's1', name: 'Fornecedor s1' },
};

function produto(id: string, supplierId: string): ProductDto {
  return {
    id, supplierId, name: `Produto ${id}`, category: 'Válvulas', unitPrice: '100.00', currency: 'AOA',
    kind: 'PRODUTO', certifications: [], tags: [], active: true, reviewCount: 0, viewCount: 0,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', supplier: { id: supplierId, name: `Fornecedor ${supplierId}` },
  };
}

describe('QuotesComponent — regra "mesmo fornecedor"', () => {
  let component: QuotesComponent;
  let quotesService: jasmine.SpyObj<QuotesService>;

  beforeEach(() => {
    const catalogService = jasmine.createSpyObj<CatalogService>('CatalogService', ['list']);
    catalogService.list.and.returnValue(of([produto('p1', 's1'), produto('p2', 's1'), produto('p3', 's2')]));
    quotesService = jasmine.createSpyObj<QuotesService>('QuotesService', ['list', 'create', 'respond', 'close']);
    quotesService.list.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        { provide: CatalogService, useValue: catalogService },
        { provide: QuotesService, useValue: quotesService },
      ],
    });
    component = TestBed.runInInjectionContext(() => new QuotesComponent(quotesService, catalogService));
  });

  it('deteta o fornecedor único quando todos os itens são do mesmo', () => {
    component.setLine(0, { productId: 'p1' });
    component.addLine();
    component.setLine(1, { productId: 'p2' });
    expect(component.sameSupplier()).toBeTrue();
    expect(component.supplierIds()).toEqual(['s1']);
  });

  it('assinala fornecedores diferentes — a mesma regra de quoteService.createRequest', () => {
    component.setLine(0, { productId: 'p1' });
    component.addLine();
    component.setLine(1, { productId: 'p3' });
    expect(component.sameSupplier()).toBeFalse();
  });

  it('recusa submeter sem produtos escolhidos, sem chamar a API', async () => {
    await component.submit();
    expect(component.error()).toBe('Adicione pelo menos um produto.');
    expect(quotesService.create).not.toHaveBeenCalled();
  });

  it('recusa submeter com fornecedores diferentes, sem chamar a API', async () => {
    component.setLine(0, { productId: 'p1' });
    component.addLine();
    component.setLine(1, { productId: 'p3' });
    await component.submit();
    expect(component.error()).toBe('Todos os produtos do pedido devem ser do mesmo fornecedor.');
    expect(quotesService.create).not.toHaveBeenCalled();
  });

  it('envia o pedido com o supplierCompanyId derivado quando tudo está certo', async () => {
    quotesService.create.and.returnValue(of(COTACAO_CRIADA));
    component.setLine(0, { productId: 'p1', quantity: 3 });
    await component.submit();
    expect(quotesService.create).toHaveBeenCalledWith({
      supplierCompanyId: 's1',
      items: [{ productId: 'p1', quantity: 3 }],
      note: undefined,
    });
  });
});
