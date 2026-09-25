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
