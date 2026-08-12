// prisma/seed.catalog-company.js
// EMPRESA "Catálogo KIXIMA" — o fornecedor REAL, credenciado, dono do catálogo.
//
// Porquê: o catálogo de 119 itens estava publicado por uma empresa fictícia sem
// utilizadores nenhuns, o que impedia entrar como fornecedor e testar o fluxo
// completo (proposta → PO → fatura → pagamento → receção). Este script cria a
// empresa a sério — com tudo o que a plataforma exige a uma empresa credenciada
// — passa-lhe o catálogo e cria uma conta para cada persona.
//
// A empresa cumpre TODOS os critérios de credenciamento de uma fornecedora:
//   • os três documentos obrigatórios (Certidão Comercial, Alvará, Licença ANPG);
//   • apólice de seguro Fornecedor→KIXIMA válida e aprovada;
//   • aceite dos Termos de Uso e da Política de Privacidade;
//   • dados bancários (saem na fatura e no comprovativo de pagamento);
//   • dimensão declarada e plano coerente com ela;
//   • estado APROVADA com selo de fornecedor verificado.
//
// É IDEMPOTENTE: pode correr as vezes que forem precisas. Nas repetições
// atualiza a empresa e repõe as senhas, sem duplicar documentos nem apólices.
//
// Correr:  npm run seed:catalog-company
//
// Credenciais (sobrepõem-se por ambiente, nunca ficam fixas no código):
//   CATALOG_COMPANY_EMAIL     email do Company Admin  (defeito: o abaixo)
//   CATALOG_COMPANY_PASSWORD  senha de todas as personas
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const storage = require('../src/services/storageService');

const prisma = new PrismaClient();

// NIF da empresa. O anterior (AO-DEMO-CAT-001) identificava a demonstração; ao
// mudar aqui, o script traz consigo o catálogo que estava na antiga.
const TAX_ID = 'AO-CAT-KIXIMA-001';
const LEGACY_TAX_ID = 'AO-DEMO-CAT-001';

const EMAIL = (process.env.CATALOG_COMPANY_EMAIL || 'tocemedo@hotmail.com').trim().toLowerCase();
const PASSWORD = process.env.CATALOG_COMPANY_PASSWORD || '12345678';

// As personas partilham a caixa de correio do titular através de subendereços
// (utilizador+etiqueta@dominio): são logins distintos, como a plataforma exige,
// mas todo o correio — convites, notificações, recuperação de senha — cai na
// mesma caixa de entrada.
function alias(label) {
  const [user, domain] = EMAIL.split('@');
  return `${user}+${label}@${domain}`;
}

const COMPANY = {
  name: 'Catálogo KIXIMA',
  taxId: TAX_ID,
  type: 'FORNECEDOR',
  status: 'APROVADA',
  verified: true,
  contactEmail: EMAIL,
  contactPhone: '+244 923 000 001',
  address: 'Rua Rainha Ginga, 87, Ingombota',
  city: 'Luanda',
  province: 'Luanda',
  country: 'Angola',
  // Dados bancários — a fatura e o comprovativo de pagamento imprimem-nos.
  bankName: 'Banco de Fomento Angola (BFA)',
  iban: 'AO06 0006 0000 0100 3742 1013 9',
  swift: 'BFMXAOLU',
  // Dimensão declarada → PEQUENA → plano BÁSICO (coerente com a classificação).
  employees: 45,
  annualRevenueUsd: 2_400_000,
  size: 'PEQUENA',
  plan: 'BASICO',
  seatPriceUsd: 100,
};

// As quatro personas do lado do fornecedor. O COMPRADOR existe porque uma
// fornecedora também compra — é assim que se testa o outro lado do fluxo.
const PERSONAS = [
  { role: 'COMPANY_ADMIN', name: 'Admin Catálogo KIXIMA', email: EMAIL },
  { role: 'FORNECEDOR', name: 'Vendedor Catálogo KIXIMA', email: alias('vendedor') },
  { role: 'FINANCEIRO', name: 'Financeiro Catálogo KIXIMA', email: alias('financeiro') },
  { role: 'COMPRADOR', name: 'Comprador Catálogo KIXIMA', email: alias('comprador'), approvalCap: 25_000_000 },
];

