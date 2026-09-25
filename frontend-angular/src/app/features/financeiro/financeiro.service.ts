// Porta de financeiroRoutes.js (leitura) + o troço de pagamento de
// paymentRoutes.js usado por estes ecrãs (POST /api/payments/invoices/:id/pay).
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  FinanceiroInvoicesResponse,
  FinanceiroOverviewResponse,
  FinanceiroPaymentsResponse,
  PendingInvoiceRow,
} from '../../core/models/financeiro.model';
import { PaymentDto } from '../../core/models/purchase-order.model';

@Injectable({ providedIn: 'root' })
export class FinanceiroService {
  constructor(private readonly api: ApiService) {}

  overview(): Observable<FinanceiroOverviewResponse> {
    return this.api.get<FinanceiroOverviewResponse>('/api/financeiro/overview');
  }

  invoices(): Observable<FinanceiroInvoicesResponse> {
    return this.api.get<FinanceiroInvoicesResponse>('/api/financeiro/invoices');
  }

  payments(status?: string): Observable<FinanceiroPaymentsResponse> {
    return this.api.get<FinanceiroPaymentsResponse>('/api/financeiro/payments', status ? { status } : undefined);
  }

  // GET /api/payments/invoices/pending — compras a pagar da própria empresa
  // (lado comprador), usado pelo painel inicial do Financeiro numa empresa
  // FORNECEDORA. Requer papel FINANCEIRO ou COMPANY_ADMIN (não FORNECEDOR).
  pendingInvoicesToPay(): Observable<PendingInvoiceRow[]> {
    return this.api.get<PendingInvoiceRow[]>('/api/payments/invoices/pending');
  }

  // Comprovativo OBRIGATÓRIO (multipart, campo "proof") — espelha
  // paymentController.pay/paymentService.processPayment.
  pay(invoiceId: string, proof: File): Observable<PaymentDto> {
    return this.api.upload<PaymentDto>(`/api/payments/invoices/${invoiceId}/pay`, proof, 'proof');
  }
}
