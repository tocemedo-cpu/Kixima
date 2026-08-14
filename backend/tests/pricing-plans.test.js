// tests/pricing-plans.test.js
// Modelo comercial: Taxa KIXIMA em USD (8$/PO até 11.500$, 0,20% acima;
// 15$/fatura), dimensão da empresa (MPME) e planos BÁSICO/PRO com o ERP
// exclusivo do PRO.
const { auth, request, app, prisma, loginAll } = require('./helpers');
const fees = require('../src/services/platformFeeService');
const plans = require('../src/services/planService');

const PROOF = Buffer.from('%PDF-1.4 comprovativo de teste');

let tokens;
let product;

beforeAll(async () => {
  tokens = await loginAll();
  const catalog = await auth(tokens.comprador).get('/api/catalog');
  product = catalog.body[0];
});
afterAll(async () => { await prisma.$disconnect(); });

describe('Taxa KIXIMA (USD, com limiar)', () => {
  test('até 11.500 USD por transação: 8 USD por PO + 15 USD por fatura', () => {
    expect(fees.compute(1, 5000)).toMatchObject({ perPo: 8, perInvoice: 15, amount: 23, currency: 'USD', basis: 'FIXO' });
    // No próprio limiar ainda é o valor fixo.
    expect(fees.compute(1, 11500)).toMatchObject({ perPo: 8, amount: 23, basis: 'FIXO' });
  });

  test('acima de 11.500 USD: 0,20% cobrado no fim, INCLUINDO a PO e a fatura', () => {
    const f = fees.compute(1, 20000);
    expect(f.basis).toBe('PERCENTUAL');
    expect(f.perPo).toBe(40);        // 0,20% × 20.000
    expect(f.perInvoice).toBe(0);    // a percentagem já inclui a parcela da fatura
    expect(f.amount).toBe(40);       // não se somam os 8 USD nem os 15 USD
  });

  test('fatura consolidada: a parcela por PO conta N vezes, a da fatura só uma', () => {
    const f = fees.compute(3, 1000);
    expect(f.amount).toBe(3 * 8 + 15);
  });

  test('converte Kwanzas para USD ao câmbio configurado', () => {
    const rate = fees.fxRate();
    expect(fees.toUsd(rate * 100, 'AOA')).toBe(100);
    expect(fees.toUsd(250, 'USD')).toBe(250);
  });

  test('o pagamento gera a taxa em USD, com base e câmbio registados', async () => {
    const created = await auth(tokens.comprador)
      .post('/api/purchase-orders')
      .send({ supplierCompanyId: product.supplierId, items: [{ productId: product.id, quantity: 1 }] });
    const po = created.body;
    await auth(tokens.companyAdmin).patch(`/api/purchase-orders/${po.id}/approve`);
    await auth(tokens.fornecedor).patch(`/api/purchase-orders/${po.id}/accept`);
    const full = await auth(tokens.financeiro).get(`/api/purchase-orders/${po.id}`);
    await auth(tokens.financeiro)
      .post(`/api/payments/invoices/${full.body.invoice.id}/pay`)
      .attach('proof', PROOF, 'comprovativo.pdf');

    const fee = await prisma.platformFee.findUnique({ where: { invoiceId: full.body.invoice.id } });
    expect(fee).toBeTruthy();
    expect(fee.currency).toBe('USD');
    expect(['FIXO', 'PERCENTUAL']).toContain(fee.basis);
    expect(Number(fee.fxRate)).toBeGreaterThan(0);
    expect(Number(fee.poValueUsd)).toBeGreaterThan(0);
    // Abaixo do limiar cobra-se a parcela da fatura; acima, ela vem incluída
    // nos 0,20% e fica a zero.
    expect(Number(fee.perInvoice)).toBe(fee.basis === 'PERCENTUAL' ? 0 : 15);
  });
});