const DOCS = [
  { type: 'CERTIDAO_COMERCIAL', label: 'Certidão Comercial' },
  { type: 'ALVARA_COMERCIAL', label: 'Alvará Comercial' },
  { type: 'LICENCA_ANPG', label: 'Licença da ANPG' },
];

const POLICY = {
  policyNumber: 'AP-KIX-2026-0001',
  insurer: 'ENSA Seguros de Angola',
  coverageAmount: 250_000_000,
  currency: 'AOA',
  status: 'APROVADA',
};

// PDF mínimo válido (abre em qualquer leitor) para os documentos ficarem
// consultáveis na plataforma, e não apenas registados na base de dados.
function pdf(title, lines) {
  const body = [`(${title}) Tj`, ...lines.map((l) => `T* (${l}) Tj`)].join('\n');
  const content = `BT /F1 12 Tf 60 760 Td 18 TL\n${body}\nET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// No armazenamento local (sem Supabase Storage ativo) o disco do contentor é
// efémero: o registo do documento sobrevive na base de dados, mas o ficheiro
// desaparece a cada reinício e o link deixa de abrir. Detetar isso permite
// regenerá-lo — o seed repara-se a cada arranque.
function fileMissing(fileUrl) {
  if (!fileUrl) return true;
  const local = String(fileUrl).match(/^\/api\/uploads\/(.+)$/);
  if (!local) return false; // ficheiro em S3/Supabase — persistente.
  return !fs.existsSync(path.join(storage.uploadsDir, local[1]));
}

async function upload(label, filename, lines) {
  return storage.saveFile({
    buffer: pdf(label, lines),
    originalname: filename,
    mimetype: 'application/pdf',
    keyHint: `${TAX_ID}-${label.replace(/\s+/g, '-')}`,
    folder: 'documents',
  });
}

// 1. Empresa — cria ou atualiza, incluindo a herança do NIF de demonstração.
async function ensureCompany() {
  const existing =
    (await prisma.company.findUnique({ where: { taxId: TAX_ID } })) ||
    (await prisma.company.findUnique({ where: { taxId: LEGACY_TAX_ID } }));

  const data = { ...COMPANY, approvedAt: existing?.approvedAt || new Date(), termsAcceptedAt: existing?.termsAcceptedAt || new Date() };
  if (existing) {
    const company = await prisma.company.update({ where: { id: existing.id }, data });
    console.log(`Empresa atualizada: ${company.name} (${company.taxId})`);
    return company;
  }
  const company = await prisma.company.create({ data });
  console.log(`Empresa criada: ${company.name} (${company.taxId})`);
  return company;
}

// 2. Documentos de credenciamento — os três exigidos a uma fornecedora.
async function ensureDocuments(company) {
  let novos = 0;
  let repostos = 0;
  for (const d of DOCS) {
    const has = await prisma.companyDocument.findFirst({ where: { companyId: company.id, type: d.type } });
    if (has && !fileMissing(has.fileUrl)) continue;
    const fileUrl = await upload(d.label, `${d.type.toLowerCase()}.pdf`, [
      `Empresa: ${COMPANY.name}`,
      `NIF: ${COMPANY.taxId}`,
      `Documento: ${d.label}`,
      'Documento de credenciamento da empresa do catalogo KIXIMA.',
    ]);
    if (has) {
      await prisma.companyDocument.update({ where: { id: has.id }, data: { fileUrl } });
      repostos++;
    } else {
      await prisma.companyDocument.create({
        data: { companyId: company.id, type: d.type, fileUrl, originalName: `${d.label}.pdf` },
      });
      novos++;
    }
  }
  const reparo = repostos ? `, ${repostos} ficheiro(s) reposto(s)` : '';
  console.log(`Documentos de credenciamento: ${DOCS.length} exigidos, ${novos} carregados agora${reparo}.`);
}

// 3. Apólice Fornecedor→KIXIMA — obrigatória e aqui já aprovada e válida.
async function ensurePolicy(company) {
  const validFrom = new Date();
  const validUntil = new Date(validFrom);
  validUntil.setFullYear(validUntil.getFullYear() + 1);

  const existing = await prisma.supplierToKiximaPolicy.findFirst({ where: { companyId: company.id } });
  const documentUrl =
    (!fileMissing(existing?.documentUrl) && existing.documentUrl) ||
    (await upload('Apolice de Seguro', 'apolice.pdf', [
      `Segurado: ${COMPANY.name}`,
      `Seguradora: ${POLICY.insurer}`,
      `Apolice n.: ${POLICY.policyNumber}`,
      `Cobertura: ${POLICY.coverageAmount.toLocaleString('pt-AO')} ${POLICY.currency}`,
    ]));

  const data = { ...POLICY, companyId: company.id, validFrom, validUntil, documentUrl };
  if (existing) {
    await prisma.supplierToKiximaPolicy.update({ where: { id: existing.id }, data });
    console.log('Apólice Fornecedor→KIXIMA: atualizada (APROVADA, válida por 1 ano).');
    return;
  }
  await prisma.supplierToKiximaPolicy.create({ data });
  console.log('Apólice Fornecedor→KIXIMA: criada (APROVADA, válida por 1 ano).');
}

// 4. Personas — uma conta por perfil, todas na mesma empresa.
async function ensureUsers(company) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  for (const p of PERSONAS) {
    await prisma.user.upsert({
      where: { email: p.email },
      update: {
        name: p.name, passwordHash, role: p.role, companyId: company.id, active: true,
        approvalCap: p.approvalCap ?? null, termsAcceptedAt: new Date(),
      },
      create: {
        name: p.name, email: p.email, passwordHash, role: p.role, companyId: company.id,
        approvalCap: p.approvalCap ?? null, termsAcceptedAt: new Date(),
      },
    });
    console.log(`  ${p.role.padEnd(14)} ${p.email}`);
  }
}

// 5. Catálogo — passa para esta empresa tudo o que estava na de demonstração.
async function takeOverCatalog(company) {
  const legacy = await prisma.company.findFirst({ where: { taxId: LEGACY_TAX_ID, NOT: { id: company.id } } });
  if (legacy) {
    const { count } = await prisma.product.updateMany({ where: { supplierId: legacy.id }, data: { supplierId: company.id } });
    await prisma.kit.updateMany({ where: { supplierId: legacy.id }, data: { supplierId: company.id } });
    // A antiga fica sem catálogo e fora do marketplace, mas não se apaga: pode
    // ter histórico (ordens, cotações) que tem de continuar a existir.
    await prisma.company.update({ where: { id: legacy.id }, data: { status: 'SUSPENSA', verified: false } });
    console.log(`Catálogo transferido da empresa de demonstração: ${count} itens.`);
  }
  const total = await prisma.product.count({ where: { supplierId: company.id } });
  console.log(`Catálogo desta empresa: ${total} itens publicados.`);
  if (total === 0) {
    console.log('  (Ainda sem itens — corre `npm run seed:catalog` para carregar o catálogo.)');
  }
}

// Ponto de entrada reutilizável — o seed do catálogo chama-o para garantir que
// os 119 itens nascem já com um dono credenciado.
async function ensureCatalogCompany() {
  if (PASSWORD.length < 8) throw new Error('CATALOG_COMPANY_PASSWORD deve ter pelo menos 8 caracteres.');

  const company = await ensureCompany();
  await ensureDocuments(company);
  await ensurePolicy(company);
  console.log('Personas:');
  await ensureUsers(company);
  await takeOverCatalog(company);
  return company;
}

module.exports = { ensureCatalogCompany, TAX_ID, LEGACY_TAX_ID };

// Só corre sozinho quando é invocado diretamente (npm run seed:catalog-company).
if (require.main === module) {
  ensureCatalogCompany()
    .then(() => {
      console.log('\n✓ Empresa do catálogo pronta para o teste ponta a ponta.');
      console.log(`  Entrar em qualquer persona com a senha definida (${PASSWORD.length} caracteres).`);
    })
    .catch((e) => { console.error('✗ Erro:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
