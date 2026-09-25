// Porta das chamadas de LEITURA a /api/catalog usadas por Quotes.jsx e pelas
// páginas de navegação do marketplace. A escrita (criar/editar/desactivar
// produto, upload de imagens) ainda não foi migrada — ver
// docs/migracao-angular/PLANO.md.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ProductDto } from '../../core/models/product.model';

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
}
