// prisma/seed.catalog.js
// Carrega o CATÁLOGO KIXIMA (119 itens O&G, v2.2) como produtos/serviços reais e
// visíveis no marketplace — para testes na plataforma. É IDEMPOTENTE: pode ser
// corrido várias vezes (faz upsert por slug). Não apaga nem altera dados de
// outras empresas — cria/reutiliza um fornecedor de demonstração dedicado.
//
// Correr:  npm run seed:catalog     (usa a DATABASE_URL do ambiente)
//
// As imagens vivem em frontend/public/catalog/<code>.jpg (versionadas no repo),
// por isso aparecem automaticamente no marketplace após o deploy do frontend.

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const ITEMS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'catalog.v2_2.json'), 'utf8'));

// Fornecedor de demonstração que "publica" o catálogo de testes.
const DEMO_SUPPLIER = {
  name: 'Catálogo KIXIMA (Demonstração)',
  taxId: 'AO-DEMO-CAT-001',
  type: 'FORNECEDOR',
  contactEmail: 'catalogo.demo@kixima.co.ao',
  status: 'APROVADA',
  verified: true,
  city: 'Luanda',
  province: 'Luanda',
  country: 'Angola',
};

// Preço-base por categoria (AOA). Serviços tendem a ser mais altos. Determinístico
// (varia com o código) para se manter estável entre execuções — são valores de
// teste, não tabelados.
const BASE_PRICE = {
  'Válvulas e Conexões': 850000,
  'Tubulares e Acessórios (OCTG)': 1600000,
  'Hidráulica e Pneumática': 320000,
  'Bombas e Compressores': 4200000,
  'Instrumentação e Controlo': 680000,
  'Perfuração e Completação': 5400000,
  'Segurança e EPI': 45000,
  'Elétrico, Iluminação e Automação': 210000,
  'Geração de Energia': 7800000,
  'Produtos Químicos e Fluidos': 180000,
  'Elevação, Içamento e Rigging': 540000,
  'Ferramentas e Equipamento de Oficina': 95000,
  'Material de Escritório e TI': 60000,
  'Serviços de Engenharia e Manutenção': 3200000,
  'Logística, Transporte e Armazenagem': 480000,
  'Inspeção, Testes e Certificação': 950000,
  'Serviços Ambientais e Gestão de Resíduos': 720000,
};

function slugify(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/["'()]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 70);
}

// Preço determinístico a partir do código (sem aleatoriedade → idempotente).
function priceFor(item) {
  const base = BASE_PRICE[item.categoria] || 250000;
  const digits = Number(String(item.code).replace(/\D/g, '').slice(-3)) || 0;
  const factor = 0.85 + (digits % 30) / 100; // 0.85 .. 1.14
  return Math.round((base * factor) / 1000) * 1000;
}

async function ensureSupplier() {
  // Upsert que também REPÕE o estado (APROVADA/verificado): se a demo tiver sido
  // removida parcialmente (empresa SUSPENSA por ter histórico), recarregar volta
  // a deixá-la utilizável.
  return prisma.company.upsert({
    where: { taxId: DEMO_SUPPLIER.taxId },
    update: { status: 'APROVADA', verified: true },
    create: { ...DEMO_SUPPLIER, approvedAt: new Date() },
  });
}

async function main() {
  // OPT-IN: os dados de demonstração só entram quando explicitamente pedidos
  // (LOAD_DEMO_CATALOG=1). Sem a variável, o arranque em produção NÃO cria o
  // fornecedor fictício nem os 119 produtos — produção fica só com dados reais.
  // Para carregar em testes/piloto: define LOAD_DEMO_CATALOG=1 no ambiente (ou
  // corre `npm run seed:catalog`, que já a define). Para remover dados de
  // demonstração já carregados: `npm run demo:remove`.
  if (process.env.LOAD_DEMO_CATALOG !== '1') {
    console.log('Catálogo de demonstração: ignorado (opt-in — define LOAD_DEMO_CATALOG=1 para carregar).');
    return;
  }
  const supplier = await ensureSupplier();
  let created = 0;
  let updated = 0;

  for (let i = 0; i < ITEMS.length; i++) {
    const it = ITEMS[i];
    const isService = String(it.tipo).toLowerCase().startsWith('serv');
    const slug = `${slugify(it.nome)}-${it.code}-${i}`;
    const price = priceFor(it);

    const data = {
      supplierId: supplier.id,
      name: it.nome,
      sku: it.code,
      category: it.categoria,
      description: it.descricao,
      fullDescription: it.descricao,
      kind: isService ? 'SERVICO' : 'PRODUTO',
      measurementUnit: it.uom,
      unspscCode: it.code,
      unspscTitle: it.tituloEN,
      unspscSegment: it.segmento,
      unspscFamily: it.familiaCode,
      unspscClass: it.classe,
      unitPrice: price,
      currency: 'AOA',
      leadTimeDays: isService ? 5 : 15,
      availability: 'Em stock',
      stockQuantity: isService ? null : 50,
      city: 'Luanda',
      province: 'Luanda',
      country: 'Angola',
      imageUrl: it.img,
      active: true,
    };

    const found = await prisma.product.findUnique({ where: { slug } });
    if (found) {
      await prisma.product.update({ where: { slug }, data });
      updated++;
    } else {
      await prisma.product.create({ data: { ...data, slug } });
      created++;
    }
  }

  const total = await prisma.product.count({ where: { supplierId: supplier.id } });
  console.log(`Catálogo KIXIMA (v2.2) carregado: ${created} criados, ${updated} atualizados.`);
  console.log(`Fornecedor: ${supplier.name} — total de ${total} itens publicados.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
