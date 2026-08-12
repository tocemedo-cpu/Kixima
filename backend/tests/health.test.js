// tests/health.test.js
// Sondas de arranque. A distinção importa: o /health diz que o PROCESSO está
// vivo; o /ready diz que a aplicação consegue mesmo SERVIR pedidos.
//
// Existe porque o health check apontava para uma resposta fixa: respondia "ok"
// com a base de dados inacessível, e o Render continuava a encaminhar tráfego
// para uma aplicação que rebentava em todos os pedidos.
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

describe('Sondas de saúde', () => {
  test('/health responde sem tocar na base', async () => {
    const espia = jest.spyOn(prisma, '$queryRaw');
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  test('/ready confirma a base e reporta a latência', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
    expect(typeof res.body.latencyMs).toBe('number');
  });

  test('com a base inacessível, /ready devolve 503 e diz porquê', async () => {
    const espia = jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error("Can't reach database server"));
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.database).toBe('inacessivel');
    expect(res.body.detail).toMatch(/reach database/);
    espia.mockRestore();
  });

  test('a sonda não fica pendurada: falha ao fim de poucos segundos', async () => {
    // Um health check que nunca responde é tão mau como um que mente — o
    // orquestrador fica à espera em vez de retirar a instância.
    const espia = jest.spyOn(prisma, '$queryRaw').mockImplementationOnce(() => new Promise(() => {}));
    const inicio = Date.now();
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.detail).toMatch(/timeout/i);
    expect(Date.now() - inicio).toBeLessThan(6000);
    espia.mockRestore();
  }, 12000);
});

describe('Documento em formato errado', () => {
  // Um formato errado é culpa do pedido (422), não uma avaria da aplicação.
  // Antes lançava um Error genérico: quem enviava um .txt como comprovativo
  // recebia "ocorreu um erro interno" e o caso entrava no Sentry como falha.
  const { loginAll, auth, prisma: p } = require('./helpers');

  test('recusa com 422 e explica o formato aceite', async () => {
    const tokens = await loginAll();
    const fatura = await p.invoice.findFirst({ where: { status: 'PENDENTE' } });
    if (!fatura) return;
    const res = await auth(tokens.financeiro)
      .post(`/api/payments/invoices/${fatura.id}/pay`)
      .attach('proof', Buffer.from('nao sou um pdf'), { filename: 'nota.txt', contentType: 'text/plain' });
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).toMatch(/PDF ou imagem/);
  });
});
