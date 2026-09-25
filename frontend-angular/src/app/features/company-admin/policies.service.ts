// Porta de GET /api/policies/company/:companyId — usado por CompanyProfile.jsx.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { CompanyPoliciesDto } from '../../core/models/company-policies.model';

@Injectable({ providedIn: 'root' })
export class PoliciesService {
  constructor(private readonly api: ApiService) {}

  forCompany(companyId: string): Observable<CompanyPoliciesDto> {
    return this.api.get<CompanyPoliciesDto>(`/api/policies/company/${companyId}`);
  }
}
