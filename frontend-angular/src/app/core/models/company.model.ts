// Espelha a linha Company do Prisma (backend/prisma/schema.prisma:244-...) e
// o CompanyDto.java (só os campos usados pelos ecrãs já migrados — a ficha
// completa tem muitos mais escalares, acrescentados quando forem precisos).
export type CompanyType = 'CLIENTE' | 'FORNECEDOR';
export type CompanyStatus = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'SUSPENSA';
export type PolicyStatus = 'SUBMETIDA' | 'APROVADA' | 'REJEITADA' | 'EXPIRADA';

export interface CompanyListItem {
  id: string;
  name: string;
  taxId: string;
  type: CompanyType;
  status: CompanyStatus;
  contactEmail: string;
  contactPhone?: string | null;
  createdAt: string;
}

export interface SupplierPolicyDto {
  id: string;
  companyId: string;
  policyNumber: string;
  insurer: string;
  coverageAmount: string;
  currency: string;
  status: PolicyStatus;
  validFrom: string;
  validUntil: string;
  documentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDocumentDto {
  id: string;
  companyId: string;
  type: string;
  fileUrl: string;
  originalName: string;
  createdAt: string;
}

// Ficha completa devolvida por GET /api/companies/:id — só os campos usados
// pelo ecrã de Due Diligence (a ficha real do Java/Node tem muitos mais).
export interface CompanyDetail extends CompanyListItem {
  supplierPolicies?: SupplierPolicyDto[];
  clientPolicies?: unknown[];
  documents?: CompanyDocumentDto[];
}

export interface DecideCompanyBody {
  approve: boolean;
  rejectionReason?: string;
}
