// src/config/upload.js
// Configuração de upload de imagens (multer). Guarda os ficheiros em disco na
// pasta uploads/ (fora do controlo de versões) e serve-os em /api/uploads.
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname).toLowerCase().match(/^\.[a-z0-9]+$/) || ['.jpg'])[0];
    const id = String(req.params.id || 'img').replace(/[^a-z0-9-]/gi, '');
    // Date.now() garante nome único por upload.
    cb(null, `${id}-${Date.now()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Formato de imagem não suportado (use PNG, JPG, WEBP, GIF ou SVG).'));
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { upload, uploadsDir };
