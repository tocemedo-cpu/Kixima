// Espelha o modelo Contract do Prisma (backend/prisma/schema.prisma:1536-1568)
// e a forma devolvida por contractService.listContractsForCompany/listAllContracts
// (include: clientCompany/supplierCompany só com {id,name}).
import { CompanyRef } from './purchase-order.model';

export type ContractStatus = 'ATIVO' | 'EXPIRADO' | 'ENCERRADO';
export type BillingPeriodicity = 'TRIMESTRAL' | 'SEMESTRAL';

// Corpo de POST /api/contracts (ContractController.java/CreateContractRequest.java,
// confirmado por um agente de pesquisa dedicado). Duas particularidades reais:
// validFrom/validUntil TÊM de ser um instante ISO-8601 completo
// (ex. "2026-01-01T00:00:00.000Z"), não uma data "YYYY-MM-DD" — o
// desserializador de Instant do Jackson rejeita esse formato (422); e o
// servidor NÃO valida o tipo/estado das empresas nem validUntil>=validFrom —
// isso fica por conta de quem chama (não replicado aqui, é um contrato real).
export interface CreateContractBody {
  clientCompanyId: string;
  supplierCompanyId: string;
  categoriesCovered: string[];
  totalValue: number;
  currency?: string;
  billingPeriodicity: BillingPeriodicity;
  paymentTermDays: number;
  validFrom: string;
  validUntil: string;
}

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
