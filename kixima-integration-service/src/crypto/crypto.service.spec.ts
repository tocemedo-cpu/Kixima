import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

const KEY = 'a'.repeat(64); // 32 bytes em hex

function makeService(): CryptoService {
  const config = { get: (k: string) => (k === 'encryptionKey' ? KEY : undefined) } as unknown as ConfigService;
  return new CryptoService(config);
}

describe('CryptoService (AES-256-GCM)', () => {
  it('cifra e decifra uma string (round-trip)', () => {
    const svc = makeService();
    const plaintext = 'segredo-oil-and-gas';
    const enc = svc.encrypt(plaintext);
    expect(enc).not.toContain(plaintext);
    expect(svc.decrypt(enc)).toBe(plaintext);
  });

  it('cifra e decifra JSON', () => {
    const svc = makeService();
    const obj = { po: 'PO-2026-0001', amount: 2_100_000, currency: 'AOA' };
    const enc = svc.encryptJson(obj);
    expect(svc.decryptJson<typeof obj>(enc)).toEqual(obj);
  });

  it('gera texto cifrado diferente a cada chamada (IV aleatório)', () => {
    const svc = makeService();
    expect(svc.encrypt('x')).not.toBe(svc.encrypt('x'));
  });

  it('assina e verifica HMAC em tempo constante', () => {
    const svc = makeService();
    const body = '{"type":"integration.completed"}';
    const sig = svc.sign(body, 'secret');
    expect(svc.verify(body, sig, 'secret')).toBe(true);
    expect(svc.verify(body, sig, 'errado')).toBe(false);
  });

  it('rejeita chave inválida', () => {
    const bad = { get: () => 'curta' } as unknown as ConfigService;
    expect(() => new CryptoService(bad)).toThrow(/ENCRYPTION_KEY/);
  });
});
