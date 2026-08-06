// src/services/erpCrypto.js
// Criptografia AES-256-GCM para as credenciais ERP guardadas em
// CompanyErpConfig.configEnc. Mesmo formato do kixima-integration-service:
// base64( iv(12) | authTag(16) | ciphertext ). A chave vem de
// ERP_CONFIG_ENCRYPTION_KEY (32 bytes em hex). A chave só é exigida quando se
// cifra/decifra — o arranque do Kixima não depende dela.
const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');

const IV_LEN = 12;
const TAG_LEN = 16;

function key() {
  const hex = process.env.ERP_CONFIG_ENCRYPTION_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'ERP_CONFIG_ENCRYPTION_KEY inválida: 32 bytes em hex (64 caracteres). ' +
        'Gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(hex, 'hex');
}

function encryptJson(obj) {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function decryptJson(payload) {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8'));
}

module.exports = { encryptJson, decryptJson };
