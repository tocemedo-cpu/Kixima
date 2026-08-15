// src/services/storageService.js
// Armazenamento de imagens plugável: 'local' (disco, dev) ou 's3'
// (AWS S3 / Supabase Storage / Cloudflare R2 / MinIO). Recebe o buffer do
// upload (multer memoryStorage) e devolve o URL a guardar em product.imageUrl.
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const fileSignature = require('../utils/fileSignature');
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
// A configuração é avaliada UMA vez, no arranque. Se o provider é 's3' mas
// faltam credenciais, o SDK da AWS só se queixa no momento do upload — e com
// «Resolved credential object is not valid», que não diz o que fazer nem qual
// variável falta. Aqui o problema é dito por extenso e o serviço volta ao disco
// local, para o registo de empresas e os comprovativos continuarem a funcionar.
function s3MalConfigurado() {
  return config.storage.provider === 's3' && (config.storage.missing || []).length > 0;
}
if (s3MalConfigurado()) {
  logger.error(
    `Armazenamento S3 ATIVO mas mal configurado — faltam: ${config.storage.missing.join(', ')}. ` +
    'Os ficheiros vão para o disco do contentor, que é APAGADO a cada reinício. ' +
    'Defina essas variáveis no ambiente (Supabase → Project Settings → Storage → S3 access keys) ' +
    'e reinicie o serviço. Nota: uma variável criada mas deixada EM BRANCO conta como ausente. '
    + 'Para confirmar, entre como Admin do Sistema em Configurações e Suporte → Prontidão para '
    + 'produção (o plano gratuito do Render não dá acesso a shell).',
  );
}

// O provider efetivo: 's3' só quando está mesmo utilizável.
function providerAtivo() {
  return config.storage.provider === 's3' && !s3MalConfigurado() ? 's3' : 'local';
}

