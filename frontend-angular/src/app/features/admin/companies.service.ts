// Porta do troço de leitura/decisão de companyRoutes.js usado por
// DueDiligence.jsx — GET /api/companies?status=, GET /api/companies/:id,
// PATCH /api/companies/:id/decision.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { CompanyDetail, CompanyListItem, DecideCompanyBody } from '../../core/models/company.model';

@Injectable({ providedIn: 'root' })
export class CompaniesService {
  constructor(private readonly api: ApiService) {}

  list(status?: string): Observable<CompanyListItem[]> {
    return this.api.get<CompanyListItem[]>('/api/companies', status ? { status } : undefined);
  }

  get(id: string): Observable<CompanyDetail> {
    return this.api.get<CompanyDetail>(`/api/companies/${id}`);
  }

  decide(id: string, body: DecideCompanyBody): Observable<CompanyDetail> {
    return this.api.patch<CompanyDetail>(`/api/companies/${id}/decision`, body);
  }
}
