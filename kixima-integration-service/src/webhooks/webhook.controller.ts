import {
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

/**
 * Webhooks de ENTRADA — confirmações assíncronas vindas dos ERPs. A carga é
 * autenticada por HMAC-SHA256 (cabeçalho `x-signature`) sobre o corpo bruto,
 * com o segredo WEBHOOK_SIGNING_SECRET. Falha fechada: sem segredo, recusa.
 */
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  @Post('erp/:erp')
  @HttpCode(202)
  async receive(
    @Param('erp') erp: string,
    @Headers('x-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    this.verifySignature(signature, req.rawBody);

    const system = this.parseErp(erp);
    // Não regista o corpo (pode conter dados de negócio) — apenas metadados.
    await this.audit.info('webhook.inbound', `Webhook recebido de ${erp}`, {
      erp: system ?? undefined,
      metadata: { verified: true },
    });
    return { received: true };
  }

  private verifySignature(signature: string | undefined, rawBody: Buffer | undefined): void {
    const secret = this.config.get<string>('webhookSecret') ?? '';
    if (!secret) {
      throw new ServiceUnavailableException('Webhook não configurado (WEBHOOK_SIGNING_SECRET em falta).');
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
