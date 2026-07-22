// src/config/upload.js
// Recebe o upload em memória (buffer). O armazenamento efetivo (disco ou S3)
// é feito pelo storageService, para o provider ser plugável.
const multer = require('multer');

function fileFilter(req, file, cb) {
  if (/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Formato de imagem não suportado (use PNG, JPG, WEBP, GIF ou SVG).'));
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Documentos de credenciamento — aceita PDF e imagens (até 10 MB).
function documentFilter(req, file, cb) {
  if (/^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Documento inválido — use PDF ou imagem (PNG/JPG).'));
}

const uploadDocuments = multer({
  storage: multer.memoryStorage(),
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { upload, uploadDocuments };
