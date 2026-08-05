import { Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { EntityType, ErpSystem } from '@prisma/client';
import { ErpSyncContext, ErpSyncResult } from '@app/common/types/erp.types';

/**
 * Erro de negócio de um adapter. `retryable` indica se a operação pode ser
 * reenfileirada (ex.: 5xx, timeout) ou se é definitiva (ex.: 4xx de validação).
 */
export class ErpAdapterError extends Error {
  constructor(
    message: string,
    readonly erp: ErpSystem,
    readonly retryable: boolean,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ErpAdapterError';
  }
}

/**
 * Contrato abstrato de um adapter ERP. Cada ERP concreto implementa o mapeamento
 * e o transporte (OData, REST, cXML). O orquestrador (SyncService) trata de
 * idempotência, retries, auditoria e cifragem — o adapter só fala com o ERP.
 */
export abstract class ErpAdapter {
  protected readonly logger: Logger;
  protected readonly http: AxiosInstance;

  abstract readonly system: ErpSystem;

  protected constructor(baseURL: string, defaults: AxiosRequestConfig = {}) {
    this.logger = new Logger(this.constructor.name);
    this.http = axios.create({ baseURL, timeout: 30_000, ...defaults });
  }

  /** Indica se o adapter está ativo (credenciais/flag). */
  abstract isEnabled(): boolean;

  /** Verificação de saúde da ligação ao ERP. */
  abstract healthCheck(): Promise<boolean>;

  /** Empurra uma Ordem de Compra aprovada para o ERP. */
  abstract pushPurchaseOrder(payload: unknown, ctx: ErpSyncContext): Promise<ErpSyncResult>;

  /** Empurra uma fatura emitida. */
  abstract pushInvoice(payload: unknown, ctx: ErpSyncContext): Promise<ErpSyncResult>;

  /** Empurra uma receção de mercadoria (goods receipt). */
  abstract pushGoodsReceipt(payload: unknown, ctx: ErpSyncContext): Promise<ErpSyncResult>;

  /** Empurra um pagamento concluído. */
  abstract pushPayment(payload: unknown, ctx: ErpSyncContext): Promise<ErpSyncResult>;

  /** Encaminha por tipo de entidade — usado pelo orquestrador. */
  async sync(entity: EntityType, payload: unknown, ctx: ErpSyncContext): Promise<ErpSyncResult> {
    switch (entity) {
      case EntityType.PURCHASE_ORDER:
        return this.pushPurchaseOrder(payload, ctx);
      case EntityType.INVOICE:
        return this.pushInvoice(payload, ctx);
      case EntityType.GOODS_RECEIPT:
        return this.pushGoodsReceipt(payload, ctx);
      case EntityType.PAYMENT:
        return this.pushPayment(payload, ctx);
      default:
        throw new ErpAdapterError(`Entidade não suportada: ${entity}`, this.system, false);
    }
  }

  /** Helper: normaliza erros axios em ErpAdapterError com classificação de retry. */
  protected toAdapterError(err: unknown, op: string): ErpAdapterError {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const retryable = status === undefined || status >= 500 || status === 429;
      return new ErpAdapterError(
        `[${this.system}] ${op} falhou (${status ?? 'sem resposta'}): ${err.message}`,
        this.system,
        retryable,
        status,
      );
    }
    return new ErpAdapterError(`[${this.system}] ${op} erro: ${(err as Error).message}`, this.system, true);
  }
}
