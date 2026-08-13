// src/utils/totp.js
// TOTP (RFC 6238) sobre HOTP (RFC 4226) implementado só com o crypto do Node —
// sem dependências novas. Compatível com Google Authenticator, Microsoft
// Authenticator, Authy, etc. (SHA-1, 6 dígitos, período de 30s — o padrão).
const crypto = require('crypto');

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// Segredo novo: 20 bytes aleatórios (160 bits, recomendação da RFC).
function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secretB32, counter) {
  const key = base32Decode(secretB32);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const code =
    (((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]) % 1_000_000;
  return String(code).padStart(6, '0');
}

const STEP_SECONDS = 30;

function totp(secretB32, { at = Date.now() } = {}) {
  return hotp(secretB32, Math.floor(at / 1000 / STEP_SECONDS));
}

// Verifica com janela de tolerância ±1 passo (relógios ligeiramente fora de
// sincronia). Comparação em tempo constante.
function verify(code, secretB32, { at = Date.now(), window = 1 } = {}) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 6 || !secretB32) return false;
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  for (let i = -window; i <= window; i++) {
    const expected = hotp(secretB32, counter + i);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return true;
  }
  return false;
}

/**
 * Se o código NÃO foi aceite, procura-o numa janela larga para descobrir se o
 * problema é o relógio. Devolve o desvio em segundos (positivo = telemóvel
 * adiantado) ou null se o código não bate em lado nenhum.
 *
 * Porquê existir: "Código incorreto" é verdade e não ajuda nada. A causa quase
 * sempre é o relógio do telemóvel fora de horas — o TOTP é a hora, e 40 segundos
 * de desvio chegam para falhar tudo. Sem isto, a pessoa reinstala a app, volta a
 * ler o QR e falha na mesma, porque o problema nunca esteve no segredo.
 *
 * NÃO se usa para ACEITAR o código: aceitar com o relógio errado deixaria a
 * pessoa ativar a 2FA e depois falhar em todos os logins seguintes. O desvio
 * tem de ser corrigido, não contornado.
 *
 * A janela larga não enfraquece nada — o código continua a ser recusado — e
 * /api/auth está limitado a 20 tentativas falhadas por 15 minutos.
 */
const DESVIO_MAX_PASSOS = 20; // ±10 minutos

function desvioDeRelogio(code, secretB32, { at = Date.now(), window = 1 } = {}) {
  const c = String(code || '').replace(/\D/g, '');
  if (c.length !== 6 || !secretB32) return null;
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  for (let i = -DESVIO_MAX_PASSOS; i <= DESVIO_MAX_PASSOS; i++) {
    if (Math.abs(i) <= window) continue;         // dentro do aceite: não é desvio
    if (hotp(secretB32, counter + i) === c) return i * STEP_SECONDS;
  }
  return null;
}

// Frase pronta para o utilizador a partir do desvio detetado.
function explicarFalha(code, secretB32, opcoes) {
  const desvio = desvioDeRelogio(code, secretB32, opcoes);
  if (desvio === null) {
    return 'Código incorreto. Confirme que está a ler a entrada KIXIMA correta na app — se leu o '
      + 'código QR mais do que uma vez, ficaram várias entradas com o mesmo nome e só a última serve.';
  }
  const segundos = Math.abs(desvio);
  const sentido = desvio > 0 ? 'adiantado' : 'atrasado';
  return `O código corresponde, mas o relógio do seu telemóvel está cerca de ${segundos} segundos `
    + `${sentido}. Ative a hora automática no telemóvel (ou, no Google Authenticator: Definições → `
    + 'Correção horária dos códigos → Sincronizar agora) e tente outra vez.';
}

// URL otpauth:// que as apps de autenticação leem (via QR ou colada à mão).
function otpauthUrl({ secret, label, issuer = 'KIXIMA' }) {
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: String(STEP_SECONDS) });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?${params}`;
}

module.exports = {
  generateSecret, totp, verify, otpauthUrl, base32Encode, base32Decode,
  desvioDeRelogio, explicarFalha,
};
