// Porta de GET /api/buyer/suppliers — diretório de fornecedores do Comprador
// (Suppliers.jsx).
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { BuyerSuppliersResponse } from '../../core/models/marketplace-extra.model';

@Injectable({ providedIn: 'root' })
export class BuyerSuppliersService {
  constructor(private readonly api: ApiService) {}

  list(status?: string, q?: string): Observable<BuyerSuppliersResponse> {
    return this.api.get<BuyerSuppliersResponse>('/api/buyer/suppliers', { status: status || undefined, q: q || undefined });
  }
}
