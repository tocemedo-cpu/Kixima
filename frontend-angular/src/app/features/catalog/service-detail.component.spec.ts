import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { of, throwError } from 'rxjs';
import { ServiceDetailComponent } from './service-detail.component';
import { CatalogService } from './catalog.service';
import { QuotesService } from '../quotes/quotes.service';
import { ProductDto } from '../../core/models/product.model';
import { ProductReviewDto } from '../../core/models/marketplace-extra.model';
import { QuoteRequestDto } from '../../core/models/quote.model';
import { ApiError } from '../../core/models/api-error.model';

function produto(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: 'p1', supplierId: 's1', name: 'Manutenção Industrial', category: 'Serviços',
    unitPrice: '1000', currency: 'AOA', kind: 'SERVICO', certifications: [], tags: [],
    active: true, rating: 4, reviewCount: 2, viewCount: 10,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    supplier: { id: 's1', name: 'Fornecedora Lda' },
    ...overrides,
  };
}

function montar(slug = 'manutencao-industrial') {
  const catalogService = jasmine.createSpyObj<CatalogService>('CatalogService', ['getBySlug', 'reviews', 'createReview']);
  const quotesService = jasmine.createSpyObj<QuotesService>('QuotesService', ['create']);
  catalogService.getBySlug.and.returnValue(of(produto()));
  catalogService.reviews.and.returnValue(of([]));
  const route = { snapshot: { paramMap: { get: () => slug } } } as unknown as ActivatedRoute;
  const location = jasmine.createSpyObj<Location>('Location', ['back']);
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(
    () => new ServiceDetailComponent(route, catalogService, quotesService, location),
  );
  return { componente, catalogService, quotesService, location };
}

describe('ServiceDetailComponent', () => {
  it('carrega o produto pelo slug e as avaliações associadas', () => {
    const { componente, catalogService } = montar('manutencao-industrial');
    expect(catalogService.getBySlug).toHaveBeenCalledWith('manutencao-industrial');
    expect(componente.p()?.id).toBe('p1');
    expect(catalogService.reviews).toHaveBeenCalledWith('p1');
  });

  it('regista o erro quando o produto não é encontrado', () => {
    const catalogService = jasmine.createSpyObj<CatalogService>('CatalogService', ['getBySlug', 'reviews', 'createReview']);
    const quotesService = jasmine.createSpyObj<QuotesService>('QuotesService', ['create']);
    catalogService.getBySlug.and.returnValue(throwError(() => new ApiError('Não encontrado', 404, 'NOT_FOUND')));
    const route = { snapshot: { paramMap: { get: () => 'inexistente' } } } as unknown as ActivatedRoute;
    const location = jasmine.createSpyObj<Location>('Location', ['back']);
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(
      () => new ServiceDetailComponent(route, catalogService, quotesService, location),
    );
    expect(componente.error()).toBe('Não encontrado');
  });

  it('setRating() converte a string do <select> para número', () => {
    const { componente } = montar();
    componente.setRating('3');
    expect(componente.rating()).toBe(3);
  });

  it('quote() chama QuotesService.create com o fornecedor e o produto actuais', async () => {
    const { componente, quotesService } = montar();
    quotesService.create.and.returnValue(of({} as unknown as QuoteRequestDto));
    await componente.quote();
    expect(quotesService.create).toHaveBeenCalledWith({
      supplierCompanyId: 's1',
      items: [{ productId: 'p1', quantity: 1 }],
    });
    expect(componente.msg()).toBe('Pedido de cotação enviado.');
  });

  it('submitReview() envia a nota e o comentário, depois recarrega avaliações e produto', async () => {
    const { componente, catalogService } = montar();
    const resumo: ProductReviewDto[] = [
      { id: 'r1', productId: 'p1', userId: 'u1', authorName: 'Ana', rating: 5, createdAt: '2026-01-02' },
    ];
    catalogService.createReview.and.returnValue(of({ rating: 4.5, reviewCount: 3 }));
    catalogService.reviews.and.returnValue(of(resumo));
    componente.rating.set(5);
    componente.comment.set('Excelente serviço');
    await componente.submitReview();
    expect(catalogService.createReview).toHaveBeenCalledWith('p1', { rating: 5, comment: 'Excelente serviço' });
    expect(componente.msg()).toBe('Avaliação registada.');
    expect(componente.comment()).toBe('');
    expect(componente.reviews()).toEqual(resumo);
  });

  it('voltar() delega no Location.back()', () => {
    const { componente, location } = montar();
    componente.voltar();
    expect(location.back).toHaveBeenCalled();
  });
});