describe('Dimensão da empresa e planos', () => {
  test('classifica pelo critério MPME (trabalhadores e volume de negócios)', () => {
    expect(plans.classify({ employees: 5, annualRevenueUsd: 200_000 })).toBe('MICRO');
    expect(plans.classify({ employees: 50, annualRevenueUsd: 2_000_000 })).toBe('PEQUENA');
    expect(plans.classify({ employees: 150, annualRevenueUsd: 8_000_000 })).toBe('MEDIA');
    expect(plans.classify({ employees: 300 })).toBe('GRANDE');
    // O critério mais exigente manda: poucos trabalhadores mas faturação alta.
    expect(plans.classify({ employees: 20, annualRevenueUsd: 50_000_000 })).toBe('GRANDE');
  });

  test('grandes empresas exigem o plano PRO; as restantes entram no BASE', () => {
    expect(plans.requiredPlan('GRANDE')).toBe('PRO');
    expect(plans.requiredPlan('PEQUENA')).toBe('BASE');
    expect(plans.planAllowed('GRANDE', 'BASE')).toBe(false);
    expect(plans.planAllowed('GRANDE', 'CORE')).toBe(false);
    expect(plans.planAllowed('GRANDE', 'PRO')).toBe(true);
    // Subir de plano é sempre permitido, seja qual for a dimensão.
    expect(plans.planAllowed('PEQUENA', 'PRO')).toBe(true);
    expect(plans.planAllowed('PEQUENA', 'CORE')).toBe(true);
  });

  test('a integração com ERP é exclusiva do PRO', () => {
    expect(plans.hasFeature('BASE', 'erpIntegration')).toBe(false);
    expect(plans.hasFeature('CORE', 'erpIntegration')).toBe(false);
    expect(plans.hasFeature('PRO', 'erpIntegration')).toBe(true);
  });

  // O plano de dois degraus. As empresas foram migradas para CORE; um plano
  // esquecido não pode tirar funcionalidades a quem as tinha.
  test('BASICO continua a valer como CORE', () => {
    expect(plans.normalizarPlano('BASICO')).toBe('CORE');
    expect(plans.features('BASICO')).toEqual(plans.features('CORE'));
  });

  // A regra que decide o desenho todo dos planos.
  test('o catálogo NUNCA tem limite de itens, em plano nenhum', () => {
    for (const plano of plans.ESCADA) {
      expect(plans.limite(plano, 'itensNoCatalogo')).toBe(plans.ILIMITADO);
    }
  });

  test('o que se limita é a intensidade de uso, não o volume do catálogo', () => {
    expect(plans.limite('BASE', 'cotacoesPorMes')).toBe(3);
    expect(plans.limite('CORE', 'cotacoesPorMes')).toBe(20);
    expect(plans.limite('PRO', 'cotacoesPorMes')).toBe(plans.ILIMITADO);

    expect(plans.limite('BASE', 'lugaresIncluidos')).toBe(2);
    expect(plans.limite('CORE', 'lugaresIncluidos')).toBe(5);
    expect(plans.limite('PRO', 'lugaresIncluidos')).toBe(plans.ILIMITADO);
  });

  test('a mensagem do limite diz o número atual e o do plano', () => {
    expect(() => plans.assertLimite({ plan: 'BASE' }, 'lugaresIncluidos', 2, 'lugares'))
      .toThrow(/inclui 2 lugares.*Já tem 2/s);
    // Abaixo do limite passa; ilimitado nunca lança.
    expect(() => plans.assertLimite({ plan: 'BASE' }, 'lugaresIncluidos', 1, 'lugares')).not.toThrow();
    expect(() => plans.assertLimite({ plan: 'PRO' }, 'lugaresIncluidos', 9999, 'lugares')).not.toThrow();
  });

  test('custo mensal de acesso = utilizadores ativos × preço por utilizador (teto 100 USD)', () => {
    expect(plans.monthlyAccessCost({ activeUsers: 12, seatPriceUsd: 100 })).toMatchObject({ amountUsd: 1200, currency: 'USD' });
    // O teto é respeitado mesmo que se tente configurar acima.
    expect(plans.monthlyAccessCost({ activeUsers: 2, seatPriceUsd: 500 }).seatPriceUsd).toBe(100);
  });
});

