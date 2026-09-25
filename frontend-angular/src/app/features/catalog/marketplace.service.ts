// Porta das chamadas a /api/marketplace usadas por Catalog.jsx (search +
// facets) — ver backend/src/services/marketplaceService.js.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  MarketplaceFacets,
  MarketplaceSearchParams,
  MarketplaceSearchResult,
  VerifiedSupplierCard,
} from '../../core/models/product.model';

@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  constructor(private readonly api: ApiService) {}

  search(params: MarketplaceSearchParams): Observable<MarketplaceSearchResult> {
    return this.api.get<MarketplaceSearchResult>('/api/marketplace/search', params as Record<string, string | number | undefined>);
  }

  facets(params: Omit<MarketplaceSearchParams, 'sort' | 'page' | 'limit'>): Observable<MarketplaceFacets> {
    return this.api.get<MarketplaceFacets>('/api/marketplace/facets', params as Record<string, string | number | undefined>);
  }

  // GET /api/marketplace/suppliers — os primeiros 8 fornecedores verificados
  // (MarketplaceController.java), usado pela Home do Comprador.
  suppliers(): Observable<VerifiedSupplierCard[]> {
    return this.api.get<VerifiedSupplierCard[]>('/api/marketplace/suppliers');
  }
}
