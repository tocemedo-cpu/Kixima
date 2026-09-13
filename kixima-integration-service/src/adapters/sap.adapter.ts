import { ErpSystem } from '@prisma/client';
import { ErpAdapter } from './erp-adapter.interface';
import { SapMapper, SapOrgConfig } from './mappers/erp.mappers';
import {
  ErpSyncContext,
  ErpSyncResult,
  GoodsReceivedPayload,
  InvoiceIssuedPayload,
  PaymentCompletedPayload,
  PurchaseOrderApprovalRequestedPayload,
  PurchaseOrderApprovedPayload,
} from '@app/common/types/erp.types';

/**
 * SAP S/4HANA — OData V2/V4. Instanciado com a configuração de UM tenant:
 *   { baseUrl, username, password, client, companyCode?, purchasingOrganization? }
 * `companyCode`/`purchasingOrganization` são opcionais (caem para o '1000'
 * de omissão do SAP de demonstração se o tenant não os definir) — mas sem
 * este campo por tenant, um cliente real com outro código de empresa via as
 * suas POs/faturas submetidas ao código ERRADO. Ver SapMapper.
 */
export class SapAdapter extends ErpAdapter {
  readonly system = ErpSystem.SAP_S4HANA;
  private readonly org: SapOrgConfig;

  constructor(config: Record<string, string>) {
    super(config.baseUrl ?? '', {
      auth: config.username ? { username: config.username, password: config.password ?? '' } : undefined,
      headers: { Accept: 'application/json', 'sap-client': config.client ?? '' },
    });
    this.org = { companyCode: config.companyCode, purchasingOrganization: config.purchasingOrganization };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.http.get('/');
      return true;
    } catch {
      return false;
    }
  }

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
      const res = await this.http.post('/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder', SapMapper.purchaseOrder(payload as PurchaseOrderApprovedPayload, this.org), {
        headers: { 'x-csrf-token': csrf.token, Cookie: csrf.cookie, 'Content-Type': 'application/json' },
      });
      const externalId =
        (res.data?.d?.PurchaseOrder as string | undefined) ?? (res.data?.PurchaseOrder as string | undefined) ?? null;
      return { erp: this.system, entityType: 'PURCHASE_ORDER', externalId, raw: res.data, durationMs: Date.now() - started };
    } catch (err) {
      throw this.toAdapterError(err, 'pushPurchaseOrder');
    }
  }

  async requestApproval(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    const started = Date.now();
    try {
      const csrf = await this.fetchCsrf('/API_PURCHASEORDER_PROCESS_SRV');
      const res = await this.http.post(
        '/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder',
        SapMapper.approvalRequest(payload as PurchaseOrderApprovalRequestedPayload, this.org),
        { headers: { 'x-csrf-token': csrf.token, Cookie: csrf.cookie, 'Content-Type': 'application/json' } },
      );
      const externalId =
        (res.data?.d?.PurchaseOrder as string | undefined) ?? (res.data?.PurchaseOrder as string | undefined) ?? null;
      return { erp: this.system, entityType: 'PURCHASE_ORDER', externalId, raw: res.data, durationMs: Date.now() - started };
    } catch (err) {
      throw this.toAdapterError(err, 'requestApproval');
    }
  }

  async pushInvoice(payload: unknown, _ctx: ErpSyncContext): Promise<ErpSyncResult> {
    const started = Date.now();
    try {
      const csrf = await this.fetchCsrf('/API_SUPPLIERINVOICE_PROCESS_SRV');
      const res = await this.http.post('/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice', SapMapper.supplierInvoice(payload as InvoiceIssuedPayload, this.org), {
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
      const res = await this.http.post('/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentHeader', SapMapper.materialDocument(payload as GoodsReceivedPayload), {
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
      const res = await this.http.post('/API_PAYMENTREQUEST_SRV/PaymentRequest', SapMapper.paymentRequest(payload as PaymentCompletedPayload), {
        headers: { 'Content-Type': 'application/json' },
      });
      const externalId = (res.data?.d?.PaymentRequest as string | undefined) ?? null;
      return { erp: this.system, entityType: 'PAYMENT', externalId, raw: res.data, durationMs: Date.now() - started };
    } catch (err) {
      throw this.toAdapterError(err, 'pushPayment');
    }
  }
}
