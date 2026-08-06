import { ErpSystem } from '@prisma/client';
import { ErpAdapter } from './erp-adapter.interface';
import { OracleMapper } from './mappers/erp.mappers';
import {
  ErpSyncContext,
  ErpSyncResult,
  GoodsReceivedPayload,
  InvoiceIssuedPayload,
  PaymentCompletedPayload,
  PurchaseOrderApprovedPayload,
} from '@app/common/types/erp.types';

/**
 * Oracle ERP Cloud — REST (Financials Cloud). Config de UM tenant:
 *   { baseUrl, username, password }
 */
export class OracleAdapter extends ErpAdapter {
  readonly system = ErpSystem.ORACLE_ERP_CLOUD;

  constructor(config: Record<string, string>) {
    super(config.baseUrl ?? '', {
      auth: config.username ? { username: config.username, password: config.password ?? '' } : undefined,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
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
    return this.post('purchaseOrders', OracleMapper.purchaseOrder(payload as PurchaseOrderApprovedPayload), 'PURCHASE_ORDER');
  }

  pushInvoice(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.post('invoices', OracleMapper.invoice(payload as InvoiceIssuedPayload), 'INVOICE');
  }

  pushGoodsReceipt(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.post('receivingReceiptRequests', OracleMapper.receivingReceipt(payload as GoodsReceivedPayload), 'GOODS_RECEIPT');
  }

  pushPayment(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.post('payablesPayments', OracleMapper.payment(payload as PaymentCompletedPayload), 'PAYMENT');
  }
}
