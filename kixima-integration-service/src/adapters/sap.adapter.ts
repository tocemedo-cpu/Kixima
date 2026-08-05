import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErpSystem } from '@prisma/client';
import { ErpAdapter } from './erp-adapter.interface';
import { ErpSyncContext, ErpSyncResult } from '@app/common/types/erp.types';

/**
 * SAP S/4HANA — integração via OData V2/V4.
 * Autenticação básica + fetch de CSRF token para operações de escrita.
 */
@Injectable()
export class SapAdapter extends ErpAdapter {
  readonly system = ErpSystem.SAP_S4HANA;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    const baseURL = config.get<string>('SAP_BASE_URL') ?? '';
    const username = config.get<string>('SAP_USERNAME') ?? '';
    const password = config.get<string>('SAP_PASSWORD') ?? '';
    const client = config.get<string>('SAP_CLIENT') ?? '';
    super(baseURL, {
      auth: username ? { username, password } : undefined,
      headers: { Accept: 'application/json', 'sap-client': client },
    });
    this.enabled = (config.get<string>('SAP_ENABLED') ?? 'false') === 'true';
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

  /** Obtém o token CSRF exigido pelo SAP para POST/PUT. */
  private async fetchCsrf(path: string): Promise<{ token: string; cookie: string }> {
    const res = await this.http.get(path, { headers: { 'x-csrf-token': 'Fetch' } });
    return {
      token: String(res.headers['x-csrf-token'] ?? ''),
      cookie: ([] as string[]).concat(res.headers['set-cookie'] ?? []).join('; '),
    };
  }

  async pushPurchaseOrder(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    const started = Date.now();
    try {
      const csrf = await this.fetchCsrf('/API_PURCHASEORDER_PROCESS_SRV');
      const res = await this.http.post('/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder', payload, {
        headers: { 'x-csrf-token': csrf.token, Cookie: csrf.cookie, 'Content-Type': 'application/json' },
      });
      const externalId =
        (res.data?.d?.PurchaseOrder as string | undefined) ?? (res.data?.PurchaseOrder as string | undefined) ?? null;
      return { erp: this.system, entityType: 'PURCHASE_ORDER', externalId, raw: res.data, durationMs: Date.now() - started };
    } catch (err) {
      throw this.toAdapterError(err, 'pushPurchaseOrder');
    }
  }

  async pushInvoice(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    const started = Date.now();
    try {
      const csrf = await this.fetchCsrf('/API_SUPPLIERINVOICE_PROCESS_SRV');
      const res = await this.http.post('/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice', payload, {
        headers: { 'x-csrf-token': csrf.token, Cookie: csrf.cookie, 'Content-Type': 'application/json' },
      });
      const externalId = (res.data?.d?.SupplierInvoice as string | undefined) ?? null;
      return { erp: this.system, entityType: 'INVOICE', externalId, raw: res.data, durationMs: Date.now() - started };
    } catch (err) {
      throw this.toAdapterError(err, 'pushInvoice');
    }
  }

  async pushGoodsReceipt(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    const started = Date.now();
    try {
      const csrf = await this.fetchCsrf('/API_MATERIAL_DOCUMENT_SRV');
      const res = await this.http.post('/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentHeader', payload, {
        headers: { 'x-csrf-token': csrf.token, Cookie: csrf.cookie, 'Content-Type': 'application/json' },
      });
      const externalId = (res.data?.d?.MaterialDocument as string | undefined) ?? null;
      return { erp: this.system, entityType: 'GOODS_RECEIPT', externalId, raw: res.data, durationMs: Date.now() - started };
    } catch (err) {
      throw this.toAdapterError(err, 'pushGoodsReceipt');
    }
  }

  async pushPayment(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    const started = Date.now();
    try {
      const res = await this.http.post('/API_PAYMENTREQUEST_SRV/PaymentRequest', payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      const externalId = (res.data?.d?.PaymentRequest as string | undefined) ?? null;
      return { erp: this.system, entityType: 'PAYMENT', externalId, raw: res.data, durationMs: Date.now() - started };
    } catch (err) {
      throw this.toAdapterError(err, 'pushPayment');
    }
  }
}
