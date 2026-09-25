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

// GET /api/financeiro/overview (FinanceiroController.java, lado CLIENTE de
// Home.jsx) — usado pelo painel inicial do Financeiro.
export interface FinanceiroOverviewKpis {
  pagamentosPendentes: number;
  pagamentosPendentesCount: number;
  faturasRecebidas: number;
  pagosMes: number;
  aprovacoesPendentes: number;
  aVencer7: number;
}
export interface FinanceiroOverviewSeriesPoint {
  label: string;
  faturas: number;
  pagamentos: number;
}
export interface FinanceiroOverviewResponse {
  kpis: FinanceiroOverviewKpis;
  series: FinanceiroOverviewSeriesPoint[];
  pendentes: FinanceiroInvoiceRow[];
}

// GET /api/payments/invoices/pending (PaymentController.java) — usado pelo
// painel inicial do Financeiro numa empresa FORNECEDORA (compras a pagar).
// Resposta real é o InvoiceDto completo; só os campos usados nesta página
// estão aqui modelados.
export interface PendingInvoiceRow {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  dueAt: string;
}
