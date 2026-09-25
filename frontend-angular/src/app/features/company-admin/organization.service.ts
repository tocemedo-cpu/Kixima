// Porta de GET /api/company-admin/organizacao e GET/PUT
// /api/companies/:id/bank-details — usados por Organization.jsx.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { OrganizacaoResponse } from '../../core/models/organizacao.model';
import { BankDetails } from '../../core/models/bank-details.model';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  constructor(private readonly api: ApiService) {}

  organizacao(): Observable<OrganizacaoResponse> {
    return this.api.get<OrganizacaoResponse>('/api/company-admin/organizacao');
  }

  getBankDetails(companyId: string): Observable<BankDetails> {
    return this.api.get<BankDetails>(`/api/companies/${companyId}/bank-details`);
  }

  setBankDetails(companyId: string, body: BankDetails): Observable<BankDetails> {
    return this.api.put<BankDetails>(`/api/companies/${companyId}/bank-details`, body);
  }
}
