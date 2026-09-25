// Espelha buyerService.payments() — backend/src/services/buyerService.js:69-97.
import { CompanyRef } from './purchase-order.model';

export interface BuyerPaymentRow {
  id: string;
  poId: string;
  reference: string;
  invoiceRef: string;
  supplier: CompanyRef;
  poDate: string;
  dueAt: string;
  amount: number;
  paid: number;
  open: number;
  status: string;
  currency: string;
  origin: string;
}

export interface BuyerPaymentsKpis {
  aPagar: number;
  concluidos: number;
  atrasados: number;
  totalPO: number;
}

export interface BuyerPaymentsResponse {
  kpis: BuyerPaymentsKpis;
  items: BuyerPaymentRow[];
}
