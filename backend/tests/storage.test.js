// tests/storage.test.js
// Armazenamento de imagens: o routing S3 (Supabase Storage) — sem credenciais
// reais, o cliente S3 é simulado (mock) para verificar que saveFile envia o
// objeto e devolve o URL público correto. O modo 'local' é testado a sério.

// Mock do SDK S3 antes de carregar o serviço.
const sent = [];
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn(async (cmd) => { sent.push(cmd); }) })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ __type: 'PutObject', input })),
}));

const config = require('../src/config/env');
const storageService = require('../src/services/storageService');

const IMG = Buffer.from('89504e470d0a1a0a', 'hex');

describe('storageService — S3 (Supabase Storage)', () => {
  const original = { ...config.storage };
  afterEach(() => { Object.assign(config.storage, original); sent.length = 0; });

  test('modo local devolve URL /api/uploads', async () => {
    Object.assign(config.storage, { provider: 'local' });
    const url = await storageService.saveFile({ buffer: IMG, originalname: 'x.png', mimetype: 'image/png', keyHint: 'k', folder: 'catalog' });
    expect(url).toMatch(/^\/api\/uploads\/.*\.png$/);
  });

  test('modo s3: envia PutObject e devolve o URL público a partir de STORAGE_PUBLIC_URL', async () => {
    Object.assign(config.storage, {
      provider: 's3', bucket: 'product-images', region: 'eu-central-1',
      accessKey: 'ak', secretKey: 'sk',
      endpoint: 'https://proj.supabase.co/storage/v1/s3',
      publicUrl: 'https://proj.supabase.co/storage/v1/object/public/product-images',
      forcePathStyle: true,
    });
    const url = await storageService.saveFile({ buffer: IMG, originalname: 'foto.jpg', mimetype: 'image/jpeg', keyHint: 'cat-1', folder: 'catalog' });

    // URL público = publicUrl + '/' + key (folder/filename)
    expect(url).toMatch(/^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/public\/product-images\/catalog\/cat-1-\d+\.jpg$/);
    // Enviou exatamente um PutObject com o bucket/content-type corretos.
    expect(sent).toHaveLength(1);
    expect(sent[0].input.Bucket).toBe('product-images');
    expect(sent[0].input.ContentType).toBe('image/jpeg');
    expect(sent[0].input.Key).toMatch(/^catalog\/cat-1-\d+\.jpg$/);
  });
});

describe('storageService — configuração incompleta', () => {
  const original = { ...config.storage };
  afterEach(() => { Object.assign(config.storage, original); sent.length = 0; });

  // Foi isto que partiu em produção: STORAGE_PROVIDER=s3 ligado, credenciais em
  // falta, e o SDK a rebentar no upload com «Resolved credential object is not
  // valid» — o utilizador via um 500 e o log não dizia que variável faltava.
  test('sem credenciais não tenta o S3: escreve no disco em vez de rebentar', async () => {
    Object.assign(config.storage, {
      provider: 's3', bucket: 'kixima', accessKey: '', secretKey: '',
      missing: ['STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'],
    });
    expect(storageService.providerAtivo()).toBe('local');

    const url = await storageService.saveFile({ buffer: IMG, originalname: 'd.pdf', mimetype: 'application/pdf', keyHint: 'doc', folder: 'documents' });
    expect(url).toMatch(/^\/api\/uploads\//);
    expect(sent).toHaveLength(0); // nem chegou a falar com o S3
  });

  test('uma variável vazia conta como em falta', () => {
    Object.assign(config.storage, { provider: 's3', missing: ['STORAGE_SECRET_KEY'] });
    expect(storageService.providerAtivo()).toBe('local');
  });

  test('com tudo configurado usa mesmo o S3', () => {
    Object.assign(config.storage, { provider: 's3', bucket: 'kixima', accessKey: 'k', secretKey: 's', missing: [] });
    expect(storageService.providerAtivo()).toBe('s3');
  });
});

describe('storageService — falhas do S3 em execução', () => {
  const original = { ...config.storage };
  afterEach(() => { Object.assign(config.storage, original); sent.length = 0; });

  test('a falha do SDK vira uma mensagem que diz o que corrigir', async () => {
    const { S3Client } = require('@aws-sdk/client-s3');
    S3Client.mockImplementationOnce(() => ({
      send: jest.fn(async () => { throw new Error('Resolved credential object is not valid'); }),
    }));
    Object.assign(config.storage, {
      provider: 's3', bucket: 'kixima', accessKey: 'k', secretKey: 's', missing: [],
      endpoint: 'https://proj.supabase.co/storage/v1/s3', publicUrl: undefined,
    });
    await expect(
      storageService.saveFile({ buffer: IMG, originalname: 'x.png', mimetype: 'image/png', keyHint: 'k', folder: 'catalog' }),
    ).rejects.toThrow(/STORAGE_ACCESS_KEY e STORAGE_SECRET_KEY/);
  });
});
