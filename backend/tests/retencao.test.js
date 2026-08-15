// tests/retencao.test.js
// Política de retenção: o que se apaga, o que NÃO se apaga, e a coerência
// entre o que a página promete e o que a limpeza faz.
const { request, app, prisma } = require('./helpers');
const retencao = require('../src/services/retencaoService');

afterAll(async () => { await prisma.$disconnect(); });

describe('A política publicada', () => {
  test('é servida e diz o porquê de cada prazo', async () => {
    const res = await request(app).get('/api/retencao');
    expect(res.status).toBe(200);
    expect(res.body.politica.length).toBeGreaterThan(0);
    for (const p of res.body.politica) {
      expect(p.o_que).toBeTruthy();
      expect(p.porque).toBeTruthy();     // um prazo sem justificação não se avalia
      expect(p.prazo).toBeTruthy();
    }
  });

  test('é pública — quem ainda não tem conta tem de a poder ler antes de a criar', async () => {
    const res = await request(app).get('/api/retencao');
    expect(res.status).not.toBe(401);
  });

  test('não escreve "1 dias"', () => {
    expect(retencao.politica().map((p) => p.prazo).join(' ')).not.toMatch(/\b1 dias\b/);
  });

  test('declara que o financeiro e o trilho NÃO se apagam', () => {
    const financeiro = retencao.politica().find((p) => p.id === 'financeiro');
    expect(financeiro.dias).toBeNull();
    expect(financeiro.porque).toMatch(/obrigação legal/i);
  });
});

describe('A limpeza', () => {
  test('apaga notificações lidas para lá do prazo', async () => {
    const user = await prisma.user.findFirst({ where: { email: 'comprador@petroangola.co.ao' } });
    const velha = new Date(Date.now() - (retencao.prazoDe('notificacoes') + 10) * 24 * 60 * 60 * 1000);
    const n = await prisma.notification.create({
      data: { userId: user.id, type: 'PO_APROVADA', title: 'Velha', message: 'x', readAt: velha },
    });
    await prisma.$executeRaw`UPDATE notifications SET read_at = ${velha} WHERE id = ${n.id}`;

    await retencao.limpar();
    expect(await prisma.notification.findUnique({ where: { id: n.id } })).toBeNull();
  });

  test('NÃO apaga notificações por ler, por muito antigas que sejam', async () => {
    const user = await prisma.user.findFirst({ where: { email: 'comprador@petroangola.co.ao' } });
    const n = await prisma.notification.create({
      data: { userId: user.id, type: 'PO_APROVADA', title: 'Por ler', message: 'x' },
    });
    await prisma.$executeRaw`UPDATE notifications SET created_at = ${new Date('2020-01-01')} WHERE id = ${n.id}`;

    await retencao.limpar();
    // Por ler é por ler: apagá-la seria decidir pela pessoa que ela não
    // precisava de a ver.
    expect(await prisma.notification.findUnique({ where: { id: n.id } })).not.toBeNull();
    await prisma.notification.delete({ where: { id: n.id } });
  });

  test('NUNCA toca em ordens, faturas ou no trilho de auditoria', async () => {
    const antes = await Promise.all([
      prisma.purchaseOrder.count(), prisma.invoice.count(),
      prisma.payment.count(), prisma.auditLog.count(),
    ]);
    await retencao.limpar();
    const depois = await Promise.all([
      prisma.purchaseOrder.count(), prisma.invoice.count(),
      prisma.payment.count(), prisma.auditLog.count(),
    ]);
    expect(depois).toEqual(antes);
  });

  test('correr duas vezes seguidas não é diferente de correr uma', async () => {
    await retencao.limpar();
    const segunda = await retencao.limpar();
    expect(segunda.total).toBe(0);
  });
});
