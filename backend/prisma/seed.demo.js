// prisma/seed.demo.js
// Dados de DEMONSTRAÇÃO/TESTE (1 cliente, 1 fornecedora, personas, catálogo).
// Usado APENAS pela suite de testes (tests/globalSetup.js). NÃO é executado em
// produção — o `npm run seed` cria só o Administrador do Sistema (ver seed.js).

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const taxService = require('../src/services/taxService');

const prisma = new PrismaClient();
const PASSWORD = 'Kixima@123';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const client = await prisma.company.create({
    data: {
      name: 'Petro Angola Operações, Lda',
      taxId: 'AO-CLI-0001',
      type: 'CLIENTE',
      contactEmail: 'contacto@petroangola.co.ao',
      status: 'APROVADA',
      approvedAt: new Date(),
    },
  });

  const supplier = await prisma.company.create({
    data: {
      name: 'Fornecedora Industrial Kianda, Lda',
      taxId: 'AO-FOR-0001',
      type: 'FORNECEDOR',
      contactEmail: 'vendas@kianda.co.ao',
      status: 'APROVADA',
      approvedAt: new Date(),
    },
  });

  const [comprador, companyAdmin, financeiro, fornecedorUser, adminSistema] = await Promise.all([
    prisma.user.create({
      data: { name: 'Ana Comprador', email: 'comprador@petroangola.co.ao', passwordHash, role: 'COMPRADOR', companyId: client.id },
    }),
    prisma.user.create({
      data: { name: 'Bruno Company Admin', email: 'admin@petroangola.co.ao', passwordHash, role: 'COMPANY_ADMIN', companyId: client.id },
    }),
    prisma.user.create({
      data: { name: 'Carla Financeiro', email: 'financeiro@petroangola.co.ao', passwordHash, role: 'FINANCEIRO', companyId: client.id },
    }),
    prisma.user.create({
      data: { name: 'Duarte Fornecedor', email: 'fornecedor@kianda.co.ao', passwordHash, role: 'FORNECEDOR', companyId: supplier.id },
    }),
    prisma.user.create({
      data: { name: 'Admin KIXIMA', email: 'admin@kixima.co.ao', passwordHash, role: 'ADMIN_SISTEMA', companyId: null },
    }),
  ]);

  // Documentos de credenciamento da empresa (tela Documentos da Empresa — CA).
  await prisma.companyDocument.createMany({
    data: [
      { companyId: client.id, type: 'CERTIDAO_COMERCIAL', fileUrl: '/api/uploads/demo-certidao.pdf', originalName: 'certidao-comercial.pdf' },
      { companyId: client.id, type: 'ALVARA_COMERCIAL', fileUrl: '/api/uploads/demo-alvara.pdf', originalName: 'alvara-comercial.pdf' },
      { companyId: supplier.id, type: 'CERTIDAO_COMERCIAL', fileUrl: '/api/uploads/demo-certidao2.pdf', originalName: 'certidao-kianda.pdf' },
      { companyId: supplier.id, type: 'LICENCA_ANPG', fileUrl: '/api/uploads/demo-anpg.pdf', originalName: 'licenca-anpg.pdf' },
    ],
  });

  await prisma.supplierToKiximaPolicy.create({
    data: {
      companyId: supplier.id,
      policyNumber: 'FOR-KIX-2026-001',
      insurer: 'ENSA Seguros',
      coverageAmount: 5_000_000,
      currency: 'AOA',
      status: 'APROVADA',
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2027-01-01'),
    },
  });

  await prisma.kiximaToClientPolicy.create({
    data: {
      companyId: client.id,
      policyNumber: 'KIX-CLI-2026-001',
      insurer: 'AAA Seguros',
      coverageAmount: 20_000_000,
      currency: 'AOA',
      issuedById: adminSistema.id,
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2027-01-01'),
    },
  });

  await prisma.product.createMany({
    data: [
      {
        supplierId: supplier.id,
        name: 'Válvula de esfera 4" API 6D',
        category: 'Válvulas',
        description: 'Válvula de esfera flangeada, corpo em aço carbono.',
        unitPrice: 850000,
        currency: 'AOA',
        leadTimeDays: 15,
        rating: 4.8,
        reviewCount: 28,
      },
      {
        supplierId: supplier.id,
        name: 'Mangueira hidráulica de alta pressão 2"',
        category: 'Hidráulica',
        description: 'Mangueira reforçada, 350 bar, 10 metros.',
        unitPrice: 120000,
        currency: 'AOA',
        leadTimeDays: 7,
        rating: 4.6,
        reviewCount: 15,
      },
      {
        supplierId: supplier.id,
        name: 'Inspeção por Ultrassom (UT)',
        category: 'Inspeção & Ensaios',
        description: 'Serviço de inspeção por ultrassom convencional e phased array para deteção de descontinuidades.',
        unitPrice: 950000,
        currency: 'AOA',
        leadTimeDays: 5,
        rating: 4.9,
        reviewCount: 34,
      },
      {
        supplierId: supplier.id,
        name: 'Ensaios não Destrutivos (NDT)',
        category: 'Inspeção & Ensaios',
        description: 'Ensaios não destrutivos: RT, PT, MT, UT, TOFD e outros métodos avançados.',
        unitPrice: 1250000,
        currency: 'AOA',
        leadTimeDays: 10,
        rating: 4.7,
        reviewCount: 21,
      },
      {
        supplierId: supplier.id,
        name: 'Transporte de Carga Industrial',
        category: 'Logística & Transporte',
        description: 'Serviço de transporte de equipamentos e carga pesada para bases logísticas em Angola.',
        unitPrice: 480000,
        currency: 'AOA',
        leadTimeDays: 3,
        rating: 4.5,
        reviewCount: 12,
      },
      {
        supplierId: supplier.id,
        name: 'Engenharia de Detalhe (Oil & Gas)',
        category: 'Engenharia',
        description: 'Serviços de engenharia básica e detalhada para projetos de óleo e gás.',
        unitPrice: 3200000,
        currency: 'AOA',
        leadTimeDays: 20,
        rating: 4.7,
        reviewCount: 16,
      },
      {
        supplierId: supplier.id,
        name: 'Gerador Diesel 500 kVA',
        category: 'Equipamentos',
        description: 'Aluguer de gerador industrial 500 kVA, insonorizado, com manutenção incluída.',
        unitPrice: 2100000,
        currency: 'AOA',
        leadTimeDays: 4,
        rating: 4.4,
        reviewCount: 9,
      },
      {
        supplierId: supplier.id,
        name: 'Formação & Certificação Técnica',
        category: 'Formação & Certificação',
        description: 'Formação técnica e certificação para profissionais da indústria petrolífera.',
        unitPrice: 380000,
        currency: 'AOA',
        leadTimeDays: 10,
        rating: 4.5,
        reviewCount: 18,
      },
      {
        supplierId: supplier.id,
        name: 'Tubos de Aço Carbono (lote)',
        category: 'Materiais',
        description: 'Fornecimento de tubos sem costura para linhas de processo, conforme ASTM.',
        unitPrice: 1650000,
        currency: 'AOA',
        leadTimeDays: 25,
        rating: 4.6,
        reviewCount: 11,
      },
    ],
  });

  // Metadados de marketplace (kind, localização, certificações, slug, verificação).
  await prisma.company.update({
    where: { id: supplier.id },
    data: { verified: true, city: 'Luanda', province: 'Luanda', country: 'Angola' },
  });
  const slugify = (s, i) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50) + '-' + i;
  const SERVICE_CATS = new Set(['Inspeção & Ensaios', 'Engenharia', 'Consultoria', 'Formação & Certificação', 'Logística & Transporte']);
  const CERTS = ['ISO 9001', 'ISO 45001', 'API Q1 / Q2', 'ISO 14001'];
  const all = await prisma.product.findMany({ where: { supplierId: supplier.id } });
  let i = 0;
  for (const p of all) {
    const isService = SERVICE_CATS.has(p.category);
    await prisma.product.update({
      where: { id: p.id },
      data: {
        slug: slugify(p.name, i),
        kind: isService ? 'SERVICO' : 'PRODUTO',
        city: 'Luanda', province: 'Luanda', country: 'Angola',
        specialty: isService ? p.category : null,
        availability: isService ? (i % 2 ? 'Sob Consulta' : 'Disponível') : 'Em stock',
        certifications: [CERTS[i % CERTS.length], CERTS[(i + 1) % CERTS.length]],
        tags: ['oil & gas', p.category.toLowerCase()],
      },
    });
    i++;
  }

  // -------------------------------------------------------------------------
  // Ordens de Compra de demonstração (vários estados) + faturas.
  // Dão dados reais às telas do Comprador: Ordens, Pagamentos, Acompanhar
  // Entrega, Recepção e Atividades.
  // -------------------------------------------------------------------------
  const byName = Object.fromEntries(all.map((p) => [p.name, p]));
  const pick = (name) => byName[name] || all[0];
  const DAY = 864e5;
  const ago = (d) => new Date(Date.now() - d * DAY);
  let poSeq = 0; let invSeq = 0;
  const pad = (n) => String(n).padStart(5, '0');

  async function makeOrder({ status, lines, accepted, dispatched, delivered, received, receptionStatus, invoiceStatus }) {
    poSeq += 1;
    const items = lines.map(([name, qty]) => {
      const p = pick(name);
      const unitPrice = Number(p.unitPrice);
      return { productId: p.id, quantity: qty, unitPrice, lineTotal: unitPrice * qty };
    });
    const totalAmount = items.reduce((s, i) => s + i.lineTotal, 0);
    // IVA (lei angolana) por linha, conforme o tipo do produto/serviço.
    const iva = taxService.summarize(lines.map(([name, qty]) => ({ net: Number(pick(name).unitPrice) * qty, kind: pick(name).kind })));
    const po = await prisma.purchaseOrder.create({
      data: {
        reference: `PO-2026-${pad(poSeq)}`,
        buyerCompanyId: client.id, supplierCompanyId: supplier.id, createdById: comprador.id,
        status, totalAmount, currency: 'AOA',
        approvedById: status === 'AGUARDANDO_APROVACAO' ? null : companyAdmin.id,
        approvedAt: status === 'AGUARDANDO_APROVACAO' ? null : ago(9),
        acceptedAt: accepted ? ago(8) : null,
        paymentDueAt: accepted ? ago(1) : null,
        paidAt: invoiceStatus === 'PAGA' ? ago(5) : null,
        dispatchedAt: dispatched ? ago(4) : null,
        deliveredAt: delivered ? ago(2) : null,
        receivedAt: received ? ago(1) : null,
        receptionStatus: receptionStatus || null,
        createdAt: ago(10),
        items: { create: items },
      },
    });
    if (invoiceStatus) {
      invSeq += 1;
      const invoice = await prisma.invoice.create({
        data: {
          reference: `FAT-2026-${pad(invSeq)}`, purchaseOrderId: po.id,
          amount: iva.gross, netAmount: iva.net, taxAmount: iva.tax, currency: 'AOA', status: invoiceStatus,
          issuedAt: ago(7), dueAt: ago(-3),
        },
      });
      // Fatura paga -> regista o pagamento (mostra "PAGAMENTO CONFIRMADO" no documento).
      if (invoiceStatus === 'PAGA') {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id, amount: iva.gross, currency: 'AOA', status: 'PROCESSADO',
            processedById: financeiro.id, reference: `PAY-2026-${pad(invSeq)}`, processedAt: ago(5),
          },
        });
      }
    }
    return po;
  }

  await makeOrder({ status: 'AGUARDANDO_APROVACAO', lines: [['Válvula de esfera 4" API 6D', 2]] });
  await makeOrder({ status: 'AGUARDANDO_PAGAMENTO', accepted: true, invoiceStatus: 'PENDENTE', lines: [['Gerador Diesel 500 kVA', 1]] });
  await makeOrder({ status: 'PAGA', accepted: true, invoiceStatus: 'PAGA', lines: [['Mangueira hidráulica de alta pressão 2"', 5]] });
  await makeOrder({ status: 'EM_EXECUCAO', accepted: true, dispatched: true, invoiceStatus: 'PAGA', lines: [['Tubos de Aço Carbono (lote)', 3]] });
  await makeOrder({ status: 'ENTREGUE', accepted: true, dispatched: true, delivered: true, invoiceStatus: 'PAGA', lines: [['Inspeção por Ultrassom (UT)', 1]] });
  await makeOrder({ status: 'RECEBIDA_CONFORME', accepted: true, dispatched: true, delivered: true, received: true, receptionStatus: 'Conforme', invoiceStatus: 'PAGA', lines: [['Ensaios não Destrutivos (NDT)', 1]] });
  await makeOrder({ status: 'RECEBIDA_COM_DIVERGENCIA', accepted: true, dispatched: true, delivered: true, received: true, receptionStatus: 'Com Divergência', invoiceStatus: 'PAGA', lines: [['Transporte de Carga Industrial', 2]] });
  await makeOrder({ status: 'REJEITADA', lines: [['Engenharia de Detalhe (Oil & Gas)', 1]] });

  // Contratos-quadro de demonstração (Company Admin: Contratos/Dashboard).
  await prisma.contract.createMany({
    data: [
      { reference: 'CTR-2026-0001', clientCompanyId: client.id, supplierCompanyId: supplier.id, categoriesCovered: ['Inspeção & Ensaios'], totalValue: 15300000, usedValue: 4200000, currency: 'AOA', billingPeriodicity: 'TRIMESTRAL', paymentTermDays: 30, status: 'ATIVO', validFrom: ago(120), validUntil: ago(-240) },
      { reference: 'CTR-2026-0002', clientCompanyId: client.id, supplierCompanyId: supplier.id, categoriesCovered: ['Equipamentos'], totalValue: 8750000, usedValue: 8750000, currency: 'AOA', billingPeriodicity: 'SEMESTRAL', paymentTermDays: 45, status: 'ATIVO', validFrom: ago(90), validUntil: ago(-25) },
      { reference: 'CTR-2026-0003', clientCompanyId: client.id, supplierCompanyId: supplier.id, categoriesCovered: ['Logística & Transporte'], totalValue: 6800000, usedValue: 6800000, currency: 'AOA', billingPeriodicity: 'TRIMESTRAL', paymentTermDays: 30, status: 'EXPIRADO', validFrom: ago(400), validUntil: ago(30) },
    ],
  });

  // Pedidos de suporte de demonstração (tela Ajuda & Suporte). De vários
  // utilizadores/empresas, para o painel do Administrador do Sistema.
  await prisma.supportTicket.createMany({
    data: [
      { reference: 'SUP-2026-00001', userId: comprador.id, companyId: client.id, subject: 'Dúvida sobre call-off', category: 'Contratos', message: 'Como emito uma PO ao abrigo de contrato-quadro?', status: 'EM_ANDAMENTO', createdAt: ago(0) },
      { reference: 'SUP-2026-00002', userId: fornecedorUser.id, companyId: supplier.id, subject: 'Problema ao anexar documentos', category: 'Documentos', message: 'O upload falha em PDF grande.', status: 'ABERTO', createdAt: ago(1) },
      { reference: 'SUP-2026-00003', userId: financeiro.id, companyId: client.id, subject: 'Falha ao criar fatura', category: 'Faturação', message: 'Erro ao gerar fatura da PO.', status: 'AGUARDANDO_RESPOSTA', createdAt: ago(4) },
      { reference: 'SUP-2026-00004', userId: comprador.id, companyId: client.id, subject: 'Acesso ao relatório comercial', category: 'Conta & Acesso', message: 'Não consigo abrir o relatório.', status: 'FECHADO', createdAt: ago(6) },
      { reference: 'SUP-2026-00005', userId: companyAdmin.id, companyId: client.id, subject: 'Adicionar novo utilizador', category: 'Conta & Acesso', message: 'O convite não chega ao email.', status: 'RESOLVIDO', createdAt: ago(3) },
      { reference: 'SUP-2026-00006', userId: fornecedorUser.id, companyId: supplier.id, subject: 'Pagamento em atraso', category: 'Pagamentos', message: 'Fatura vencida ainda não paga.', status: 'ABERTO', createdAt: ago(2) },
    ],
  });

  console.log('Seed concluído.');
  console.log('Password para todos os utilizadores de teste:', PASSWORD);
  console.log({
    comprador: comprador.email,
    companyAdmin: companyAdmin.email,
    financeiro: financeiro.email,
    fornecedor: fornecedorUser.email,
    adminSistema: adminSistema.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
