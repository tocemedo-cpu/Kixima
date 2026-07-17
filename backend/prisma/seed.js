// prisma/seed.js
// Popula dados de exemplo: 1 empresa cliente, 1 fornecedora, 1 admin KIXIMA,
// e um utilizador por persona — para testar o fluxo end-to-end rapidamente.
//
// Correr com: npm run seed

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

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
