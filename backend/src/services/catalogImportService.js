// src/services/catalogImportService.js
// Importação de catálogo em massa a partir de um Excel (.xlsx) no formato KIXIMA
// (folha "Catálogo" + folha opcional "Catálogo Visual" com fotos embebidas).
// Cada Fornecedor importa o SEU próprio catálogo — os produtos são criados/
// atualizados para a empresa do utilizador. Idempotente por slug (código+empresa).
const AdmZip = require('adm-zip');
const prisma = require('../config/database');
const planService = require('./planService');
const storageService = require('./storageService');
const xlsxSeguro = require('./xlsxSeguro');
const { BusinessRuleError } = require('../utils/errors');

const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();

// Aliases de cabeçalho tolerantes → campo canónico.
const COLS = {
  categoria: ['categoria', 'setor', 'família comercial'],
  nome: ['produto/serviço', 'produto/servico', 'produto', 'serviço', 'servico', 'nome', 'item', 'designação'],
  descricao: ['descrição', 'descricao', 'descrição do item'],
  tipo: ['tipo'],
  uom: ['uom', 'unidade', 'un', 'unidade de medida'],
  code: ['código unspsc', 'codigo unspsc', 'unspsc', 'código', 'codigo'],
  tituloEN: ['título oficial unspsc', 'titulo oficial unspsc', 'título unspsc', 'titulo unspsc'],
  segmento: ['segmento unspsc', 'segmento'],
  familia: ['família unspsc', 'familia unspsc', 'família', 'familia'],
  origem: ['país de origem', 'pais de origem', 'origem', 'proveniência', 'proveniencia', 'país', 'pais', 'country of origin'],
  preco: ['preço', 'preco', 'preço unitário', 'preco unitario', 'preço (aoa)', 'preço unitário (aoa)', 'preco (aoa)'],
  // Colunas opcionais — quando ausentes, os valores por omissão (ver
  // importCatalog) continuam a ser usados como antes; quando presentes, são
  // respeitados em vez de inventados.
  stock: ['stock', 'estoque', 'quantidade', 'quantidade em stock', 'quantidade em estoque'],
  cidade: ['cidade', 'localização', 'localizacao', 'localidade'],
};

// Preço-base por categoria (AOA) quando o Excel não traz coluna de preço.
const BASE_PRICE = {
  'válvulas e conexões': 850000, 'tubulares e acessórios (octg)': 1600000,
  'hidráulica e pneumática': 320000, 'bombas e compressores': 4200000,
  'instrumentação e controlo': 680000, 'perfuração e completação': 5400000,
  'segurança e epi': 45000, 'elétrico, iluminação e automação': 210000,
  'geração de energia': 7800000, 'produtos químicos e fluidos': 180000,
  'elevação, içamento e rigging': 540000, 'ferramentas e equipamento de oficina': 95000,
  'material de escritório e ti': 60000, 'serviços de engenharia e manutenção': 3200000,
  'logística, transporte e armazenagem': 480000, 'inspeção, testes e certificação': 950000,
  'serviços ambientais e gestão de resíduos': 720000,
};

function slugify(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/["'()]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 70);
}

// Executa `fn` para cada item de `items`, com no máximo `limite` chamadas em
// voo ao mesmo tempo — em vez de um `for` sequencial (uma linha de cada vez,
// à espera de cada round-trip à base/storage antes de começar a seguinte) ou
// de um `Promise.all` sem limite (um catálogo de 48.000 linhas a abrir
// 48.000 ligações de uma vez esgotaria o pool do Postgres). `limite`
// "trabalhadores" partilham um cursor e vão puxando o item seguinte assim
// que terminam o anterior.
async function comLimite(items, limite, fn) {
  const resultados = new Array(items.length);
  let cursor = 0;
  async function trabalhador() {
    while (cursor < items.length) {
      const i = cursor++;
      resultados[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) || 0 }, trabalhador));
  return resultados;
}

