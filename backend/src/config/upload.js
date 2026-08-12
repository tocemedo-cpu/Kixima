// src/config/upload.js
// Recebe o upload em memória (buffer). O armazenamento efetivo (disco ou S3)
// é feito pelo storageService, para o provider ser plugável.
const multer = require('multer');
const { ValidationError } = require('../utils/errors');

// Mensagem clara para formatos não suportados (ex.: HEIC do iPhone, que o
// browser nem sequer consegue mostrar) — devolvida como 422, não como 500.
function rejectFormat(file) {
  const isHeic = /heic|heif/i.test(file.mimetype) || /\.hei[cf]$/i.test(file.originalname || '');
  return new ValidationError(
    isHeic
      ? 'Formato HEIC/HEIF (foto de iPhone) não é suportado pelos navegadores. Converta a imagem para JPG ou PNG antes de carregar.'
      : 'Formato de imagem não suportado. Use PNG, JPG, WEBP ou GIF.'
  );
}

function fileFilter(req, file, cb) {
  // SVG é intencionalmente rejeitado: pode conter script e resultar em XSS
  // armazenado quando servido na mesma origem.
  if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
  else cb(rejectFormat(file));
}

// Imagens (avatares, imagens de destaque, ilustrações da Ajuda) — até 12 MB,
// pois fotos de câmara/telemóvel ultrapassam facilmente os 5 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 12 * 1024 * 1024 },
});

// Documentos de credenciamento — aceita PDF e imagens (até 10 MB).
function documentFilter(req, file, cb) {
  if (/^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/.test(file.mimetype)) cb(null, true);
  // ValidationError e não Error: um formato errado é culpa do pedido (422), não
  // uma avaria da aplicação. Com o Error genérico, quem enviava um ficheiro no
  // formato errado recebia "ocorreu um erro interno" e o caso entrava no Sentry
  // como falha do servidor.
  else cb(new ValidationError('Documento inválido — use PDF ou imagem (PNG/JPG).'));
}

const uploadDocuments = multer({
  storage: multer.memoryStorage(),
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Cadastro de produto: mistura imagens (mainImage/gallery) e documentos
// técnicos num só pedido multipart. Os campos de imagem só aceitam imagens; os
// de documento aceitam PDF ou imagem.
const IMAGE_FIELDS = new Set(['mainImage', 'gallery']);
function productMediaFilter(req, file, cb) {
  // SVG rejeitado (risco de XSS armazenado — ver fileFilter).
  const isImage = /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype);
  const isPdf = file.mimetype === 'application/pdf';
  if (IMAGE_FIELDS.has(file.fieldname)) {
    return isImage ? cb(null, true) : cb(rejectFormat(file));
  }
  // Campos de documento.
  return isImage || isPdf ? cb(null, true) : cb(new ValidationError('Documento inválido — use PDF ou imagem (PNG/JPG).'));
}

const uploadProductMedia = multer({
  storage: multer.memoryStorage(),
  fileFilter: productMediaFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Importação de catálogo em massa — aceita ficheiros .xlsx (até 25 MB, pois
// podem incluir imagens embebidas).
function spreadsheetFilter(req, file, cb) {
  const ok = /(sheet|excel|officedocument\.spreadsheetml)/.test(file.mimetype)
    || /\.xlsx?$/i.test(file.originalname || '');
  cb(ok ? null : new ValidationError('Ficheiro inválido — envie uma folha de cálculo .xlsx.'), ok);
}

const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  fileFilter: spreadsheetFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});

module.exports = { upload, uploadDocuments, uploadProductMedia, uploadSpreadsheet };
