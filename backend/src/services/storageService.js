// src/services/storageService.js
// Armazenamento de imagens plugável: 'local' (disco, dev) ou 's3'
// (AWS S3 / Supabase Storage / Cloudflare R2 / MinIO). Recebe o buffer do
// upload (multer memoryStorage) e devolve o URL a guardar em product.imageUrl.
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const logger = require('../config/logger');

const uploadsDir = path.join(__dirname, '../../uploads');

function extFrom(originalname) {
  const m = String(originalname || '').toLowerCase().match(/\.[a-z0-9]+$/);
  return m ? m[0] : '.jpg';
}

function buildFilename(keyHint, originalname) {
  const id = String(keyHint || 'img').replace(/[^a-z0-9-]/gi, '');
  // Date.now() garante unicidade por upload.
  return `${id}-${Date.now()}${extFrom(originalname)}`;
}

// --- Provider: local (disco) -----------------------------------------------
function saveLocal(filename, buffer) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return `/api/uploads/${filename}`;
}

// --- Provider: S3-compatível ------------------------------------------------
let s3Client = null;
function getS3() {
  if (!s3Client) {
    // require preguiçoso — só carrega o SDK quando o provider é s3.
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: config.storage.region || 'us-east-1',
      endpoint: config.storage.endpoint,
      forcePathStyle: config.storage.forcePathStyle,
      credentials: {
        accessKeyId: config.storage.accessKey,
        secretAccessKey: config.storage.secretKey,
      },
    });
  }
  return s3Client;
}

function publicUrlFor(key) {
  const { publicUrl, endpoint, bucket, region } = config.storage;
  if (publicUrl) return `${publicUrl.replace(/\/+$/, '')}/${key}`;
  if (endpoint) return `${endpoint.replace(/\/+$/, '')}/${bucket}/${key}`;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function saveS3(key, buffer, mimetype) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await getS3().send(
    new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
  return publicUrlFor(key);
}

// --- API pública ------------------------------------------------------------
// folder organiza os ficheiros (ex.: 'products', 'documents').
async function saveFile({ buffer, originalname, mimetype, keyHint, folder = 'products' }) {
  const filename = buildFilename(keyHint, originalname);
  if (config.storage.provider === 's3') {
    logger.info(`Storage S3: a enviar ${folder}/${filename} para o bucket ${config.storage.bucket}`);
    return saveS3(`${folder}/${filename}`, buffer, mimetype);
  }
  return saveLocal(filename, buffer);
}

// Alias mantido para as imagens de produtos.
const saveImage = (args) => saveFile({ ...args, folder: 'products' });

module.exports = { saveFile, saveImage, uploadsDir };
