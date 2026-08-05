import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErpSystem } from '@prisma/client';
import { ErpAdapter } from './erp-adapter.interface';
import { PrimaveraMapper } from './mappers/erp.mappers';
import {
  ErpSyncContext,
  ErpSyncResult,
  GoodsReceivedPayload,
  InvoiceIssuedPayload,
  PaymentCompletedPayload,
  PurchaseOrderApprovedPayload,
} from '@app/common/types/erp.types';

/**
 * Primavera ERP — integração via REST (API key + empresa).
 */
@Injectable()
export class PrimaveraAdapter extends ErpAdapter {
  readonly system = ErpSystem.PRIMAVERA;
  private readonly enabled: boolean;
  private readonly company: string;

  constructor(config: ConfigService) {
    const baseURL = config.get<string>('PRIMAVERA_BASE_URL') ?? '';
    const apiKey = config.get<string>('PRIMAVERA_API_KEY') ?? '';
    super(baseURL, {
      headers: { Accept: 'application/json', Authorization: apiKey ? `Bearer ${apiKey}` : '' },
    });
    this.company = config.get<string>('PRIMAVERA_COMPANY') ?? '';
    this.enabled = (config.get<string>('PRIMAVERA_ENABLED') ?? 'false') === 'true';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.http.get('/health');
      return true;
    } catch {
      return false;
    }
  }

  private async post(resource: string, payload: unknown, entityType: ErpSyncResult['entityType']): Promise<ErpSyncResult> {
    const started = Date.now();
    try {
      const res = await this.http.post(`/${this.company}/${resource}`, payload);
      const externalId = (res.data?.id as string | undefined) ?? (res.data?.documentId as string | undefined) ?? null;
      return { erp: this.system, entityType, externalId, raw: res.data, durationMs: Date.now() - started };
    } catch (err) {
      throw this.toAdapterError(err, `post ${resource}`);
    }
  }

  pushPurchaseOrder(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.post('purchaseOrders', PrimaveraMapper.purchaseOrder(payload as PurchaseOrderApprovedPayload), 'PURCHASE_ORDER');
  }

  pushInvoice(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.post('supplierInvoices', PrimaveraMapper.invoice(payload as InvoiceIssuedPayload), 'INVOICE');
  }

  pushGoodsReceipt(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.post('goodsReceipts', PrimaveraMapper.goodsReceipt(payload as GoodsReceivedPayload), 'GOODS_RECEIPT');
  }

  pushPayment(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.post('payments', PrimaveraMapper.payment(payload as PaymentCompletedPayload), 'PAYMENT');
  }
}
