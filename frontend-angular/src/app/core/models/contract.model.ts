// Espelha o modelo Contract do Prisma (backend/prisma/schema.prisma:1536-1568)
// e a forma devolvida por contractService.listContractsForCompany/listAllContracts
// (include: clientCompany/supplierCompany só com {id,name}).
import { CompanyRef } from './purchase-order.model';

export type ContractStatus = 'ATIVO' | 'EXPIRADO' | 'ENCERRADO';
export type BillingPeriodicity = 'TRIMESTRAL' | 'SEMESTRAL';

export interface ContractDto {
  id: string;
  reference: string;
  clientCompanyId: string;
  clientCompany: CompanyRef;
  supplierCompanyId: string;
  supplierCompany: CompanyRef;
  categoriesCovered: string[];
  totalValue: string;
  currency: string;
  usedValue: string;
  billingPeriodicity: BillingPeriodicity;
  paymentTermDays: number;
  status: ContractStatus;
  validFrom: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
}
