// Porta das chamadas a /api/catalog — leitura (usada por Quotes.jsx e pelas
// páginas de navegação do marketplace) e escrita (CatalogManage.jsx: criar,
// editar, media, desactivar). Contratos confirmados contra
// backend-java/.../catalog/CatalogController.java.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ProductDto, RemocaoAck } from '../../core/models/product.model';
import {
  CreateStockMovementBody,
  StockMovementDto,
  StockMovementsPage,
  StockMovementType,
  UpdateStockBody,
} from '../../core/models/stock-movement.model';

export interface CatalogFiltro {
  [key: string]: string | undefined;
  category?: string;
  search?: string;
  supplierId?: string;
  kind?: 'PRODUTO' | 'SERVICO';
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  constructor(private readonly api: ApiService) {}

  list(filtro?: CatalogFiltro): Observable<ProductDto[]> {
    return this.api.get<ProductDto[]>('/api/catalog', filtro);
  }

  get(id: string): Observable<ProductDto> {
    return this.api.get<ProductDto>(`/api/catalog/${id}`);
  }

  getBySlug(slug: string): Observable<ProductDto> {
    return this.api.get<ProductDto>(`/api/catalog/slug/${slug}`);
  }

  // POST /api/catalog — multipart (mainImage, gallery, docs por tipo, + campos de texto/número).
  create(formData: FormData): Observable<ProductDto> {
    return this.api.postForm<ProductDto>('/api/catalog', formData);
  }

  // PUT /api/catalog/:id — JSON, nunca multipart (CatalogController.java:176-185).
  update(id: string, body: Record<string, string>): Observable<ProductDto> {
    return this.api.put<ProductDto>(`/api/catalog/${id}`, body);
  }

  // POST /api/catalog/:id/media — multipart, sem mainImage (gallery + docs por tipo).
  addMedia(id: string, formData: FormData): Observable<ProductDto> {
    return this.api.postForm<ProductDto>(`/api/catalog/${id}/media`, formData);
  }

  // POST /api/catalog/:id/image — ficheiro único, campo "image" (não "mainImage").
  uploadImage(id: string, file: File): Observable<ProductDto> {
    return this.api.upload<ProductDto>(`/api/catalog/${id}/image`, file, 'image');
  }

  removeImage(id: string, imageId: string): Observable<RemocaoAck> {
    return this.api.del<RemocaoAck>(`/api/catalog/${id}/images/${imageId}`);
  }

  removeDocument(id: string, docId: string): Observable<RemocaoAck> {
    return this.api.del<RemocaoAck>(`/api/catalog/${id}/documents/${docId}`);
  }

  // DELETE /api/catalog/:id — desactivação (soft delete: active=false).
  deactivate(id: string): Observable<ProductDto> {
    return this.api.del<ProductDto>(`/api/catalog/${id}`);
  }

  // PATCH /api/catalog/:id/stock — actualização parcial de stock/armazém/disponibilidade.
  updateStock(id: string, body: UpdateStockBody): Observable<ProductDto> {
    return this.api.patch<ProductDto>(`/api/catalog/${id}/stock`, body);
  }

  // GET /api/catalog/movements — registados antes de /:id no Java para não
  // colidir com esse caminho (CatalogController.java).
  movements(type: StockMovementType, limit: number): Observable<StockMovementsPage> {
    return this.api.get<StockMovementsPage>('/api/catalog/movements', { type, limit });
  }

  createMovement(body: CreateStockMovementBody): Observable<StockMovementDto> {
    return this.api.post<StockMovementDto>('/api/catalog/movements', body);
  }
}
