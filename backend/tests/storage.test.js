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
