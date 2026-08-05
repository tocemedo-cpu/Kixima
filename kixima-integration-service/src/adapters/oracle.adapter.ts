import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErpSystem } from '@prisma/client';
import { ErpAdapter } from './erp-adapter.interface';
import { ErpSyncContext, ErpSyncResult } from '@app/common/types/erp.types';

/**
 * Oracle ERP Cloud — integração via REST (Financials Cloud, Basic Auth).
 */
@Injectable()
export class OracleAdapter extends ErpAdapter {
  readonly system = ErpSystem.ORACLE_ERP_CLOUD;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    const baseURL = config.get<string>('ORACLE_BASE_URL') ?? '';
    const username = config.get<string>('ORACLE_USERNAME') ?? '';
    const password = config.get<string>('ORACLE_PASSWORD') ?? '';
    super(baseURL, {
      auth: username ? { username, password } : undefined,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
    this.enabled = (config.get<string>('ORACLE_ENABLED') ?? 'false') === 'true';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.http.get('/');
      return true;
    } catch {
      return false;
    }
  }

  private async post(resource: string, payload: unknown, entityType: ErpSyncResult['entityType']): Promise<ErpSyncResult> {
    const started = Date.now();
    try {
      const res = await this.http.post(`/${resource}`, payload);
      const externalId =
        (res.data?.PurchaseOrderId as string | undefined) ??
        (res.data?.InvoiceId as string | undefined) ??
        (res.data?.id as string | undefined) ??
        null;
      return { erp: this.system, entityType, externalId, raw: res.data, durationMs: Date.now() - started };
    } catch (err) {
      throw this.toAdapterError(err, `post ${resource}`);
    }
  }

  pushPurchaseOrder(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.post('purchaseOrders', payload, 'PURCHASE_ORDER');
  }

  pushInvoice(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.post('invoices', payload, 'INVOICE');
  }

  pushGoodsReceipt(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.post('receivingReceiptRequests', payload, 'GOODS_RECEIPT');
  }

  pushPayment(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.post('payablesPayments', payload, 'PAYMENT');
  }
}