describe('Gestão do plano (Admin do Sistema)', () => {
  let companyId;
  beforeAll(async () => {
    const me = await auth(tokens.fornecedor).get('/api/auth/me');
    companyId = me.body.user.companyId;
  });

  test('o Admin define dimensão, plano e preço por utilizador', async () => {
    const res = await auth(tokens.adminSistema)
      .put(`/api/companies/${companyId}/plan`)
      .send({ size: 'GRANDE', plan: 'PRO', seatPriceUsd: 80 });
    expect(res.status).toBe(200);
    expect(res.body.size).toBe('GRANDE');
    expect(res.body.plan).toBe('PRO');
    expect(Number(res.body.seatPriceUsd)).toBe(80);
  });

  test('uma empresa GRANDE não pode ficar no plano BÁSICO', async () => {
    const res = await auth(tokens.adminSistema)
      .put(`/api/companies/${companyId}/plan`)
      .send({ size: 'GRANDE', plan: 'BASICO' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/PRO/);
  });

  test('o preço por utilizador não pode exceder o teto de 100 USD', async () => {
    const res = await auth(tokens.adminSistema)
      .put(`/api/companies/${companyId}/plan`)
      .send({ seatPriceUsd: 250 });
    expect(res.status).toBe(422);
  });

  test('a empresa consulta a sua subscrição (plano, utilizadores e custo mensal)', async () => {
    const res = await auth(tokens.fornecedor).get(`/api/companies/${companyId}/subscription`);
    expect(res.status).toBe(200);
    expect(res.body.company.plan).toBe('PRO');
    expect(res.body.monthly.currency).toBe('USD');
    expect(res.body.monthly.amountUsd).toBe(res.body.activeUsers * Number(res.body.company.seatPriceUsd));
    expect(res.body.features.erpIntegration).toBe(true);
  });

  test('só o Admin do Sistema altera o plano', async () => {
    const res = await auth(tokens.companyAdmin).put(`/api/companies/${companyId}/plan`).send({ plan: 'PRO' });
    expect(res.status).toBe(403);
  });

  test('no plano BÁSICO a configuração de ERP é recusada; no PRO é permitida', async () => {
    // Desce para BÁSICO (empresa pequena) e tenta configurar o ERP.
    await auth(tokens.adminSistema).put(`/api/companies/${companyId}/plan`).send({ size: 'PEQUENA', plan: 'BASICO' });
    const barrado = await auth(tokens.adminSistema)
      .put(`/api/companies/${companyId}/erp-config`)
      .send({ erp: 'SAP_S4HANA', config: { baseUrl: 'https://erp.example.com', apiKey: 'x' } });
    expect(barrado.status).toBe(400);
    expect(barrado.body.error.message).toMatch(/PRO/);

    // Volta ao PRO: deixa de estar barrado PELO PLANO (pode falhar noutra
    // regra — ex.: campos obrigatórios do ERP —, mas já não por subscrição).
    await auth(tokens.adminSistema).put(`/api/companies/${companyId}/plan`).send({ size: 'GRANDE', plan: 'PRO' });
    const permitido = await auth(tokens.adminSistema)
      .put(`/api/companies/${companyId}/erp-config`)
      .send({ erp: 'SAP_S4HANA', config: { baseUrl: 'https://erp.example.com', apiKey: 'x' } });
    expect(permitido.body?.error?.message || '').not.toMatch(/plano PRO/);
  });
});

describe('Supplier Development', () => {
  let reference;

  test('a taxa de acesso é a das pequenas empresas (100 USD) e é devida na submissão', () => {
    // No momento da candidatura ainda não há diagnóstico: a taxa de entrada é
    // sempre a de tabela, seja qual for a dimensão do candidato.
    expect(plans.supplierDevAccessFee()).toMatchObject({
      amountUsd: 100, currency: 'USD', dueOnSubmission: true, remainderCustom: true,
    });
  });

  test('a taxa é publicada antes da submissão, para o candidato a ver', async () => {
    const res = await request(app).get('/api/supplier-development/fee');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ amountUsd: 100, currency: 'USD', dueOnSubmission: true });
  });

  test('qualquer empresa se candidata pela página pública (sem conta)', async () => {
    const res = await request(app)
      .post('/api/supplier-development/requests')
      .send({
        companyName: 'Metalúrgica do Kwanza, Lda',
        contactName: 'Joana Silva',
        contactEmail: 'joana@metalkwanza.co.ao',
        province: 'Luanda',
        sector: 'Metalomecânica',
        employees: 24,
        track: 'AMBOS',
        needs: 'Precisamos de apoio no licenciamento e de um parceiro internacional para soldadura certificada.',
        feeAccepted: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^SD-/);
    expect(res.body.status).toBe('RECEBIDA');
    // A taxa fica cobrada no acto da submissão e emitida por liquidar.
    expect(res.body.accessFee).toMatchObject({
      amountUsd: 100, currency: 'USD', dueOnSubmission: true, status: 'PENDENTE',
    });
    reference = res.body.reference;
  });

  test('a candidatura é validada (email e nome obrigatórios)', async () => {
    const res = await request(app)
      .post('/api/supplier-development/requests')
      .send({ companyName: 'X', contactName: 'Y', contactEmail: 'nao-e-email', feeAccepted: true });
    expect(res.status).toBe(422);
  });

  test('não se submete sem aceitar a taxa cobrada na submissão', async () => {
    const res = await request(app)
      .post('/api/supplier-development/requests')
      .send({ companyName: 'Sem Aceite, Lda', contactName: 'Ana', contactEmail: 'ana@semaceite.co.ao' });
    expect(res.status).toBe(422);
  });

  test('a empresa acompanha o estado pela referência, sem conta', async () => {
    const res = await request(app).get(`/api/supplier-development/requests/${reference}/track`);
    expect(res.status).toBe(200);
    expect(res.body.companyName).toMatch(/Metalúrgica/);
    // O candidato vê o estado da taxa que lhe foi cobrada na submissão.
    expect(Number(res.body.accessFeeUsd)).toBe(100);
    expect(res.body.feeStatus).toBe('PENDENTE');
    // A consulta pública não expõe notas internas nem contactos.
    expect(res.body.adminNotes).toBeUndefined();
    expect(res.body.contactEmail).toBeUndefined();
  });

  test('o Admin do Sistema lista e acompanha as candidaturas; outros perfis não', async () => {
    const lista = await auth(tokens.adminSistema).get('/api/supplier-development/requests');
    expect(lista.status).toBe(200);
    expect(lista.body.items.some((r) => r.reference === reference)).toBe(true);
    expect(lista.body.kpis.total).toBeGreaterThan(0);

    const alvo = lista.body.items.find((r) => r.reference === reference);
    const upd = await auth(tokens.adminSistema)
      .patch(`/api/supplier-development/requests/${alvo.id}`)
      .send({ status: 'EM_ACOMPANHAMENTO', adminNotes: 'Reunião marcada com parceiro norueguês.' });
    expect(upd.status).toBe(200);
    expect(upd.body.status).toBe('EM_ACOMPANHAMENTO');
    expect(upd.body.handledById).toBeTruthy();

    const barrado = await auth(tokens.comprador).get('/api/supplier-development/requests');
    expect(barrado.status).toBe(403);
  });

  test('o Admin regista a receção da taxa e orçamenta o restante do programa', async () => {
    const lista = await auth(tokens.adminSistema).get('/api/supplier-development/requests');
    const alvo = lista.body.items.find((r) => r.reference === reference);
    // Antes de a KIXIMA orçamentar, o restante fica marcado como por definir.
    expect(alvo.customPricing).toBe(true);
    expect(lista.body.kpis.taxasPendentes).toBeGreaterThan(0);

    const pago = await auth(tokens.adminSistema)
      .patch(`/api/supplier-development/requests/${alvo.id}`)
      .send({ feeStatus: 'COBRADO' });
    expect(pago.status).toBe(200);
    expect(pago.body.feeStatus).toBe('COBRADO');
    expect(pago.body.feePaidAt).toBeTruthy();

    const orcamento = await auth(tokens.adminSistema)
      .patch(`/api/supplier-development/requests/${alvo.id}`)
      .send({ programFeeUsd: 4500 });
    expect(orcamento.status).toBe(200);
    expect(Number(orcamento.body.programFeeUsd)).toBe(4500);
    expect(orcamento.body.customPricing).toBe(false);
  });
});

