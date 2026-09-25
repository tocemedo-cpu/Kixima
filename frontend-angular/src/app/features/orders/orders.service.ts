// Porta das chamadas a /api/purchase-orders, /api/buyer/orders e das duas
// acções de fatura usadas em OrderDetail.jsx (/api/payments/invoices/:id/…)
// — ver poRoutes.js, poService.js, buyerService.js e paymentRoutes.js.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  AuditLogEntry,
  BuyerOrdersResult,
  CreatePoBody,
  PurchaseOrderDto,
  ReceptionBody,
  RefusePoBody,
  RejectPoBody,
  ResolveDivergenceBody,
} from '../../core/models/purchase-order.model';

export interface BuyerOrdersParams {
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  constructor(private readonly api: ApiService) {}

  // GET /api/buyer/orders — lista com KPIs, usada por Orders.jsx (comprador).
  buyerOrders(params: BuyerOrdersParams): Observable<BuyerOrdersResult> {
    return this.api.get<BuyerOrdersResult>('/api/buyer/orders', params as Record<string, string | number | undefined>);
  }

  // POST /api/purchase-orders — uma PO por fornecedor, chamada em ciclo pelo Checkout.
  create(body: CreatePoBody): Observable<PurchaseOrderDto> {
    return this.api.post<PurchaseOrderDto>('/api/purchase-orders', body);
  }

  get(id: string): Observable<PurchaseOrderDto> {
    return this.api.get<PurchaseOrderDto>(`/api/purchase-orders/${id}`);
  }

  history(id: string): Observable<AuditLogEntry[]> {
    return this.api.get<AuditLogEntry[]>(`/api/purchase-orders/${id}/history`);
  }

  approve(id: string): Observable<PurchaseOrderDto> {
    return this.api.patch<PurchaseOrderDto>(`/api/purchase-orders/${id}/approve`);
  }

  reject(id: string, body: RejectPoBody): Observable<PurchaseOrderDto> {
    return this.api.patch<PurchaseOrderDto>(`/api/purchase-orders/${id}/reject`, body);
  }

  accept(id: string): Observable<PurchaseOrderDto> {
    return this.api.patch<PurchaseOrderDto>(`/api/purchase-orders/${id}/accept`);
  }

  refuse(id: string, body: RefusePoBody): Observable<PurchaseOrderDto> {
    return this.api.patch<PurchaseOrderDto>(`/api/purchase-orders/${id}/refuse`, body);
  }

  dispatch(id: string): Observable<PurchaseOrderDto> {
    return this.api.patch<PurchaseOrderDto>(`/api/purchase-orders/${id}/dispatch`);
  }

  markDelivered(id: string): Observable<PurchaseOrderDto> {
    return this.api.patch<PurchaseOrderDto>(`/api/purchase-orders/${id}/delivered`);
  }

  confirmReception(id: string, body: ReceptionBody): Observable<PurchaseOrderDto> {
    return this.api.patch<PurchaseOrderDto>(`/api/purchase-orders/${id}/reception`, body);
  }

  resolveDivergence(id: string, body: ResolveDivergenceBody): Observable<PurchaseOrderDto> {
    return this.api.patch<PurchaseOrderDto>(`/api/purchase-orders/${id}/resolve-divergence`, body);
  }

  // Notas de crédito e anulação de fatura — só usadas em OrderDetail (fornecedor/admin sistema).
  emitirNotaCredito(invoiceId: string, motivo: string, amount: number): Observable<unknown> {
    return this.api.post(`/api/payments/invoices/${invoiceId}/notas-credito`, { motivo, amount });
  }

  anularFatura(invoiceId: string, motivo?: string): Observable<unknown> {
    return this.api.post(`/api/payments/invoices/${invoiceId}/anular`, { motivo });
  }
}
