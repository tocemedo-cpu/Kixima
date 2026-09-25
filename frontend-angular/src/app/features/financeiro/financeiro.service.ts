// Porta de financeiroRoutes.js (leitura) + o troço de pagamento de
// paymentRoutes.js usado por estes ecrãs (POST /api/payments/invoices/:id/pay).
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { FinanceiroInvoicesResponse, FinanceiroPaymentsResponse } from '../../core/models/financeiro.model';
import { PaymentDto } from '../../core/models/purchase-order.model';

@Injectable({ providedIn: 'root' })
export class FinanceiroService {
  constructor(private readonly api: ApiService) {}

  overview(): Observable<Record<string, unknown>> {
    return this.api.get('/api/financeiro/overview');
  }

  invoices(): Observable<FinanceiroInvoicesResponse> {
    return this.api.get<FinanceiroInvoicesResponse>('/api/financeiro/invoices');
  }

  payments(status?: string): Observable<FinanceiroPaymentsResponse> {
    return this.api.get<FinanceiroPaymentsResponse>('/api/financeiro/payments', status ? { status } : undefined);
  }

  // Comprovativo OBRIGATÓRIO (multipart, campo "proof") — espelha
  // paymentController.pay/paymentService.processPayment.
  pay(invoiceId: string, proof: File): Observable<PaymentDto> {
    return this.api.upload<PaymentDto>(`/api/payments/invoices/${invoiceId}/pay`, proof, 'proof');
  }
}
