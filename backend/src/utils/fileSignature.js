// src/utils/fileSignature.js
// Confere que um ficheiro é mesmo do tipo que diz ser.
//
// O `mimetype` que o multer expõe vem do cabeçalho Content-Type da parte
// multipart — ou seja, vem de QUEM ENVIA. É uma declaração, não uma
// verificação. Um executável renomeado para .pdf, com o Content-Type forjado
// para application/pdf, passava por todos os filtros e ia parar à pasta dos
// documentos de credenciamento, de onde é servido de volta a quem os revê — que
// é sempre alguém com permissões altas.
//
// Aqui lêem-se os primeiros bytes, que são a única parte do ficheiro que o
// formato obriga a estar certa. Não é uma análise antivírus e não se faz passar
// por uma: é a diferença entre aceitar a palavra de quem envia e olhar para o
// conteúdo.
const { ValidationError } = require('./errors');

// Cada assinatura diz onde começa e que bytes espera. `em` existe para o WEBP,
// cujo marcador está no byte 8 e não no princípio.
const ASSINATURAS = [
  { tipo: 'application/pdf', rotulo: 'PDF', partes: [{ em: 0, bytes: [0x25, 0x50, 0x44, 0x46] }] }, // %PDF
  { tipo: 'image/png', rotulo: 'PNG', partes: [{ em: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }] },
  { tipo: 'image/jpeg', rotulo: 'JPEG', partes: [{ em: 0, bytes: [0xff, 0xd8, 0xff] }] },
  { tipo: 'image/gif', rotulo: 'GIF', partes: [{ em: 0, bytes: [0x47, 0x49, 0x46, 0x38] }] }, // GIF8
  {
    tipo: 'image/webp',
    rotulo: 'WEBP',
    partes: [
      { em: 0, bytes: [0x52, 0x49, 0x46, 0x46] },              // RIFF
      { em: 8, bytes: [0x57, 0x45, 0x42, 0x50] },              // WEBP
    ],
  },
  {
    // .xlsx é um zip. Confirma-se que é um zip; o resto valida-se ao abrir.
    tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    rotulo: 'XLSX',
    partes: [{ em: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
];

// image/jpg não existe formalmente mas é enviado por muito cliente; tratá-lo
// como desconhecido recusaria fotografias legítimas.
const EQUIVALENTES = { 'image/jpg': 'image/jpeg', 'image/pjpeg': 'image/jpeg' };

function normalizar(mimetype) {
  const m = String(mimetype || '').toLowerCase().split(';')[0].trim();
  return EQUIVALENTES[m] || m;
}

function bate(buffer, assinatura) {
  return assinatura.partes.every(({ em, bytes }) =>
    // O comprimento confere-se por assinatura e não com um mínimo fixo: a do
    // JPEG tem 3 bytes e a do PNG tem 8. Um mínimo global de 4 recusava JPEGs.
    buffer.length >= em + bytes.length
    && bytes.every((b, i) => buffer[em + i] === b));
}

/** Que formato é este ficheiro, olhando só para o conteúdo? Null se nenhum conhecido. */
function detetar(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  return ASSINATURAS.find((a) => bate(buffer, a)) || null;
}

/**
 * Lança se o conteúdo não corresponder ao tipo declarado.
 *
 * A mensagem diz o que se recebeu, e não só que foi recusado: quem envia um
 * .heic convertido a meio ou um PDF corrompido precisa de saber qual dos dois
 * aconteceu. Um "ficheiro inválido" seco manda a pessoa tentar outra vez
 * exatamente o mesmo.
 */
function verificar(buffer, mimetypeDeclarado, originalname = 'ficheiro') {
  const declarado = normalizar(mimetypeDeclarado);
  const esperada = ASSINATURAS.find((a) => a.tipo === declarado);

  // Tipo que não sabemos verificar: não se inventa uma recusa. Os filtros do
  // multer já restringem o que entra; esta função existe para confirmar o que
  // consegue confirmar, não para ser a única barreira.
  if (!esperada) return;

  const real = detetar(buffer);
  if (real && real.tipo === declarado) return;

  throw new ValidationError(
    real
      ? `O ficheiro "${originalname}" foi enviado como ${esperada.rotulo} mas o conteúdo é ${real.rotulo}. `
        + 'Converta-o para o formato certo ou envie o ficheiro original.'
      : `O ficheiro "${originalname}" diz ser ${esperada.rotulo} mas o conteúdo não é de nenhum formato reconhecido. `
        + 'Pode estar corrompido ou ter sido apenas renomeado — envie o ficheiro original.',
  );
}

module.exports = { verificar, detetar, ASSINATURAS };