// O cliente é memorizado, mas com a assinatura da configuração que o criou: se
// as credenciais ou o endpoint mudarem, é reconstruído em vez de se continuar a
// usar um cliente montado com valores antigos.
let s3Client = null;
let s3Assinatura = null;
function getS3() {
  const { region, endpoint, accessKey, secretKey, forcePathStyle } = config.storage;
  const assinatura = JSON.stringify([region, endpoint, accessKey, secretKey, forcePathStyle]);
  if (!s3Client || s3Assinatura !== assinatura) {
    s3Assinatura = assinatura;
    s3Client = null;
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

function publicUrlFor(key, bucketAlvo) {
  const { publicUrl, endpoint, bucket, region } = config.storage;
  const b = bucketAlvo || bucket;
  // O STORAGE_PUBLIC_URL só vale para o bucket público das imagens; num bucket
  // diferente (as cópias de segurança) construir-se-ia um URL errado.
  if (publicUrl && b === bucket) return `${publicUrl.replace(/\/+$/, '')}/${key}`;
  if (endpoint) return `${endpoint.replace(/\/+$/, '')}/${b}/${key}`;
  return `https://${b}.s3.${region}.amazonaws.com/${key}`;
}

// Traduz as falhas do SDK em algo acionável. A mensagem crua («Resolved
// credential object is not valid», «SignatureDoesNotMatch», «NoSuchBucket»)
// aparecia no log sem dizer o que corrigir.
function explicar(err) {
  const m = String(err?.message || '');
  if (/credential/i.test(m)) return 'as credenciais S3 foram recusadas — verifique STORAGE_ACCESS_KEY e STORAGE_SECRET_KEY';
  if (/SignatureDoesNotMatch/i.test(m)) return 'a assinatura não confere — a chave secreta ou a região (STORAGE_REGION) estão erradas';
  if (/NoSuchBucket|NotFound/i.test(m)) return `o bucket "${config.storage.bucket}" não existe no endpoint configurado`;
  if (/AccessDenied|Forbidden/i.test(m)) return 'a chave não tem permissão de escrita neste bucket';
  if (/ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(m)) return `o endpoint "${config.storage.endpoint || 'AWS S3'}" está inacessível`;
  return m;
}

async function saveS3(key, buffer, mimetype, bucket = config.storage.bucket) {
  try {
    return await enviarS3(key, buffer, mimetype, bucket);
  } catch (err) {
    const motivo = explicar(err);
    logger.error(`Armazenamento S3: falha ao enviar ${key} — ${motivo}`, { erro: err.message });
    // Não se recorre ao disco em silêncio: o ficheiro ficaria num sítio onde
    // ninguém o vai procurar. Diz-se o que aconteceu.
    const e = new Error(`Não foi possível guardar o ficheiro no armazenamento: ${motivo}.`);
    e.status = 502;
    throw e;
  }
}

async function enviarS3(key, buffer, mimetype, bucket = config.storage.bucket) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
  return publicUrlFor(key, bucket);
}

// --- API pública ------------------------------------------------------------
// folder organiza os ficheiros (ex.: 'products', 'documents').
// `comChave` devolve { url, key } em vez do URL: quem guarda cópias de segurança
// precisa da CHAVE para as voltar a ler, e num bucket privado o URL não serve
// para isso.
async function saveFile({ buffer, originalname, mimetype, keyHint, folder = 'products', bucket, comChave = false }) {
  // O tipo declarado vem de quem envia; aqui confere-se contra os bytes reais.
  // A verificação está NESTE ponto e não nos filtros do multer por dois
  // motivos: o multer decide antes de haver buffer (só vê os cabeçalhos), e
  // tudo o que se guarda passa por aqui — não há rota que se possa esquecer
  // dela. Lança antes de qualquer escrita na base, porque quem chama guarda o
  // ficheiro primeiro e só depois grava.
  fileSignature.verificar(buffer, mimetype, originalname);
  const filename = buildFilename(keyHint, originalname);
  if (providerAtivo() === 's3') {
    const alvo = bucket || config.storage.bucket;
    const key = `${folder}/${filename}`;
    logger.info(`Storage S3: a enviar ${key} para o bucket ${alvo}`);
    const url = await saveS3(key, buffer, mimetype, alvo);
    return comChave ? { url, key } : url;
  }
  const url = saveLocal(filename, buffer);
  return comChave ? { url, key: filename } : url;
}

/**
 * Lê um objeto de volta do armazenamento.
 *
 * Existe para uma pergunta que a escrita não responde: a cópia de segurança que
 * foi enviada ontem ainda LÊ? Um upload que devolve 200 e um objeto truncado,
 * corrompido ou apagado por uma política de retenção são indistinguíveis até
 * alguém tentar lê-lo — e a altura em que se tenta é sempre a pior.
 */
/**
 * Junta o corpo de uma resposta do S3 num Buffer.
 *
 * O SDK v3 devolve um stream cujo tipo depende do ambiente. O
 * `transformToByteArray()` é o caminho documentado e existe em todas as versões
 * recentes; a iteração fica como recurso. Está à parte para poder ser testado:
 * este troço só corre quando alguém verifica uma cópia de segurança, e não pode
 * ser aí a primeira vez que se descobre que o Body não era o que se pensava.
 */
async function lerBody(body) {
  if (!body) throw new Error('resposta sem conteúdo');
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }
  const partes = [];
  for await (const p of body) partes.push(p);
  return Buffer.concat(partes);
}

async function lerFicheiro(key, bucket) {
  if (providerAtivo() !== 's3') {
    return fs.readFileSync(path.join(uploadsDir, path.basename(key)));
  }
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  try {
    const r = await getS3().send(new GetObjectCommand({
      Bucket: bucket || config.storage.bucket,
      Key: key,
    }));
    return lerBody(r.Body);
  } catch (err) {
    const e = new Error(`Não foi possível ler "${key}": ${explicar(err)}.`);
    e.status = 502;
    throw e;
  }
}

// Alias mantido para as imagens de produtos.
const saveImage = (args) => saveFile({ ...args, folder: 'products' });

module.exports = { saveFile, saveImage, lerFicheiro, lerBody, uploadsDir, providerAtivo };
