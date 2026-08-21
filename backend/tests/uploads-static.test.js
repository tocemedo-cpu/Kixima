// tests/uploads-static.test.js
// Um ficheiro em modo 'local' (ver storageService.js) vive no disco do
// contentor, que o Render apaga a cada reinício/deploy — o registo na base
// sobrevive, o ficheiro não. Antes disto, um pedido a um ficheiro assim
// perdido caía no notFoundHandler genérico e respondia "ROUTE_NOT_FOUND:
// Rota GET /api/uploads/... não existe", que parece um erro de programação a
// quem só está a tentar ver um documento. Isto confirma a mensagem certa.
const fs = require('fs');
const path = require('path');
const { request, app } = require('./helpers');
const { uploadsDir } = require('../src/services/storageService');

describe('GET /api/uploads/:ficheiro', () => {
  const nomeExistente = 'teste-uploads-static-existe.txt';
  const caminhoExistente = path.join(uploadsDir, nomeExistente);

  beforeAll(() => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(caminhoExistente, 'conteudo de teste');
  });

  afterAll(() => {
    fs.rmSync(caminhoExistente, { force: true });
  });

  test('ficheiro que existe no disco é servido normalmente', async () => {
    const res = await request(app).get(`/api/uploads/${nomeExistente}`);
    expect(res.status).toBe(200);
    expect(res.text).toBe('conteudo de teste');
  });

  test('ficheiro perdido (ex.: apagado num reinício) devolve FILE_NOT_FOUND, não ROUTE_NOT_FOUND', async () => {
    const res = await request(app).get('/api/uploads/121212-CERTIDAOCOMERCIAL-1784824319068.jpeg');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('FILE_NOT_FOUND');
    expect(res.body.error.message).not.toMatch(/Rota/);
  });
});
