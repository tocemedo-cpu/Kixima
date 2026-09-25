// Espelha as formas devolvidas por financeiroService.js (shapeInvoice) e
// PaymentDto do domínio payment — usadas pelos ecrãs de leitura do
// Financeiro (Centro Financeiro, Faturas Pendentes, Pagamentos).
export interface FinanceiroInvoiceRow {
  id: string;
  reference: string;
  supplier: string;
  poReference?: string | null;
  poId?: string | null;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string;
  dueAt: string;
  paidAt?: string | null;
}

export interface FinanceiroInvoicesKpis {
  pendentes: number;
  valorPendente: number;
  aVencer7: number;
  vencidas: number;
  aprovadasMes: number;
}
export interface FinanceiroInvoicesResponse {
  kpis: FinanceiroInvoicesKpis;
  items: FinanceiroInvoiceRow[];
}

export interface FinanceiroPaymentsKpis {
  aPagar: number;
  pagosMes: number;
  vencidos: number;
  total: number;
}
export interface FinanceiroPaymentsResponse {
  kpis: FinanceiroPaymentsKpis;
  items: FinanceiroInvoiceRow[];
}
