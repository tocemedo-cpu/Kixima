// src/config/csp.js
// Política de segurança de conteúdo (CSP).
//
// PORQUE É QUE ISTO EXISTE EM VEZ DA POLÍTICA POR OMISSÃO DO HELMET.
//
// O helmet traz uma CSP por omissão que é boa — `script-src 'self'`,
// `object-src 'none'` — mas que também traz `img-src 'self' data:`. E as
// imagens desta plataforma NÃO são servidas pela própria origem: quando o
// STORAGE_PROVIDER é s3, as fotos do catálogo e os logótipos vêm do bucket
// (Supabase Storage, R2, S3). O browser recusava-as todas.
//
// A avaria tinha duas propriedades que a tornavam difícil de encontrar:
//
//   1. NÃO APARECE EM DESENVOLVIMENTO. Em dev é o Vite que serve o frontend, e
//      o Vite não passa pelo helmet. Só existe no modo de serviço único — que é
//      exatamente como o Render serve isto em produção.
//
//   2. NÃO DÁ ERRO NO SERVIDOR. O pedido nem chega cá: é o browser que recusa.
//      Nos registos não fica nada. Vê-se um catálogo sem fotografias e não se
//      sabe porquê.
//
// Por isso os anfitriões permitidos são DERIVADOS da configuração de
// armazenamento, e não escritos à mão numa lista: mudar de bucket ou de
// fornecedor passa a ajustar a CSP sozinho. Uma lista escrita à mão ficaria
// desatualizada no dia em que alguém mudasse o STORAGE_ENDPOINT, e a avaria
// voltava exatamente na mesma forma silenciosa.
const config = require('./env');

/**
 * A origem (esquema + anfitrião) de um URL, ou null se não der para ler.
 * Só a origem: uma directiva de CSP com caminho é mais frágil e não acrescenta
 * nada aqui — o bucket inteiro é a unidade de confiança.
 */
function origemDe(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url).trim());
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * De onde é legítimo carregar imagens.
 *
 * Inclui o URL público (o que a interface usa quando está definido) E o
 * endpoint (de onde o storageService constrói o URL quando o público não está
 * definido). São caminhos diferentes no código e ambos acabam em <img src>.
 */
function origensDeImagem() {
  const { publicUrl, endpoint, bucket, region } = config.storage;
  const origens = [origemDe(publicUrl), origemDe(endpoint)];

  // AWS S3 sem endpoint próprio: o URL é montado a partir do bucket e da região
  // (ver storageService.publicUrlFor), e não existe variável nenhuma que o
  // contenha — tem de ser reconstruído aqui da mesma maneira.
  if (!endpoint && bucket && region) {
    origens.push(`https://${bucket}.s3.${region}.amazonaws.com`);
  }

  return [...new Set(origens.filter(Boolean))];
}

/**
 * Para onde o browser pode abrir ligações. O Sentry do frontend envia os erros
 * por fetch para o anfitrião do DSN; sem isto, a CSP bloqueia-os e o rastreio
 * de erros fica calado — a pior avaria possível numa ferramenta cujo trabalho é
 * avisar que há avarias.
 *
 * O DSN do frontend é uma variável de build (VITE_SENTRY_DSN) que o servidor
 * não vê. Usa-se o anfitrião do DSN do backend, que na prática é o mesmo (é a
 * mesma organização Sentry); quando forem diferentes, define-se
 * SENTRY_FRONTEND_DSN.
 */
function origensDeLigacao() {
  return [...new Set([
    origemDe(process.env.SENTRY_FRONTEND_DSN),
    origemDe(process.env.SENTRY_DSN),
  ].filter(Boolean))];
}

/**
 * As directivas para o helmet. Parte-se das do helmet e acrescenta-se só o que
 * é preciso — em vez de escrever a política toda à mão, que passaria a ficar
 * para trás a cada versão nova do helmet.
 */
function directivas(base) {
  const imagens = origensDeImagem();
  const ligacoes = origensDeLigacao();
  return {
    ...base,
    'img-src': ["'self'", 'data:', 'blob:', ...imagens],
    'connect-src': ["'self'", ...ligacoes],
    // O comprovativo de pagamento e os documentos de credenciamento são PDFs
    // que o revisor abre a partir do bucket. Sem isto o browser recusa-os pelo
    // mesmo motivo das imagens, e o botão "Abrir" não faz nada.
    'frame-src': ["'self'", ...imagens],
  };
}

module.exports = { directivas, origensDeImagem, origensDeLigacao, origemDe };
