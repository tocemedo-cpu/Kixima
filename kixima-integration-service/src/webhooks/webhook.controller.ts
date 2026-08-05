import { Body, Controller, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ErpSystem } from '@prisma/client';
import { AuditService } from '@app/audit/audit.service';

/**
 * Webhooks de ENTRADA — confirmações assíncronas vindas dos ERPs (ex.: um ERP
 * que confirma o processamento de um documento fora do ciclo síncrono).
 * Regista em auditoria; a validação de assinatura por ERP é adicionada por
 * fornecedor conforme o esquema de segurança de cada um.
 */
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly audit: AuditService) {}

  @Post('erp/:erp')
  @HttpCode(202)
  async receive(
    @Param('erp') erp: string,
    @Headers('x-signature') signature: string | undefined,
    @Body() body: unknown,
  ): Promise<{ received: true }> {
    const system = this.parseErp(erp);
    await this.audit.info('webhook.inbound', `Webhook recebido de ${erp}`, {
      erp: system ?? undefined,
      metadata: { hasSignature: Boolean(signature), body: body as Record<string, unknown> },
    });
    return { received: true };
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
