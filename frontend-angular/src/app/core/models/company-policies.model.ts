// Espelha CompanyPoliciesDto (Java) — as duas apólices lado a lado, usadas
// por CompanyProfile.jsx (KIXIMA→Cliente) e DueDiligence (Fornecedor→KIXIMA).
import { SupplierPolicyDto } from './company.model';

export interface ClientPolicyDto {
  id: string;
  companyId: string;
  policyNumber: string;
  insurer: string;
  coverageAmount: string;
  currency: string;
  status: 'SUBMETIDA' | 'APROVADA' | 'REJEITADA' | 'EXPIRADA';
  issuedById?: string | null;
  validFrom: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyPoliciesDto {
  supplierToKixima: SupplierPolicyDto[];
  kiximaToClient: ClientPolicyDto[];
}