function defaultPrice(categoria, code) {
  const base = BASE_PRICE[norm(categoria)] || 250000;
  const digits = Number(String(code || '').replace(/\D/g, '').slice(-3)) || 0;
  const factor = 0.85 + (digits % 30) / 100;
  return Math.round((base * factor) / 1000) * 1000;
}

// "1.250.000,00 AOA" | "1250000" | 1250000 → Number (ou null se inválido).
function parsePrice(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[^\d.,]/g, '');
  if (!s) return null;
  // remove separador de milhar (.) e usa , como decimal
  const n = Number(s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Extrai as imagens embebidas do .xlsx (qualquer folha) por ordem de linha de
// âncora — devolve [{ row, buffer, ext }] ordenado. O .xlsx é um ZIP: as fotos
// vivem em xl/media e os desenhos (xl/drawings) dão a linha de cada uma.
function extractImages(buffer) {
  const out = [];
  let zip;
  try { zip = new AdmZip(buffer); } catch { return out; }
  const drawings = zip.getEntries().filter((e) => /^xl\/drawings\/drawing\d+\.xml$/.test(e.entryName));
  for (const d of drawings) {
    const xml = zip.readAsText(d.entryName);
    const relName = d.entryName.replace(/drawings\/(drawing\d+)\.xml/, 'drawings/_rels/$1.xml.rels');
    const relMap = {};
    if (zip.getEntry(relName)) {
      const relXml = zip.readAsText(relName);
      for (const rel of relXml.match(/<Relationship\b[^>]*\/>/g) || []) {
        const id = (rel.match(/Id="([^"]+)"/) || [])[1];
        const tgt = (rel.match(/Target="([^"]+)"/) || [])[1];
        if (id && tgt) relMap[id] = tgt;
      }
    }
    const anchors = xml.match(/<xdr:(one|two)CellAnchor[\s\S]*?<\/xdr:(one|two)CellAnchor>/g) || [];
    for (const a of anchors) {
      const row = parseInt((a.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/) || [])[1], 10);
      const embed = (a.match(/r:embed="([^"]+)"/) || [])[1];
      const tgt = embed && relMap[embed];
      if (!tgt) continue;
      let mediaPath = tgt.replace(/^\//, '');
      if (!mediaPath.startsWith('xl/')) mediaPath = 'xl/' + mediaPath.replace(/^\.\.\//, '');
      const entry = zip.getEntry(mediaPath);
      if (!entry) continue;
      const ext = (mediaPath.split('.').pop() || 'jpg').toLowerCase();
      out.push({ row: Number.isNaN(row) ? 1e9 : row, buffer: entry.getData(), ext });
    }
  }
  out.sort((a, b) => a.row - b.row);
  return out;
}

/**
 * Importa o catálogo de um Excel para o fornecedor indicado.
 * @returns {{ total, created, updated, withImages, errors: Array<{row,error}> }}
 */
async function importCatalog(buffer, supplierId) {
  // Carregar centenas de linhas de uma vez é uma funcionalidade de ESCALA: quem
  // a usa tem catálogo grande e equipa para o manter. Publicar item a item
  // continua sem limite nenhum, em qualquer plano — a densidade do catálogo
  // nunca é o que se restringe.
  const empresa = await prisma.company.findUnique({ where: { id: supplierId } });
  planService.assertFeature(empresa, 'carregamentoEmMassa', 'Carregamento em massa');

  // A leitura corre num ISOLADO com tempo-limite e tecto de memória.
  //
  // A biblioteca `xlsx` tem Prototype Pollution e ReDoS de severidade alta, com
  // aviso explícito de "No fix available" — não há versão para onde subir. Só
  // lá chega um fornecedor autenticado com plano Pro, mas o contentor é
  // partilhado por toda a plataforma: uma expressão regular a arder derrubava o
  // serviço para todos os clientes, não só para quem carregou o ficheiro.
  //
  // Contém-se em vez de se reescrever. Ver src/services/xlsxSeguro.js.
  const rows = await xlsxSeguro.lerLinhas(buffer, ['catálogo', 'catalogo', 'catalog', 'produtos', 'itens']);
  if (!rows.length) throw new BusinessRuleError('A folha do catálogo está vazia.');

  const hdr = rows[0].map(norm);
  const idx = {};
  for (const [field, aliases] of Object.entries(COLS)) idx[field] = hdr.findIndex((h) => aliases.includes(h));
  if (idx.nome < 0 || idx.categoria < 0) {
    throw new BusinessRuleError('Formato inválido: são necessárias, no mínimo, as colunas "Categoria" e "Produto/Serviço".');
  }

  const images = extractImages(buffer);
  const dataRows = rows.slice(1).filter((r) => r && r[idx.nome] != null && String(r[idx.nome]).trim());

  // O número de fotos embebidas raramente bate certo com o de linhas de
  // dados quando a folha de imagens foi editada à parte — a associação é por
  // POSIÇÃO (ver extractImages), por isso um total diferente é sinal de que
  // a correspondência pode estar desalinhada. Avisa; não bloqueia.
  const warnings = [];
  if (images.length && images.length !== dataRows.length) {
    warnings.push(
      `O ficheiro tem ${images.length} imagem(ns) mas ${dataRows.length} linha(s) de dados — `
      + 'as fotos são associadas por posição (ordem na folha), por isso a correspondência pode estar incorreta. '
      + 'Reveja as fotos publicadas no catálogo.'
    );
  }

  let precosEstimados = 0; let stockPorOmissao = 0; let localizacaoPorOmissao = 0;
  const errors = [];

  // 1.ª passagem: só CPU (parsing das colunas) — continua sequencial porque
  // não há I/O nenhum aqui para paralelizar, e monta o `slug`/`data` de cada
  // linha válida para as passagens seguintes usarem.
  const linhas = [];
  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const excelRow = i + 2; // linha real no Excel (cabeçalho = 1)
    try {
      const nome = String(r[idx.nome]).trim();
      const categoria = String(r[idx.categoria] || 'Geral').trim();
      const isService = norm(idx.tipo >= 0 ? r[idx.tipo] : '').startsWith('serv');
      const code = idx.code >= 0 && r[idx.code] != null ? String(r[idx.code]).trim() : null;
      const seg2 = ((idx.segmento >= 0 ? String(r[idx.segmento] || '') : '').match(/\d+/) || [''])[0];
      const fam4 = ((idx.familia >= 0 ? String(r[idx.familia] || '') : '').match(/\d+/) || [''])[0];
      const origem = idx.origem >= 0 && r[idx.origem] != null ? String(r[idx.origem]).trim() || null : null;
      const precoDaFolha = parsePrice(idx.preco >= 0 ? r[idx.preco] : null);
      const price = precoDaFolha ?? defaultPrice(categoria, code);
      if (precoDaFolha == null) precosEstimados++;

      // Stock: usa a coluna quando presente e válida; sem ela, os defaults de
      // sempre (50 unidades para produto, sem stock aplicável a serviço).
      const stockDaFolha = idx.stock >= 0 ? parsePrice(r[idx.stock]) : null;
      let stockQuantity;
      if (isService) {
        stockQuantity = null;
      } else if (stockDaFolha != null) {
        stockQuantity = Math.max(0, Math.round(stockDaFolha));
      } else {
        stockQuantity = 50;
        stockPorOmissao++;
      }

      // Localização: idem — coluna "Cidade" quando presente, "Luanda" por
      // omissão (cidade e província juntas, como sempre foi).
      const cidadeDaFolha = idx.cidade >= 0 && r[idx.cidade] != null ? String(r[idx.cidade]).trim() : '';
      const cidade = cidadeDaFolha || 'Luanda';
      if (!cidadeDaFolha) localizacaoPorOmissao++;

      const slug = `${slugify(nome)}-${code || i}-${supplierId.slice(0, 8)}`;
      const data = {
        supplierId,
        name: nome,
        sku: code,
        category: categoria,
        description: idx.descricao >= 0 ? r[idx.descricao] : null,
        kind: isService ? 'SERVICO' : 'PRODUTO',
        measurementUnit: idx.uom >= 0 ? (r[idx.uom] || 'un') : 'un',
        unspscCode: code,
        unspscTitle: idx.tituloEN >= 0 ? r[idx.tituloEN] : null,
        unspscSegment: seg2 || null,
        unspscFamily: fam4 || null,
        unspscClass: code ? String(code).slice(0, 6) : null,
        countryOfOrigin: origem,
        unitPrice: price,
        currency: 'AOA',
        leadTimeDays: isService ? 5 : 15,
        availability: 'Em stock',
        stockQuantity,
        city: cidade, province: cidade, country: 'Angola',
        active: true,
      };

      linhas.push({ i, excelRow, nome, code, slug, data, im: images[i] });
    } catch (e) {
      errors.push({ row: excelRow, error: e.message });
    }
  }

  // 2.ª passagem: upload das imagens embebidas em paralelo, em lotes
  // controlados — antes, cada upload esperava pelo anterior mesmo não
  // havendo relação nenhuma entre eles.
  const CONCORRENCIA_IMAGENS = 8;
  await comLimite(linhas, CONCORRENCIA_IMAGENS, async (linha) => {
    if (!linha.im) return;
    try {
      const ext = linha.im.ext === 'jpeg' ? 'jpg' : linha.im.ext;
      linha.data.imageUrl = await storageService.saveFile({
        buffer: linha.im.buffer,
        originalname: `${linha.code || slugify(linha.nome)}.${ext}`,
        mimetype: `image/${linha.im.ext === 'jpg' ? 'jpeg' : linha.im.ext}`,
        keyHint: `cat-${supplierId.slice(0, 8)}-${linha.code || linha.i}`,
        folder: 'catalog',
      });
      linha.comImagem = true;
    } catch (e) {
      // Mesmo comportamento de antes: uma falha no upload derruba só ESTA
      // linha (o produto não chega a ser criado/atualizado), não as outras.
      linha.erro = e.message;
    }
  });

  const linhasComErro = linhas.filter((l) => l.erro);
  for (const l of linhasComErro) errors.push({ row: l.excelRow, error: l.erro });
  const linhasValidas = linhas.filter((l) => !l.erro);

  // 3.ª passagem: UMA query para saber que slugs já existem, em vez de um
  // findUnique por linha — decide create/update em memória.
  const slugs = linhasValidas.map((l) => l.slug);
  const existentes = slugs.length
    ? new Set((await prisma.product.findMany({ where: { slug: { in: slugs } }, select: { slug: true } })).map((p) => p.slug))
    : new Set();

  // 4.ª passagem: create/update em paralelo, em lotes controlados — cada
  // linha continua a poder falhar sozinha (ex.: violação de constraint) sem
  // derrubar as outras, mesma garantia que o `for` sequencial já dava.
  let created = 0; let updated = 0; let withImages = 0;
  const CONCORRENCIA_BD = 20;
  await comLimite(linhasValidas, CONCORRENCIA_BD, async (linha) => {
    try {
      if (existentes.has(linha.slug)) {
        await prisma.product.update({ where: { slug: linha.slug }, data: linha.data });
        updated++;
      } else {
        await prisma.product.create({ data: { ...linha.data, slug: linha.slug } });
        created++;
      }
      if (linha.comImagem) withImages++;
    } catch (e) {
      errors.push({ row: linha.excelRow, error: e.message });
    }
  });

  errors.sort((a, b) => a.row - b.row);

  return {
    total: dataRows.length, created, updated, withImages, errors, warnings,
    precosEstimados, stockPorOmissao, localizacaoPorOmissao,
  };
}

module.exports = { importCatalog, extractImages, parsePrice };
