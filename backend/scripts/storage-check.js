// scripts/storage-check.js
// Verifica a configuração de armazenamento (local ou S3/Supabase Storage):
// envia um objeto de teste e confirma que fica acessível. Útil depois de
// configurar as variáveis STORAGE_* em produção.
//
// Correr:  npm run storage:check
const https = require('https');
const http = require('http');
const config = require('../src/config/env');
const storageService = require('../src/services/storageService');

// PNG 1x1 transparente (bytes mínimos válidos).
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

function head(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'GET' }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(0));
    req.setTimeout(8000, () => { req.destroy(); resolve(0); });
    req.end();
  });
}

async function main() {
  const s = config.storage;
  console.log('Armazenamento configurado:');
  console.log(`  provider   = ${s.provider}`);
  if (s.provider === 's3') {
    console.log(`  bucket     = ${s.bucket || '(em falta!)'}`);
    console.log(`  endpoint   = ${s.endpoint || '(AWS S3 padrão)'}`);
    console.log(`  region     = ${s.region || '(não definida)'}`);
    console.log(`  publicUrl  = ${s.publicUrl || '(derivado do endpoint/bucket)'}`);
    console.log(`  pathStyle  = ${s.forcePathStyle}`);
    if (!s.bucket || !s.accessKey || !s.secretKey) {
      console.error('\n✗ Faltam STORAGE_BUCKET / STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY.');
      process.exit(1);
    }
  }

  console.log('\nA enviar objeto de teste…');
  const url = await storageService.saveFile({
    buffer: PNG_1x1,
    originalname: 'healthcheck.png',
    mimetype: 'image/png',
    keyHint: 'storage-healthcheck',
    folder: 'healthcheck',
  });
  console.log(`✓ Guardado. URL: ${url}`);

  if (s.provider === 's3' && /^https?:\/\//.test(url)) {
    const code = await head(url);
    if (code === 200) {
      console.log('✓ URL público acessível (HTTP 200) — Supabase Storage OK.');
    } else {
      console.error(`✗ URL respondeu ${code || 'sem resposta'}. Verifique se o bucket é PÚBLICO e o STORAGE_PUBLIC_URL correto.`);
      process.exit(2);
    }
  } else {
    console.log('(provider local — o ficheiro fica no disco; efémero em muitos hosts.)');
  }
}

main().catch((e) => { console.error('✗ Erro:', e.message); process.exit(1); });