// Os limites do plano, aplicados onde a pessoa os encontra.
//
// O que se protege aqui não é cada limite em si: é a REGRA que decide quais
// existem. Limita-se a intensidade de uso — lugares, cotações, média por item,
// funcionalidades de escala. Nunca o número de itens no catálogo, porque a
// densidade do catálogo é o que faz o marketplace valer, e cortá-la cortaria a
// Taxa KIXIMA, que é a receita maior.
describe('Limites do plano, na prática', () => {
  const request = require('supertest');
  const app = require('../src/app');
  const prisma = require('../src/config/database');
  const { loginAll, auth } = require('./helpers');

  let tokens;
  let fornecedora;
  let planoOriginal;

  beforeAll(async () => {
    tokens = await loginAll();
    fornecedora = await prisma.company.findFirst({ where: { type: 'FORNECEDOR' } });
    planoOriginal = fornecedora.plan;
  });
  afterEach(async () => {
    await prisma.company.update({ where: { id: fornecedora.id }, data: { plan: planoOriginal } });
  });

  const porPlano = (plan) => prisma.company.update({ where: { id: fornecedora.id }, data: { plan } });

  test('os kits são do CORE para cima, e a mensagem diz qual', async () => {
    await porPlano('BASE');
    // Payload VÁLIDO de propósito: a validação corre antes da guarda do plano,
    // e um payload inválido daria 422 sem nunca chegar à regra em teste.
    const produto = await prisma.product.findFirst({ where: { supplierId: fornecedora.id } });
    const res = await auth(tokens.fornecedor).post('/api/kits')
      .send({ name: `Kit de teste ${Date.now()}`, items: [{ productId: produto.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Kits/);
    expect(res.body.error.message).toMatch(/plano CORE/);
  });

  test('o carregamento em massa é do PRO, e não se confunde com publicar item a item', async () => {
    await porPlano('CORE');
    const res = await auth(tokens.fornecedor).post('/api/catalog/import')
      .attach('file', Buffer.from('nao-importa'), 'catalogo.xlsx');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Carregamento em massa/);
    expect(res.body.error.message).toMatch(/plano PRO/);
  });

  // A regra que sustenta o desenho todo.
  test('publicar itens NUNCA é limitado — nem no plano mais baixo', async () => {
    await porPlano('BASE');
    const antes = await prisma.product.count({ where: { supplierId: fornecedora.id } });

    const res = await auth(tokens.fornecedor).post('/api/catalog').send({
      name: `Item sem limite ${Date.now()}`,
      description: 'Publicado no plano de entrada.',
      category: 'EQUIPAMENTO',
      unitPrice: 1000,
      currency: 'AOA',
      unit: 'UN',
      stock: 5,
    });
    expect(res.status).toBe(201);
    expect(await prisma.product.count({ where: { supplierId: fornecedora.id } })).toBe(antes + 1);
  });

  test('a galeria é que é limitada, e diz quantas o plano inclui', async () => {
    await porPlano('BASE');   // 3 imagens
    const plans = require('../src/services/planService');
    const empresa = { plan: 'BASE' };
    // 3 cabe; 4 não.
    expect(() => plans.assertLimite(empresa, 'imagensPorItem', 2, 'imagens por item')).not.toThrow();
    expect(() => plans.assertLimite(empresa, 'imagensPorItem', 3, 'imagens por item'))
      .toThrow(/inclui 3 imagens por item/);
  });
});

// A posição na pesquisa é uma coluna DERIVADA do plano — e colunas derivadas
// dessincronizam-se. Já aconteceu aqui: o seed escrevia o plano diretamente e
// deixava a posição a zero, com uma empresa a pagar Core e a aparecer no fundo
// da pesquisa. Este teste é a rede: percorre TODAS as empresas e exige que a
// posição corresponda ao plano, seja qual for o caminho por onde foram criadas.
describe('A posição na pesquisa acompanha o plano', () => {
  const prisma = require('../src/config/database');
  const plans = require('../src/services/planService');

  test('nenhuma empresa tem a posição dessincronizada do plano', async () => {
    const empresas = await prisma.company.findMany({ select: { name: true, plan: true, searchRank: true } });
    expect(empresas.length).toBeGreaterThan(0);
    const erradas = empresas.filter((e) => e.searchRank !== plans.rankDoPlano(e.plan));
    expect(erradas.map((e) => `${e.name}: plano ${e.plan} mas posição ${e.searchRank}`)).toEqual([]);
  });

  test('a escada de posições é a esperada, e o Pro leva selo', () => {
    expect(plans.rankDoPlano('BASE')).toBe(0);
    expect(plans.rankDoPlano('CORE')).toBe(1);
    expect(plans.rankDoPlano('PRO')).toBe(2);
    expect(plans.rankDoPlano('BASICO')).toBe(1);          // sinónimo de CORE
    expect(plans.features('PRO').selo).toBe(true);
    expect(plans.features('CORE').selo).toBe(false);
  });

  // A decisão de produto que impede a ordenação de mentir.
  test('o plano SÓ entra na relevância — as ordenações explícitas ficam puras', () => {
    const fonte = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'src/services/marketplaceService.js'), 'utf8',
    );
    const sorts = fonte.slice(fonte.indexOf('const SORTS'), fonte.indexOf('const SUPPLIER'));
    // Uma única ordenação usa o rank do plano: a relevância.
    expect((sorts.match(/RANK_DO_PLANO/g) || []).length).toBe(1);
    expect(sorts).toMatch(/relevantes: \[RANK_DO_PLANO/);
    // E o preço continua a ser só o preço.
    expect(sorts).toMatch(/preco_asc: \[\{ unitPrice: 'asc' \}\]/);
  });
});

// O efeito real: subir de plano muda a posição no marketplace. Sem isto, a
// linha "Posição na pesquisa" da tabela de preços seria uma promessa vazia.
describe('Subir de plano muda a posição no marketplace', () => {
  const prisma = require('../src/config/database');
  const marketplace = require('../src/services/marketplaceService');

  let fornecedora;
  let outra;
  let original;

  beforeAll(async () => {
    fornecedora = await prisma.company.findFirst({ where: { type: 'FORNECEDOR' } });
    original = { plan: fornecedora.plan, searchRank: fornecedora.searchRank };
    // Uma segunda fornecedora, para haver ordenação que se veja.
    outra = await prisma.company.create({
      data: {
        name: `Concorrente ${Date.now()}`, taxId: `${Date.now()}`, type: 'FORNECEDOR',
        contactEmail: `c${Date.now()}@x.ao`, status: 'APROVADA', plan: 'BASE', searchRank: 0,
      },
    });
    // Clona um produto existente em vez de o construir campo a campo: assim o
    // teste não parte de cada vez que o modelo Product ganha um campo obrigatório.
    const modelo = await prisma.product.findFirst({ where: { active: true } });
    const { id, createdAt, updatedAt, slug, supplierId, ...campos } = modelo;
    await prisma.product.create({
      data: { ...campos, supplierId: outra.id, slug: `concorrente-${Date.now()}`, name: 'Produto da concorrente' },
    });
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { supplierId: outra.id } });
    await prisma.company.delete({ where: { id: outra.id } });
    await prisma.company.update({ where: { id: fornecedora.id }, data: original });
  });

  async function posicaoDe(companyId) {
    const r = await marketplace.search({ limit: 48, sort: 'relevantes' });
    return r.items.findIndex((p) => p.supplier?.id === companyId);
  }

  test('no Entrada fica atrás; no Pro passa à frente', async () => {
    await prisma.company.update({ where: { id: fornecedora.id }, data: { plan: 'BASE', searchRank: 0 } });
    const noEntrada = await posicaoDe(outra.id);

    await prisma.company.update({ where: { id: outra.id }, data: { plan: 'PRO', searchRank: 2 } });
    const noPro = await posicaoDe(outra.id);

    expect(noPro).toBeGreaterThanOrEqual(0);
    expect(noPro).toBeLessThan(noEntrada === -1 ? Number.MAX_SAFE_INTEGER : noEntrada);
  });

  // E o catálogo continua a ser publicado por inteiro em qualquer plano — é
  // a posição que muda, não o direito a estar lá.
  test('o item do plano de entrada continua no catálogo, só mais abaixo', async () => {
    await prisma.company.update({ where: { id: outra.id }, data: { plan: 'BASE', searchRank: 0 } });
    expect(await posicaoDe(outra.id)).toBeGreaterThanOrEqual(0);
  });
});

