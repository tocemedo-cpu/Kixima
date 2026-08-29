// tests/assinatura-gateway.test.js
// Pagamento automático da subscrição (EMIS/PayPay/bancos) — planos BASE e
// CORE só, nunca o PRO. O que isto protege:
//   1. Sem credenciais reais, iniciar um pagamento FALHA — nunca finge.
//   2. O PRO nunca aceita um canal automático, só transferência manual.
//   3. confirmarViaGateway() ativa o plano tal como o confirmar() manual —
//      mesma conta, sem exigir comprovativo — e é idempotente (um callback
//      duplicado não tenta confirmar duas vezes).
const bcrypt = require('bcryptjs');
const { request, app, prisma, auth, login, PASSWORD } = require('./helpers');
const assinaturaService = require('../src/services/assinaturaService');

let companyId;
let userId;
let token;
const EMAIL = `admin.gateway.${Date.now()}@teste.co.ao`;

beforeAll(async () => {
  const company = await prisma.company.create({
    data: {
      name: 'Empresa Gateway Teste Lda',
      taxId: `TAX-GATEWAY-${Date.now()}`,
      type: 'CLIENTE',
      status: 'APROVADA',
      contactEmail: 'geral@gateway-teste.co.ao',
      // size/plan ficam nos valores por omissão (PEQUENA/BASE) — qualificam
      // para BASE e CORE sem precisar de mais nada.
    },
  });
  companyId = company.id;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: { name: 'Admin Gateway', email: EMAIL, passwordHash, role: 'COMPANY_ADMIN', companyId, active: true },
  });
  userId = user.id;
  token = await login(EMAIL);
});

afterAll(async () => {
  await prisma.planoCobranca.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.planoCobranca.deleteMany({ where: { companyId } });
});

async function pedir(plano) {
  const res = await auth(token).post('/api/assinatura/pedir').send({ plano });
  expect(res.status).toBe(201);
  return res.body;
}

describe('GET /api/assinatura/canais', () => {
  test('exige sessão', async () => {
    const res = await request(app).get('/api/assinatura/canais');
    expect(res.status).toBe(401);
  });

  test('devolve os cinco canais automáticos, todos indisponíveis sem credenciais', async () => {
    const res = await auth(token).get('/api/assinatura/canais');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ['BAI', 'BFA', 'EMIS_MULTICAIXA', 'PAYPAY', 'STANDARD_BANK_ANGOLA'].sort(),
    );
    expect(Object.values(res.body).every((c) => c.disponivel === false)).toBe(true);
  });
});

