import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { ErpSystem } from '@prisma/client';
import { WebhookController } from './webhook.controller';

function makeController(overrides: {
  webhookSecretFor?: (tenantId: string, erp: ErpSystem) => Promise<string | null>;
  envSecret?: string;
  jaEncaminhadoComSucesso?: (type: string, poId: string) => Promise<boolean>;
} = {}) {
  const audit = { info: jest.fn(async () => undefined) } as unknown as ConstructorParameters<typeof WebhookController>[0];

  const config = {
    get: (key: string) => (key === 'webhookSecret' ? overrides.envSecret : undefined),
  } as unknown as ConstructorParameters<typeof WebhookController>[1];

  const credentials = {
    webhookSecretFor: overrides.webhookSecretFor ?? (async () => null),
  } as unknown as ConstructorParameters<typeof WebhookController>[2];

  const notifyKixima = jest.fn(async () => undefined);
  const webhooks = {
    jaEncaminhadoComSucesso: overrides.jaEncaminhadoComSucesso ?? (async () => false),
    notifyKixima,
  } as unknown as ConstructorParameters<typeof WebhookController>[3];

  const controller = new WebhookController(audit, config, credentials, webhooks);
  return { controller, audit, credentials, webhooks, notifyKixima };
}

function assinar(secret: string, body: Record<string, unknown>) {
  const raw = Buffer.from(JSON.stringify(body));
  const signature = createHmac('sha256', secret).update(raw).digest('hex');
  return { raw, signature };
}

function fakeReq(raw: Buffer) {
  return { rawBody: raw } as any;
}

describe('WebhookController — resolveSecret (fallback tenant → global → env)', () => {
  it('usa o segredo do próprio tenant quando existe', async () => {
    const { controller } = makeController({
      webhookSecretFor: async (tenantId) => (tenantId === 'empresa-1' ? 'segredo-tenant' : null),
      envSecret: 'segredo-env',
    });
    const body = { type: 'payment.confirmed', poId: 'po-1' };
    const { raw, signature } = assinar('segredo-tenant', body);

    await expect(
      controller.receive('empresa-1', 'sap', signature, fakeReq(raw), body),
    ).resolves.toEqual({ received: true });
  });

  it('cai para o segredo global (*) quando o tenant não tem um próprio', async () => {
    const { controller } = makeController({
      webhookSecretFor: async (tenantId) => (tenantId === '*' ? 'segredo-global' : null),
      envSecret: 'segredo-env',
    });
    const body = { type: 'payment.confirmed', poId: 'po-1' };
    const { raw, signature } = assinar('segredo-global', body);

    await expect(
      controller.receive('empresa-1', 'sap', signature, fakeReq(raw), body),
    ).resolves.toEqual({ received: true });
  });

  it('cai para a variável de ambiente WEBHOOK_SIGNING_SECRET quando tenant e global não têm segredo', async () => {
    const { controller } = makeController({
      webhookSecretFor: async () => null,
      envSecret: 'segredo-env',
    });
    const body = { type: 'payment.confirmed', poId: 'po-1' };
    const { raw, signature } = assinar('segredo-env', body);

    await expect(
      controller.receive('empresa-1', 'sap', signature, fakeReq(raw), body),
    ).resolves.toEqual({ received: true });
  });

  it('recusa com ServiceUnavailableException quando não há segredo nenhum (nem tenant, nem global, nem env)', async () => {
    const { controller } = makeController({ webhookSecretFor: async () => null, envSecret: undefined });
    const body = { type: 'payment.confirmed', poId: 'po-1' };
    const { raw } = assinar('qualquer', body);

    await expect(
      controller.receive('empresa-1', 'sap', 'assinatura-qualquer', fakeReq(raw), body),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('recusa com UnauthorizedException quando a assinatura não corresponde ao segredo resolvido', async () => {
    const { controller } = makeController({
      webhookSecretFor: async (tenantId) => (tenantId === 'empresa-1' ? 'segredo-tenant' : null),
    });
    const body = { type: 'payment.confirmed', poId: 'po-1' };
    const { raw } = assinar('segredo-errado', body);

    await expect(
      controller.receive('empresa-1', 'sap', 'assinatura-invalida', fakeReq(raw), body),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('WebhookController — idempotência do relay (jaEncaminhadoComSucesso)', () => {
  it('não reencaminha ao Kixima quando o resultado já foi entregue com sucesso antes', async () => {
    const { controller, notifyKixima } = makeController({
      webhookSecretFor: async (tenantId) => (tenantId === 'empresa-1' ? 'segredo-tenant' : null),
      jaEncaminhadoComSucesso: async () => true,
    });
    const body = { type: 'payment.confirmed', poId: 'po-1' };
    const { raw, signature } = assinar('segredo-tenant', body);

    await controller.receive('empresa-1', 'sap', signature, fakeReq(raw), body);

    expect(notifyKixima).not.toHaveBeenCalled();
  });

  it('reencaminha ao Kixima quando ainda não houve entrega com sucesso para este (type, poId)', async () => {
    const { controller, notifyKixima } = makeController({
      webhookSecretFor: async (tenantId) => (tenantId === 'empresa-1' ? 'segredo-tenant' : null),
      jaEncaminhadoComSucesso: async () => false,
    });
    const body = { type: 'payment.confirmed', poId: 'po-1', valorPago: 100 };
    const { raw, signature } = assinar('segredo-tenant', body);

    await controller.receive('empresa-1', 'sap', signature, fakeReq(raw), body);

    expect(notifyKixima).toHaveBeenCalledWith(null, 'payment.confirmed', { poId: 'po-1', valorPago: 100 });
  });

  it('não consulta idempotência nem reencaminha para tipos não relevantes ou sem poId', async () => {
    const { controller, notifyKixima, webhooks } = makeController({
      webhookSecretFor: async (tenantId) => (tenantId === 'empresa-1' ? 'segredo-tenant' : null),
    });
    const jaEncaminhadoSpy = jest.spyOn(webhooks, 'jaEncaminhadoComSucesso');
    const body = { type: 'algum.outro.evento' };
    const { raw, signature } = assinar('segredo-tenant', body);

    await controller.receive('empresa-1', 'sap', signature, fakeReq(raw), body);

    expect(jaEncaminhadoSpy).not.toHaveBeenCalled();
    expect(notifyKixima).not.toHaveBeenCalled();
  });
});
