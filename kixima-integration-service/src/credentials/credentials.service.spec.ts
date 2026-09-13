import { ErpSystem } from '@prisma/client';
import { CredentialsService } from './credentials.service';

function makeService(overrides: {
  findUnique?: (args: unknown) => Promise<{ configEnc: string } | null>;
  decryptJson?: (enc: string) => Record<string, string>;
} = {}) {
  const prisma = {
    erpCredential: {
      findUnique: overrides.findUnique ?? (async () => null),
    },
  } as unknown as ConstructorParameters<typeof CredentialsService>[0];

  const crypto = {
    decryptJson: overrides.decryptJson ?? (() => ({})),
  } as unknown as ConstructorParameters<typeof CredentialsService>[1];

  const factory = {} as ConstructorParameters<typeof CredentialsService>[2];

  return new CredentialsService(prisma, crypto, factory);
}

describe('CredentialsService.webhookSecretFor', () => {
  it('devolve null quando não há credencial guardada para este tenant+ERP', async () => {
    const svc = makeService({ findUnique: async () => null });
    expect(await svc.webhookSecretFor('empresa-1', ErpSystem.SAP_S4HANA)).toBeNull();
  });

  it('devolve null quando a config existe mas não tem webhookSecret', async () => {
    const svc = makeService({
      findUnique: async () => ({ configEnc: 'cifrado' }),
      decryptJson: () => ({ baseUrl: 'https://sap.exemplo.com' }),
    });
    expect(await svc.webhookSecretFor('empresa-1', ErpSystem.SAP_S4HANA)).toBeNull();
  });

  it('devolve o webhookSecret guardado na config cifrada deste tenant+ERP', async () => {
    const svc = makeService({
      findUnique: async () => ({ configEnc: 'cifrado' }),
      decryptJson: () => ({ baseUrl: 'https://sap.exemplo.com', webhookSecret: 'segredo-do-tenant' }),
    });
    expect(await svc.webhookSecretFor('empresa-1', ErpSystem.SAP_S4HANA)).toBe('segredo-do-tenant');
  });

  it('devolve null (não lança) quando a decifragem falha', async () => {
    const svc = makeService({
      findUnique: async () => ({ configEnc: 'corrompido' }),
      decryptJson: () => { throw new Error('chave inválida'); },
    });
    expect(await svc.webhookSecretFor('empresa-1', ErpSystem.SAP_S4HANA)).toBeNull();
  });
});
