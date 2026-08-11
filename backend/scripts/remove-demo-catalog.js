// scripts/remove-demo-catalog.js
// Remove o catálogo de DEMONSTRAÇÃO da base de dados (o fornecedor fictício
// "Catálogo KIXIMA (Demonstração)" e os seus produtos), para produção ficar só
// com dados reais.
//
// Seguro por desenho:
//  - Só toca na empresa com o NIF de demonstração (AO-DEMO-CAT-001) — nunca em
//    dados de empresas reais.
//  - Produtos já referenciados por ordens/cotações/favoritos não podem ser
//    apagados (integridade referencial): esses são DESATIVADOS (deixam de
//    aparecer no marketplace) em vez de apagados.
//  - Se sobrarem produtos referenciados, a empresa é mantida mas perde o selo
//    "verificado" e fica SUSPENSA; caso contrário é apagada.
//
// Correr:  npm run demo:remove     (usa a DATABASE_URL do ambiente)
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DEMO_TAX_ID = 'AO-DEMO-CAT-001';

async function main() {
  const demo = await prisma.company.findUnique({ where: { taxId: DEMO_TAX_ID } });
  if (!demo) {
    console.log('Nada a fazer — o fornecedor de demonstração não existe nesta base.');
    return;
  }

  const products = await prisma.product.findMany({ where: { supplierId: demo.id }, select: { id: true } });
  let deleted = 0;
  let deactivated = 0;

  for (const p of products) {
    try {
      // Limpa dependências "soft" que não representam transações reais.
      await prisma.favorite.deleteMany({ where: { productId: p.id } });
      await prisma.review.deleteMany({ where: { productId: p.id } });
      await prisma.product.delete({ where: { id: p.id } });
      deleted += 1;
    } catch {
      // Referenciado por PO/cotação/kit/movimento — preserva o histórico e
      // esconde do marketplace.
      await prisma.product.update({ where: { id: p.id }, data: { active: false } });
      deactivated += 1;
    }
  }

  const remaining = await prisma.product.count({ where: { supplierId: demo.id } });
  if (remaining === 0) {
    await prisma.company.delete({ where: { id: demo.id } });
    console.log(`✓ Removido: ${deleted} produtos apagados e a empresa de demonstração eliminada.`);
  } else {
    await prisma.company.update({
      where: { id: demo.id },
      data: { verified: false, status: 'SUSPENSA' },
    });
    console.log(`✓ ${deleted} produtos apagados; ${deactivated} desativados (referenciados por transações).`);
    console.log('  A empresa de demonstração foi mantida (histórico), mas SUSPENSA e sem selo verificado.');
  }
}

main()
  .catch((e) => { console.error('✗ Erro:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
