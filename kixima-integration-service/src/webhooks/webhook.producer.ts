import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { WebhookStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@app/common/prisma/prisma.service';
import { CryptoService } from '@app/crypto/crypto.service';

/**
 * Webhooks de RETORNO para o Kixima: informa o backend principal do resultado
 * da integração (concluída/falhada) com assinatura HMAC-SHA256. Cada entrega é
 * persistida (WebhookDelivery) para auditoria e reenvio.
 */
@Injectable()
export class WebhookProducer {
  private readonly logger = new Logger(WebhookProducer.name);
  private readonly url: string;
  private readonly secret: string;
  private readonly timeout: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    config: ConfigService,
  ) {
    this.url = config.get<string>('callback.url') ?? '';
    this.secret = config.get<string>('callback.secret') ?? '';
    this.timeout = config.get<number>('callback.timeoutMs') ?? 10_000;
  }

  /**
   * Idempotência do relay de decisões ERP DOA: a MESMA decisão de aprovação
   * ou confirmação de pagamento não deve ser reencaminhada duas vezes ao
   * Kixima — o Kixima já é idempotente por estado, mas repetir o relay ainda
   * duplicaria auditoria/notificações lá. Um PO só é decidido/pago uma vez
   * neste fluxo, por isso (type, poId) já identifica o evento de forma
   * suficiente, sem precisar de um id próprio vindo do ERP.
   */
  async jaEncaminhadoComSucesso(type: string, poId: string): Promise<boolean> {
    const existente = await this.prisma.webhookDelivery.findFirst({
      where: {
        status: WebhookStatus.DELIVERED,
        AND: [
          { payload: { path: ['type'], equals: type } },
          { payload: { path: ['data', 'poId'], equals: poId } },
        ],
      },
      select: { id: true },
    });
    return Boolean(existente);
  }

  async notifyKixima(
    integrationEventId: string | null,
    type: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!this.url) {
      this.logger.debug('KIXIMA_CALLBACK_URL não definido — webhook de retorno ignorado.');
      return;
    }

    const payload = { type, data, occurredAt: new Date().toISOString() };
    const body = JSON.stringify(payload);
    const signature = this.crypto.sign(body, this.secret);

    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        integrationEventId,
        url: this.url,
        payload: payload as Prisma.InputJsonValue,
        status: WebhookStatus.PENDING,
      },
    });

    try {
      const res = await axios.post(this.url, body, {
        timeout: this.timeout,
        headers: { 'Content-Type': 'application/json', 'X-Kixima-Signature': signature },
      });
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WebhookStatus.DELIVERED,
          responseCode: res.status,
          deliveredAt: new Date(),
          attempts: { increment: 1 },
        },
      });
    } catch (err) {
      const message = (err as Error).message;
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: WebhookStatus.FAILED, lastError: message, attempts: { increment: 1 } },
      });
      this.logger.warn(`Webhook de retorno falhou (${type}): ${message}`);
    }
  }
}
