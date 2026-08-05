import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { ErpSystem } from '@prisma/client';
import { ErpAdapter } from './erp-adapter.interface';
import { AribaMapper } from './mappers/erp.mappers';
import {
  ErpSyncContext,
  ErpSyncResult,
  GoodsReceivedPayload,
  InvoiceIssuedPayload,
  PaymentCompletedPayload,
  PurchaseOrderApprovedPayload,
} from '@app/common/types/erp.types';

/**
 * SAP Ariba — integração via cXML (documentos XML sobre HTTP POST).
 * Constrói o envelope cXML com credenciais partilhadas (SharedSecret).
 */
@Injectable()
export class AribaAdapter extends ErpAdapter {
  readonly system = ErpSystem.SAP_ARIBA;
  private readonly enabled: boolean;
  private readonly sharedSecret: string;
  private readonly networkId: string;
  private readonly builder = new XMLBuilder({ ignoreAttributes: false, format: true });
  private readonly parser = new XMLParser({ ignoreAttributes: false });

  constructor(config: ConfigService) {
    const baseURL = config.get<string>('ARIBA_BASE_URL') ?? '';
    super(baseURL, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } });
    this.sharedSecret = config.get<string>('ARIBA_SHARED_SECRET') ?? '';
    this.networkId = config.get<string>('ARIBA_NETWORK_ID') ?? '';
    this.enabled = (config.get<string>('ARIBA_ENABLED') ?? 'false') === 'true';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async healthCheck(): Promise<boolean> {
    return this.enabled && this.baseURLConfigured();
  }

  private baseURLConfigured(): boolean {
    return Boolean(this.http.defaults.baseURL);
  }

  /** Constrói um documento cXML com cabeçalho (Header) autenticado. */
  private buildCxml(payloadId: string, request: Record<string, unknown>): string {
    const doc = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      cXML: {
        '@_payloadID': payloadId,
        '@_timestamp': new Date(0).toISOString(), // timestamp injetado a montante (determinístico)
        Header: {
          Sender: {
            Credential: { '@_domain': 'NetworkID', Identity: this.networkId, SharedSecret: this.sharedSecret },
            UserAgent: 'KIXIMA-Integration/1.0',
          },
        },
        Request: request,
      },
    };
    return this.builder.build(doc);
  }

  private async send(payloadId: string, request: Record<string, unknown>, entityType: ErpSyncResult['entityType']): Promise<ErpSyncResult> {
    const started = Date.now();
    try {
      const body = this.buildCxml(payloadId, request);
      const res = await this.http.post('', body);
      const parsed = this.parser.parse(String(res.data));
      const status = parsed?.cXML?.Response?.Status?.['@_code'];
      if (status && Number(status) >= 400) {
        throw this.toAdapterError(
          Object.assign(new Error(`cXML status ${status}`), { response: { status: Number(status) } }),
          'cXML',
        );
      }
      const externalId = String(parsed?.cXML?.Response?.PurchaseOrderID ?? payloadId);
      return { erp: this.system, entityType, externalId, raw: parsed, durationMs: Date.now() - started };
    } catch (err) {
      throw this.toAdapterError(err, `cXML ${entityType}`);
    }
  }

  pushPurchaseOrder(payload: unknown, ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.send(ctx.eventId, { OrderRequest: AribaMapper.orderRequest(payload as PurchaseOrderApprovedPayload) }, 'PURCHASE_ORDER');
  }

  pushInvoice(payload: unknown, ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.send(ctx.eventId, { InvoiceDetailRequest: AribaMapper.invoiceDetailRequest(payload as InvoiceIssuedPayload) }, 'INVOICE');
  }

  pushGoodsReceipt(payload: unknown, ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.send(ctx.eventId, { ReceiptRequest: AribaMapper.receiptRequest(payload as GoodsReceivedPayload) }, 'GOODS_RECEIPT');
  }

  pushPayment(payload: unknown, ctx: ErpSyncContext): Promise<ErpSyncResult> {
    return this.send(ctx.eventId, { PaymentRemittanceRequest: AribaMapper.paymentRemittanceRequest(payload as PaymentCompletedPayload) }, 'PAYMENT');
  }
}
