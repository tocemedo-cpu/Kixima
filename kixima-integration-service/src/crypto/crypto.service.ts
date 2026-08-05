import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Criptografia AES-256-GCM para dados sensíveis em repouso (payloads ERP,
 * credenciais) e assinatura HMAC para webhooks.
 *
 * Formato do texto cifrado (base64): iv(12) | authTag(16) | ciphertext.
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  private static readonly IV_LEN = 12;
  private static readonly TAG_LEN = 16;

  constructor(config: ConfigService) {
    const hex = config.get<string>('encryptionKey') ?? '';
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(
        'ENCRYPTION_KEY inválida: são necessários 32 bytes em hex (64 caracteres). ' +
          'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    this.key = Buffer.from(hex, 'hex');
  }

  /** Cifra uma string em claro e devolve base64 (iv|tag|ct). */
  encrypt(plaintext: string): string {
    const iv = randomBytes(CryptoService.IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]).toString('base64');
  }

  /** Cifra um objeto JSON. */
  encryptJson(obj: unknown): string {
    return this.encrypt(JSON.stringify(obj));
  }

  /** Decifra base64 (iv|tag|ct) para string em claro. */
  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, CryptoService.IV_LEN);
    const tag = buf.subarray(CryptoService.IV_LEN, CryptoService.IV_LEN + CryptoService.TAG_LEN);
    const ct = buf.subarray(CryptoService.IV_LEN + CryptoService.TAG_LEN);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  }

  /** Decifra para objeto JSON tipado. */
  decryptJson<T>(payload: string): T {
    return JSON.parse(this.decrypt(payload)) as T;
  }

  /** Assinatura HMAC-SHA256 (hex) para os webhooks de retorno. */
  sign(body: string, secret: string): string {
    return createHmac('sha256', secret).update(body).digest('hex');
  }

  /** Verificação de assinatura em tempo constante. */
  verify(body: string, signature: string, secret: string): boolean {
    const expected = this.sign(body, secret);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
