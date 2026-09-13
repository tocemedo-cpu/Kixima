import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  RawBodyRequest,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ErpSystem } from '@prisma/client';
import { AuditService } from '@app/audit/audit.service';
import { CredentialsService, GLOBAL_TENANT } from '@app/credentials/credentials.service';
import { WebhookProducer } from './webhook.producer';

/** Tipos de resultado ERP DOA Approval que este endpoint sabe encaminhar ao Kixima. */
const RELAYABLE_TYPES = new Set(['purchase_order.approval_decided', 'payment.confirmed']);

/**
 * Webhooks de ENTRADA — confirmações assíncronas vindas dos ERPs. A carga é
 * autenticada por HMAC-SHA256 (cabeçalho `x-signature`) sobre o corpo bruto.
 * Falha fechada: sem segredo resolvido para este tenant+ERP, recusa.
 *
 * SEGREDO POR TENANT+ERP (não um único segredo global): o `:tenantId` na rota
 * identifica de que empresa/ligação este webhook diz vir, e a assinatura é
 * verificada contra o segredo GUARDADO PARA ESSE TENANT+ERP (mesma tabela
 * cifrada das credenciais de ligação, campo reservado `webhookSecret` — sem
 * migração nova). Um único segredo global partilhado por todos os ERPs/
 * tenants significava que uma fuga permitia forjar webhooks "vindos" de
 * qualquer ERP, para qualquer tenant — ver resolveSecret(). Cai para a
 * configuração global ('*') e por fim para WEBHOOK_SIGNING_SECRET (variável
 * de ambiente) só por compatibilidade enquanto nenhum tenant tiver segredo
 * próprio configurado.
 *
 * IDEMPOTÊNCIA DO RELAY: a mesma decisão/confirmação de pagamento não é
 * reencaminhada duas vezes ao Kixima — ver WebhookProducer.jaEncaminhadoComSucesso.
 *
 * ERP DOA Approval: a decisão (aprovado/rejeitado) e a confirmação de
 * pagamento do workflow do ERP chegam aqui — não há especificação pública do
 * formato nativo de cada ERP para isto (nunca fingir que há), por isso este
 * endpoint aceita o formato CANÓNICO já usado pelo callback do Kixima
 * (`{ type, poId, aprovado?, erpExternalId?, motivo?, valorPago?, pagoEm? }`)
 * e limita-se a ENCAMINHAR, assinado, para `/api/integration/callback` — ver
 * WebhookProducer.notifyKixima.
 */
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly credentials: CredentialsService,
    private readonly webhooks: WebhookProducer,
  ) {}

  @Post('erp/:tenantId/:erp')
  @HttpCode(202)
  async receive(
    @Param('tenantId') tenantId: string,
    @Param('erp') erp: string,
    @Headers('x-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
  ): Promise<{ received: true }> {
    const system = this.parseErp(erp);
    await this.verifySignature(tenantId, system, signature, req.rawBody);

    // Não regista o corpo (pode conter dados de negócio). Só o tipo, quando existe.
    const type = typeof body?.type === 'string' ? body.type : undefined;
    await this.audit.info('webhook.inbound', `Webhook recebido de ${erp} (tenant ${tenantId})`, {
      erp: system ?? undefined,
      metadata: { verified: true, type: type ?? null },
    });

    if (type && RELAYABLE_TYPES.has(type) && body.poId) {
      const poId = String(body.poId);
      if (await this.webhooks.jaEncaminhadoComSucesso(type, poId)) {
        await this.audit.info('webhook.duplicate', `Resultado de ${erp} ignorado — já reencaminhado (${type})`, {
          erp: system ?? undefined,
        });
        return { received: true };
      }

      const { type: _type, ...data } = body;
      await this.webhooks.notifyKixima(null, type, data);
      await this.audit.info('webhook.relayed', `Resultado de ${erp} encaminhado ao Kixima (${type})`, {
        erp: system ?? undefined,
      });
    }

    return { received: true };
  }

  /**
   * Segredo a usar para este pedido: específico do tenant+ERP primeiro,
   * depois a configuração global ('*') desse ERP, e só por fim a variável de
   * ambiente WEBHOOK_SIGNING_SECRET — mantida como compatibilidade enquanto
   * nenhum tenant tiver migrado para um segredo próprio.
   */
  private async resolveSecret(tenantId: string, erp: ErpSystem | null): Promise<string> {
    if (erp) {
      const porTenant = await this.credentials.webhookSecretFor(tenantId, erp);
      if (porTenant) return porTenant;
      if (tenantId !== GLOBAL_TENANT) {
        const global = await this.credentials.webhookSecretFor(GLOBAL_TENANT, erp);
        if (global) return global;
      }
    }
    return this.config.get<string>('webhookSecret') ?? '';
  }

  private async verifySignature(
    tenantId: string,
    erp: ErpSystem | null,
    signature: string | undefined,
    rawBody: Buffer | undefined,
  ): Promise<void> {
    const secret = await this.resolveSecret(tenantId, erp);
    if (!secret) {
      throw new ServiceUnavailableException('Webhook não configurado (sem segredo para este tenant/ERP nem WEBHOOK_SIGNING_SECRET).');
    }
    const raw = rawBody ?? Buffer.alloc(0);
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(signature ?? '');
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Assinatura do webhook inválida.');
    }
  }

  private parseErp(erp: string): ErpSystem | null {
    const map: Record<string, ErpSystem> = {
      sap: ErpSystem.SAP_S4HANA,
      's4hana': ErpSystem.SAP_S4HANA,
      primavera: ErpSystem.PRIMAVERA,
      oracle: ErpSystem.ORACLE_ERP_CLOUD,
      ariba: ErpSystem.SAP_ARIBA,
    };
    return map[erp.toLowerCase()] ?? null;
  }
}
