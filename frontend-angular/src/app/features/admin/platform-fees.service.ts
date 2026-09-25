// Porta do troço "Livro de taxas da plataforma" de adminRoutes.js —
// GET /api/admin/platform-fees, PATCH /api/admin/platform-fees/:id/charge —
// e do extrato por empresa (CompanyPlatformFeeController.java), usado pelo
// painel do Fornecedor em financeiro/Home.jsx (SupplierFinanceCenter).
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { PlatformFeeBookDto, PlatformFeeDto, PlatformFeeStatementDto } from '../../core/models/platform-fee.model';

@Injectable({ providedIn: 'root' })
export class PlatformFeesService {
  constructor(private readonly api: ApiService) {}

  list(): Observable<PlatformFeeBookDto> {
    return this.api.get<PlatformFeeBookDto>('/api/admin/platform-fees');
  }

  charge(id: string): Observable<PlatformFeeDto> {
    return this.api.patch<PlatformFeeDto>(`/api/admin/platform-fees/${id}/charge`);
  }

  forCompany(companyId: string): Observable<PlatformFeeStatementDto> {
    return this.api.get<PlatformFeeStatementDto>(`/api/companies/${companyId}/platform-fees`);
  }
}