// Os preços vivem no código para a página não os ter escritos à mão. Uma tabela
// de preços que diverge do que a plataforma cobra é a pior espécie de bug:
// ninguém a testa, ninguém dá por ela, e quem descobre é o cliente que pagou um
// valor diferente do que leu.
describe('Preços', () => {
  const plans = require('../src/services/planService');
  const request = require('supertest');
  const app = require('../src/app');

  test('cada plano tem preço, período e o equivalente mensal calculado', () => {
    for (const plano of plans.ESCADA) {
      const p = plans.preco(plano);
      expect(p.valorUsd).toBeGreaterThan(0);
      expect(Object.keys(plans.MESES_DO_PERIODO)).toContain(p.periodo);
      expect(p.porMesUsd).toBeCloseTo(p.valorUsd / p.meses, 2);
    }
  });

  // A armadilha de comunicação: 100 no Base e 100 no Core são valores MUITO
  // diferentes, e quem passa os olhos pela tabela vê o mesmo número duas vezes.
  test('o Base e o Core têm o mesmo valor mas períodos diferentes — o mensal desfaz o equívoco', () => {
    const base = plans.preco('BASE');
    const core = plans.preco('CORE');
    expect(base.valorUsd).toBe(core.valorUsd);          // o mesmo "100 USD"
    expect(base.periodo).not.toBe(core.periodo);        // períodos diferentes
    expect(core.porMesUsd).toBeGreaterThan(base.porMesUsd * 2.5);
  });

  // Penhascos matam upgrades: quem cresce faz as contas e fica onde está.
  test('a escada sobe sem penhascos — nenhum degrau multiplica por mais de 10', () => {
    const mensal = plans.ESCADA.map((p) => plans.preco(p).porMesUsd);
    for (let i = 1; i < mensal.length; i++) {
      const salto = mensal[i] / mensal[i - 1];
      expect(salto).toBeGreaterThan(1);      // sobe mesmo
      expect(salto).toBeLessThanOrEqual(10); // e não é um precipício
    }
  });

  test('a tabela pública traz os planos e a taxa por transação', async () => {
    const res = await request(app).get('/api/planos');
    expect(res.status).toBe(200);
    expect(res.body.planos.map((p) => p.plano)).toEqual(plans.ESCADA);
    for (const linha of res.body.planos) {
      expect(linha.preco.porMesUsd).toBeGreaterThan(0);
      // O catálogo nunca é limitado — e a tabela pública tem de o dizer.
      expect(linha.features.itensNoCatalogo).toBeNull();
    }
    // A subscrição não é o custo todo: a taxa por transação é a outra metade.
    expect(res.body.taxaPorTransacao.porOrdemUsd).toBeGreaterThan(0);
    expect(res.body.taxaPorTransacao.porFaturaUsd).toBeGreaterThan(0);
  });

  test('é pública — quem ainda não tem conta precisa de ver os preços', async () => {
    const res = await request(app).get('/api/planos');
    expect(res.status).toBe(200);
  });
});
