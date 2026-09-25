// Porta de frontend/src/pages/comprador/ServiceDetail.jsx (rota
// /comprador/servicos/:slug). Dados reais do produto, avaliações reais
// (GET/POST /api/catalog/:id/reviews) e solicitar cotação.
import { Component, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { CatalogService } from './catalog.service';
import { QuotesService } from '../quotes/quotes.service';
import { ProductDto } from '../../core/models/product.model';
import { ProductReviewDto } from '../../core/models/marketplace-extra.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatMoney, formatDate, joinNonEmpty } from '../../shared/domain';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';
import { SuccessBannerComponent } from '../../shared/components/success-banner.component';
import { FieldComponent } from '../../shared/components/field.component';
import { StarsComponent } from '../../shared/components/stars.component';
import { ProductCoverComponent } from '../../shared/components/product-cover.component';

@Component({
  selector: 'app-service-detail',
  standalone: true,
  imports: [LoadingComponent, ErrorBannerComponent, SuccessBannerComponent, FieldComponent, StarsComponent, ProductCoverComponent],
  templateUrl: './service-detail.component.html',
})
export class ServiceDetailComponent {
  private readonly slug: string;

  readonly p = signal<ProductDto | null>(null);
  readonly reviews = signal<ProductReviewDto[]>([]);
  readonly error = signal('');
  readonly msg = signal('');
  readonly rating = signal(5);
  readonly comment = signal('');

  readonly formatMoney = formatMoney;
  readonly formatDate = formatDate;
  readonly joinNonEmpty = joinNonEmpty;
  readonly ratingOptions = [5, 4, 3, 2, 1];

  constructor(
    route: ActivatedRoute,
    private readonly catalogService: CatalogService,
    private readonly quotesService: QuotesService,
    private readonly location: Location,
  ) {
    this.slug = route.snapshot.paramMap.get('slug') || '';
    this.catalogService.getBySlug(this.slug).subscribe({
      next: (produto) => {
        this.p.set(produto);
        this.loadReviews(produto.id);
      },
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  private loadReviews(id: string): void {
    this.catalogService.reviews(id).subscribe({ next: (r) => this.reviews.set(r), error: () => {} });
  }

  voltar(): void {
    this.location.back();
  }

  setRating(valor: string): void {
    this.rating.set(Number(valor));
  }

  async quote(): Promise<void> {
    const produto = this.p();
    if (!produto) return;
    try {
      await new Promise<void>((resolve, reject) => {
        this.quotesService
          .create({ supplierCompanyId: produto.supplier?.id || '', items: [{ productId: produto.id, quantity: 1 }] })
          .subscribe({ next: () => resolve(), error: reject });
      });
      this.msg.set('Pedido de cotação enviado.');
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
    }
  }

  async submitReview(): Promise<void> {
    const produto = this.p();
    if (!produto) return;
    try {
      await new Promise<void>((resolve, reject) => {
        this.catalogService
          .createReview(produto.id, { rating: Number(this.rating()), comment: this.comment() || undefined })
          .subscribe({ next: () => resolve(), error: reject });
      });
      this.msg.set('Avaliação registada.');
      this.comment.set('');
      this.loadReviews(produto.id);
      this.catalogService.getBySlug(this.slug).subscribe({ next: (fresh) => this.p.set(fresh) });
    } catch (e) {
      this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.');
    }
  }
}
