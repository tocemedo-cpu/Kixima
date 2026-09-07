// scripts/copiar-catalogo-producao-teste.js
//
// Copia o catálogo (empresas fornecedoras aprovadas + produtos/serviços +
// imagens + documentos + kits) da PRODUÇÃO para o kixima-teste, para os
// pilotos terem algo real para explorar sem esperar que os 50 utilizadores
// construam o catálogo do zero.
//
// SÓ LÊ da produção (nunca escreve lá) e só ESCREVE no destino. Os
// fornecedores copiados ficam marcados como cópia de teste — nome com
// prefixo "[TESTE]", NIF prefixado, e contactos/dados bancários substituídos
// por valores fictícios — nunca se expõe o email, telefone ou IBAN reais de
// uma empresa terceira a quem estiver a testar a plataforma.
//
// Uso (a partir de backend/, com as DUAS connection strings — nunca a mesma
// nos dois lados):
//   SOURCE_DATABASE_URL="postgresql://...produção..." \
//   TARGET_DATABASE_URL="postgresql://...kixima-teste..." \
//   node scripts/copiar-catalogo-producao-teste.js --confirmar
//
// Sem --confirmar, só mostra o que iria copiar (modo de ensaio) — não
// escreve nada no destino.

const { PrismaClient } = require('@prisma/client');

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.TARGET_DATABASE_URL;
const CONFIRMAR = process.argv.includes('--confirmar');

if (!SOURCE_URL || !TARGET_URL) {
  console.error('Defina SOURCE_DATABASE_URL (produção) e TARGET_DATABASE_URL (kixima-teste).');
  process.exit(1);
}
if (SOURCE_URL === TARGET_URL) {
  console.error('SOURCE_DATABASE_URL e TARGET_DATABASE_URL são iguais — isto apagaria/sobrescreveria a própria produção. A abortar.');
  process.exit(1);
}

const source = new PrismaClient({ datasources: { db: { url: SOURCE_URL } } });
const target = new PrismaClient({ datasources: { db: { url: TARGET_URL } } });

function idCurto(id) {
  return id.replace(/-/g, '').slice(0, 8);
}

// Sanitiza a empresa fornecedora: mantém o que é preciso para o catálogo
// funcionar (localização, plano, verificação), remove tudo que identifique
// ou exponha a empresa real (contactos, dados bancários, série fiscal).
function empresaSanitizada(c) {
  return {
    id: c.id, // mesmo id — é a isso que os produtos ficam ligados (supplierId)
    name: `[TESTE] ${c.name}`,
    taxId: `TESTE-${c.taxId}`,
    type: c.type,
    status: 'APROVADA',
    contactEmail: `fornecedor.${idCurto(c.id)}@teste.kixima.co.ao`,
    contactPhone: '+244900000000',
    address: null,
    verified: c.verified,
    logoUrl: null, // sem logótipo real — evita identificar a empresa à primeira vista
    city: c.city,
    province: c.province,
    country: c.country,
    settings: null,
    bankName: null,
    iban: null,
    swift: null,
    serieFiscal: null,
    dataAdesaoFacturacaoElectronica: null,
    employees: c.employees,
    annualRevenueUsd: c.annualRevenueUsd,
    size: c.size,
    plan: c.plan,
    searchRank: c.searchRank,
  };
}

async function main() {
  console.log(CONFIRMAR ? 'MODO REAL — vai escrever no kixima-teste.' : 'MODO DE ENSAIO — nada será escrito (repita com --confirmar para copiar a sério).');

  const fornecedores = await source.company.findMany({
    where: { type: 'FORNECEDOR', status: 'APROVADA' },
    include: {
      productsOffered: {
        include: { images: true, documents: true },
      },
      kits: { include: { items: true } },
    },
  });

  const totalProdutos = fornecedores.reduce((n, f) => n + f.productsOffered.length, 0);
  const totalImagens = fornecedores.reduce((n, f) => n + f.productsOffered.reduce((m, p) => m + p.images.length, 0), 0);
  const totalDocs = fornecedores.reduce((n, f) => n + f.productsOffered.reduce((m, p) => m + p.documents.length, 0), 0);
  const totalKits = fornecedores.reduce((n, f) => n + f.kits.length, 0);

  console.log(`Encontrados na produção: ${fornecedores.length} fornecedores aprovados, ${totalProdutos} produtos/serviços, ${totalImagens} imagens, ${totalDocs} documentos, ${totalKits} kits.`);
  for (const f of fornecedores) {
    console.log(`  - ${f.name} (${f.taxId}): ${f.productsOffered.length} itens`);
  }

  if (!CONFIRMAR) {
    await source.$disconnect();
    await target.$disconnect();
    return;
  }

  let copiados = 0;
  for (const f of fornecedores) {
    const dadosEmpresa = empresaSanitizada(f);
    await target.company.upsert({
      where: { id: f.id },
      create: dadosEmpresa,
      update: dadosEmpresa,
    });

    for (const p of f.productsOffered) {
      const { images, documents, ...produto } = p;
      // eslint-disable-next-line no-unused-vars
      const { searchText, ...produtoSemSearchText } = produto; // mantido por gatilho na base — nunca escrito pela aplicação
      try {
        await target.product.upsert({
          where: { id: p.id },
          create: produtoSemSearchText,
          update: produtoSemSearchText,
        });
      } catch (err) {
        console.warn(`    ! produto "${p.name}" (${p.id}) falhou: ${err.message.split('\n')[0]} — a saltar.`);
        continue;
      }

      for (const img of images) {
        await target.productImage.upsert({
          where: { id: img.id },
          create: img,
          update: img,
        });
      }
      for (const doc of documents) {
        await target.productDocument.upsert({
          where: { id: doc.id },
          create: doc,
          update: doc,
        });
      }
    }

    for (const kit of f.kits) {
      const { items, ...kitSemItems } = kit;
      await target.kit.upsert({ where: { id: kit.id }, create: kitSemItems, update: kitSemItems });
      for (const item of items) {
        await target.kitItem.upsert({ where: { id: item.id }, create: item, update: item });
      }
    }

    copiados += 1;
    console.log(`  ✓ ${f.name} copiado (${f.productsOffered.length} itens, ${f.kits.length} kits).`);
  }

  console.log(`Concluído: ${copiados} fornecedores copiados para o kixima-teste.`);
  await source.$disconnect();
  await target.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
