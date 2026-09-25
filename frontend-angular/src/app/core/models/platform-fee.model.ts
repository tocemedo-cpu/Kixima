// Espelha PlatformFeeDto/PlatformFeeBookDto do Java (payment/dto/) — livro
// de taxas da plataforma (Taxa KIXIMA), gerado a cada pagamento processado.
export interface PlatformFeeCompanyRef {
  name: string;
  type?: string | null;
}
export interface PlatformFeeInvoiceRef {
  reference: string;
  amount: string;
  currency: string;
}

export interface PlatformFeeDto {
  id: string;
  companyId: string;
  invoiceId: string;
  poCount: number;
  perPo: string;
  perInvoice: string;
  amount: string;
  currency: string;
  basis: string;
  poValueUsd?: string | null;
  fxRate?: string | null;
  status: 'PENDENTE' | 'COBRADO';
  chargedAt?: string | null;
  createdAt: string;
  company?: PlatformFeeCompanyRef | null;
  invoice?: PlatformFeeInvoiceRef | null;
}

export interface PlatformFeeBookKpis {
  total: number;
  totalAOA: number;
  pendingAOA: number;
  cobradas: number;
}

export interface PlatformFeeBookDto {
  fees: PlatformFeeDto[];
  kpis: PlatformFeeBookKpis;
}

// GET /api/companies/:id/platform-fees (CompanyPlatformFeeController.java) —
// extrato de uma empresa (usado por SupplierFinanceCenter em financeiro/Home.jsx).
// NOTA: apesar do sufixo "AOA" nos nomes, os valores são em USD — nome mantido
// por compatibilidade da UI (comentário explícito no Java, PlatformFeeStatementDto.java).
export interface PlatformFeeStatementKpis {
  total: number;
  totalAOA: number;
  pendingAOA: number;
  chargedAOA: number;
  pendentes: number;
  cobradas: number;
  currency: string;
}

export interface PlatformFeeStatementFormula {
  perPo: string;
  perInvoice: string;
  thresholdUsd: string;
  percentAbove: string;
  currency: string;
}

export interface PlatformFeeStatementDto {
  company: { id: string; name: string; taxId: string; plan?: string | null };
  fees: PlatformFeeDto[];
  kpis: PlatformFeeStatementKpis;
  formula: PlatformFeeStatementFormula;
  generatedAt: string;
}