describe('POST /api/assinatura/:id/pagar-com', () => {
  test('sem credenciais reais, recusa-se em vez de fingir sucesso', async () => {
    const cobranca = await pedir('CORE');
    const res = await auth(token).post(`/api/assinatura/${cobranca.id}/pagar-com`).send({ canal: 'EMIS_MULTICAIXA', telemovel: '900000000' });
    // Mensagem detalhada ("em falta: EMIS_BASE_URL...") fica só nos logs — um
    // 500 nunca expõe a mensagem interna ao pedido HTTP (ver errorHandler.js).
    // O teste que confirma a mensagem em si chama o serviço diretamente, abaixo.
    expect(res.status).toBe(500);

    // Não fica meio-iniciado: sem confirmação da EMIS, canal e referência não mudam.
    const depois = await prisma.planoCobranca.findUnique({ where: { id: cobranca.id } });
    expect(depois.canal).toBe('TRANSFERENCIA_MANUAL');
    expect(depois.referenciaExterna).toBeNull();
  });

  test('a mensagem diz exatamente o que falta (chamada direta ao serviço)', async () => {
    const cobranca = await pedir('CORE');
    await expect(assinaturaService.iniciarPagamentoGateway(companyId, cobranca.id, { canal: 'EMIS_MULTICAIXA', telemovel: '900000000' }))
      .rejects.toThrow(/não está configurado/i);
  });

  test('recusa um canal desconhecido', async () => {
    const cobranca = await pedir('CORE');
    const res = await auth(token).post(`/api/assinatura/${cobranca.id}/pagar-com`).send({ canal: 'CARTAO_MAGICO' });
    expect(res.status).toBe(422);
  });

  test('o plano PRO nunca aceita um canal automático — só transferência manual', async () => {
    const cobranca = await pedir('PRO');
    const res = await auth(token).post(`/api/assinatura/${cobranca.id}/pagar-com`).send({ canal: 'EMIS_MULTICAIXA', telemovel: '900000000' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/transferência bancária/i);
  });

  test('não paga a cobrança de outra empresa', async () => {
    const outraSenha = await bcrypt.hash(PASSWORD, 10);
    const outra = await prisma.company.create({
      data: { name: 'Outra Empresa Gateway Lda', taxId: `TAX-OUT-GW-${Date.now()}`, type: 'CLIENTE', status: 'APROVADA', contactEmail: 'x@outra.co.ao' },
    });
    const outroUser = await prisma.user.create({
      data: { name: 'Outro Admin', email: `outro.gateway.${Date.now()}@teste.co.ao`, passwordHash: outraSenha, role: 'COMPANY_ADMIN', companyId: outra.id, active: true },
    });
    try {
      const minhaCobranca = await pedir('CORE');
      const outroToken = await login(outroUser.email);
      const res = await auth(outroToken).post(`/api/assinatura/${minhaCobranca.id}/pagar-com`).send({ canal: 'EMIS_MULTICAIXA', telemovel: '900000000' });
      expect(res.status).toBe(403);
    } finally {
      await prisma.planoCobranca.deleteMany({ where: { companyId: outra.id } });
      await prisma.user.deleteMany({ where: { id: outroUser.id } });
      await prisma.company.deleteMany({ where: { id: outra.id } });
    }
  });
});

describe('confirmarViaGateway — o gateway confirmou, o plano ativa-se sozinho', () => {
  async function simularPagamentoIniciado(plano, canal = 'EMIS_MULTICAIXA') {
    const cobranca = await pedir(plano);
    // Simula o que iniciarPagamentoGateway teria gravado se a EMIS tivesse
    // credenciais reais — sem chamar o adaptador (que se recusa sem elas).
    return prisma.planoCobranca.update({
      where: { id: cobranca.id },
      data: { canal, referenciaExterna: `TXN-${cobranca.id}` },
    });
  }

  test('ativa o plano sem exigir comprovativo, e regista o canal na auditoria', async () => {
    const cobranca = await simularPagamentoIniciado('CORE');
    const confirmada = await assinaturaService.confirmarViaGateway(cobranca.id, {
      canal: 'EMIS_MULTICAIXA', referenciaExterna: cobranca.referenciaExterna,
    });
    expect(confirmada.status).toBe('CONFIRMADA');
    expect(confirmada.confirmadaPor).toBeNull(); // ninguém da KIXIMA carregou em nada

    const empresa = await prisma.company.findUnique({ where: { id: companyId } });
    expect(empresa.plan).toBe('CORE');
    expect(empresa.planoValidoAte).not.toBeNull();

    const auditoria = await prisma.auditLog.findFirst({
      where: { entityType: 'PlanoCobranca', entityId: cobranca.id, action: 'SUBSCRICAO_CONFIRMADA' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditoria.actorId).toBeNull();
    expect(auditoria.actorName).toMatch(/automático/i);
  });

  test('é idempotente — um callback duplicado não tenta confirmar outra vez', async () => {
    const cobranca = await simularPagamentoIniciado('BASE');
    const primeira = await assinaturaService.confirmarViaGateway(cobranca.id, {
      canal: 'EMIS_MULTICAIXA', referenciaExterna: cobranca.referenciaExterna,
    });
    const segunda = await assinaturaService.confirmarViaGateway(cobranca.id, {
      canal: 'EMIS_MULTICAIXA', referenciaExterna: cobranca.referenciaExterna,
    });
    expect(segunda.status).toBe('CONFIRMADA');
    expect(segunda.confirmadaEm.getTime()).toBe(primeira.confirmadaEm.getTime());
  });

  test('recusa um callback cuja referência não corresponde ao pagamento iniciado', async () => {
    const cobranca = await simularPagamentoIniciado('CORE');
    await expect(assinaturaService.confirmarViaGateway(cobranca.id, {
      canal: 'EMIS_MULTICAIXA', referenciaExterna: 'TXN-DE-OUTRO-PAGAMENTO',
    })).rejects.toThrow(/não corresponde/i);
  });

  test('recusa confirmar uma cobrança já cancelada', async () => {
    const cobranca = await simularPagamentoIniciado('CORE');
    await prisma.planoCobranca.update({ where: { id: cobranca.id }, data: { status: 'CANCELADA' } });
    await expect(assinaturaService.confirmarViaGateway(cobranca.id, {
      canal: 'EMIS_MULTICAIXA', referenciaExterna: cobranca.referenciaExterna,
    })).rejects.toThrow(/cancelada/i);
  });
});

describe('POST /api/webhooks/pagamento/:canal', () => {
  test('não exige autenticação — o gateway não tem sessão KIXIMA', async () => {
    const res = await request(app).post('/api/webhooks/pagamento/emis_multicaixa').send({ id: 'TXN-1' });
    // Sem credenciais reais o adaptador lança — o que importa aqui é que NÃO
    // seja 401 (a rota não pode exigir um token que o gateway nunca teria).
    expect(res.status).not.toBe(401);
  });

  test('canal desconhecido devolve 404 explícito', async () => {
    const res = await request(app).post('/api/webhooks/pagamento/banco-inventado').send({ id: 'TXN-1' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CANAL_DESCONHECIDO');
  });
});
