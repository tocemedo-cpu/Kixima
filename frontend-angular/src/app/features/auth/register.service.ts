// Porta de POST /api/companies/register (multipart) — usado por Register.jsx.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { RegisterCompanyBody, RegisteredCompany } from '../../core/models/company.model';

const COMPANY_FIELDS: (keyof RegisterCompanyBody)[] = [
  'type', 'name', 'taxId', 'contactEmail', 'contactPhone', 'address',
  'adminName', 'adminEmail', 'adminPassword', 'employees', 'annualRevenueUsd',
];
const POLICY_FIELDS: (keyof RegisterCompanyBody)[] = [
  'insurer', 'policyNumber', 'coverageAmount', 'policyCurrency', 'policyValidFrom', 'policyValidUntil',
];

@Injectable({ providedIn: 'root' })
export class RegisterService {
  constructor(private readonly api: ApiService) {}

  // `docs` usa as mesmas chaves que o multipart do Java espera:
  // CERTIDAO_COMERCIAL, ALVARA_COMERCIAL, LICENCA_ANPG, APOLICE_SEGURO.
  register(body: RegisterCompanyBody, docs: Record<string, File>): Observable<RegisteredCompany> {
    const fd = new FormData();
    COMPANY_FIELDS.forEach((k) => fd.append(k, body[k] ?? ''));
    fd.append('termsAccepted', 'true');
    if (body.type === 'FORNECEDOR') {
      POLICY_FIELDS.forEach((k) => fd.append(k, body[k] ?? ''));
    }
    Object.entries(docs).forEach(([type, file]) => fd.append(type, file));
    return this.api.postForm<RegisteredCompany>('/api/companies/register', fd);
  }
}
