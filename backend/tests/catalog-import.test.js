// tests/catalog-import.test.js
// Importação de catálogo em massa por Excel (.xlsx): dados (categoria, tipo,
// UNSPSC, país de origem, preço) e idempotência. As imagens embebidas são
// verificadas manualmente (o SheetJS não escreve imagens); aqui cobrimos o
// caminho de dados com um ficheiro construído em memória.
const XLSX = require('xlsx');
const AdmZip = require('adm-zip');
const { auth, prisma, loginAll } = require('./helpers');
const importService = require('../src/services/catalogImportService');

let tokens;
let supplierId;

function buildXlsxBuffer(rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Catálogo');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const HEADER = ['Categoria', 'Produto/Serviço', 'Descrição', 'Tipo', 'UOM', 'Código UNSPSC', 'Título Oficial UNSPSC', 'Segmento UNSPSC', 'Família UNSPSC', 'País de Origem', 'Preço'];
const HEADER_COM_STOCK_CIDADE = [...HEADER, 'Stock', 'Cidade'];

// O SheetJS (`xlsx`) não escreve desenhos/imagens embebidas — para testar o
// aviso de desalinhamento (extractImages conta ficheiros em xl/drawings/,
// sem depender da relação com a folha), injeta-se um drawing.xml + media
// mínimos diretamente no .xlsx via adm-zip, imitando o que o Excel produz.
function comImagensFalsas(buffer, quantidade) {
  const zip = new AdmZip(buffer);
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  let anchors = '';
  let rels = '';
  for (let i = 1; i <= quantidade; i++) {
    anchors += `<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${i}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:pic><xdr:blipFill><a:blip r:embed="rId${i}"/></xdr:blipFill></xdr:pic></xdr:oneCellAnchor>`;
    rels += `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i}.png"/>`;
    zip.addFile(`xl/media/image${i}.png`, PNG);
  }
  const drawingXml = `<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`;
  const relsXml = `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
  zip.addFile('xl/drawings/drawing1.xml', Buffer.from(drawingXml));
  zip.addFile('xl/drawings/_rels/drawing1.xml.rels', Buffer.from(relsXml));
  return zip.toBuffer();
}

let planoOriginal;

beforeAll(async () => {
  tokens = await loginAll();
  const sup = await prisma.company.findFirst({ where: { type: 'FORNECEDOR' } });
  supplierId = sup.id;

  // O carregamento em massa é do plano Pro, e esta suite não punha lá a
  // empresa — passava porque OUTRO ficheiro de teste a deixava em Pro e o
  // Jest calhava correr esse primeiro. Uma dependência invisível entre
  // ficheiros que partilham a mesma base: verde ou vermelho conforme a ordem,
  // e a falha aponta para o sítio errado quando aparece.
  planoOriginal = sup.plan;
  await prisma.company.update({ where: { id: supplierId }, data: { plan: 'PRO' } });
});

afterAll(async () => {
  // Os produtos importados ficavam na base. Não é lixo inofensivo: têm
  // `countryOfOrigin` preenchido, e o relatório de conteúdo local afirma que
  // NENHUM produto do seed tem origem declarada. Estes sobreviventes punham
  // essa percentagem acima de zero e faziam falhar um teste noutro ficheiro,
  // que não tinha nada a ver com importação nenhuma.
  await prisma.product.deleteMany({
    where: {
      supplierId,
      name: {
        in: [
          'Válvula de teste', 'Inspeção de teste',
          'Válvula com preço de teste', 'Válvula sem preço de teste',
          'Bomba com stock de teste', 'Bomba sem stock de teste',
          'Item com fotos desalinhadas', 'Item com fotos alinhadas',
        ],
      },
    },
  });
  if (planoOriginal) {
    await prisma.company.update({ where: { id: supplierId }, data: { plan: planoOriginal } });
  }
  await prisma.$disconnect();
});

describe('parsePrice', () => {
  test('interpreta formatos AOA e números', () => {
    expect(importService.parsePrice('1.250.000,00 AOA')).toBe(1250000);
    expect(importService.parsePrice('850000')).toBe(850000);
    expect(importService.parsePrice(120000)).toBe(120000);
    expect(importService.parsePrice('')).toBeNull();
    expect(importService.parsePrice(null)).toBeNull();
  });
});

describe('importCatalog (dados)', () => {
  test('cria produtos e serviços com UNSPSC, origem e preço', async () => {
    const buf = buildXlsxBuffer([
      HEADER,
      ['Válvulas e Conexões', 'Válvula de teste', 'Válvula de esfera de teste', 'Produto', 'un', '40141607', 'Ball valves', '40 — X', '4014 — Y', 'EUA', '1.500.000,00 AOA'],
      ['Inspeção, Testes e Certificação', 'Inspeção de teste', 'Serviço de inspeção', 'Serviço', 'serviço', '81141804', 'Inspection', '81 — Z', '8114 — W', 'Angola', ''],
    ]);
    const res = await importService.importCatalog(buf, supplierId);
    expect(res.total).toBe(2);
    expect(res.created + res.updated).toBe(2);
    expect(res.errors).toHaveLength(0);

    const prod = await prisma.product.findFirst({ where: { supplierId, name: 'Válvula de teste' } });
    expect(prod.kind).toBe('PRODUTO');
    expect(prod.unspscCode).toBe('40141607');
    expect(prod.unspscSegment).toBe('40');
    expect(prod.unspscFamily).toBe('4014');
    expect(prod.countryOfOrigin).toBe('EUA');
    expect(Number(prod.unitPrice)).toBe(1500000);
    expect(prod.currency).toBe('AOA');

    const serv = await prisma.product.findFirst({ where: { supplierId, name: 'Inspeção de teste' } });
    expect(serv.kind).toBe('SERVICO');
    expect(serv.countryOfOrigin).toBe('Angola');
    // sem coluna de preço preenchida → preço estimado (> 0)
    expect(Number(serv.unitPrice)).toBeGreaterThan(0);
  });

  test('é idempotente (reimportar atualiza, não duplica)', async () => {
    const rows = [HEADER, ['Bombas e Compressores', 'Bomba de teste', 'Bomba', 'Produto', 'un', '40151503', 'Pumps', '40 — X', '4015 — Y', 'Angola', '900000']];
    const buf = buildXlsxBuffer(rows);
    const r1 = await importService.importCatalog(buf, supplierId);
    const r2 = await importService.importCatalog(buf, supplierId);
    expect(r2.created).toBe(0);
    expect(r2.updated).toBe(1);
    const count = await prisma.product.count({ where: { supplierId, name: 'Bomba de teste' } });
    expect(count).toBe(1);
  });

  test('rejeita ficheiro sem as colunas mínimas', async () => {
    const buf = buildXlsxBuffer([['Coluna A', 'Coluna B'], ['x', 'y']]);
    await expect(importService.importCatalog(buf, supplierId)).rejects.toThrow(/Categoria|Produto/);
  });

  test('endpoint HTTP: só Fornecedor/Company Admin importam', async () => {
    const buf = buildXlsxBuffer([HEADER, ['Segurança e EPI', 'Capacete de teste', 'Capacete', 'Produto', 'un', '46181503', 'Helmet', '46 — X', '4618 — Y', 'Angola', '30000']]);
    const ok = await auth(tokens.fornecedor).post('/api/catalog/import').attach('file', buf, 'catalogo.xlsx');
    expect(ok.status).toBe(201);
    expect(ok.body.total).toBe(1);

    const denied = await auth(tokens.comprador).post('/api/catalog/import').attach('file', buf, 'catalogo.xlsx');
    expect(denied.status).toBe(403);
  });

  test('conta preços estimados quando a coluna Preço vem vazia', async () => {
    const buf = buildXlsxBuffer([
      HEADER,
      ['Válvulas e Conexões', 'Válvula com preço de teste', 'x', 'Produto', 'un', '', '', '', '', '', '700000'],
      ['Válvulas e Conexões', 'Válvula sem preço de teste', 'x', 'Produto', 'un', '', '', '', '', '', ''],
    ]);
    const res = await importService.importCatalog(buf, supplierId);
    expect(res.precosEstimados).toBe(1);
  });

  test('usa as colunas Stock e Cidade quando presentes; conta por omissão quando ausentes', async () => {
    const buf = buildXlsxBuffer([
      HEADER_COM_STOCK_CIDADE,
      ['Bombas e Compressores', 'Bomba com stock de teste', 'x', 'Produto', 'un', '', '', '', '', '', '500000', '17', 'Cabinda'],
      ['Bombas e Compressores', 'Bomba sem stock de teste', 'x', 'Produto', 'un', '', '', '', '', '', '500000', '', ''],
    ]);
    const res = await importService.importCatalog(buf, supplierId);
    expect(res.stockPorOmissao).toBe(1);
    expect(res.localizacaoPorOmissao).toBe(1);

    const comColuna = await prisma.product.findFirst({ where: { supplierId, name: 'Bomba com stock de teste' } });
    expect(comColuna.stockQuantity).toBe(17);
    expect(comColuna.city).toBe('Cabinda');
    expect(comColuna.province).toBe('Cabinda');

    const semColuna = await prisma.product.findFirst({ where: { supplierId, name: 'Bomba sem stock de teste' } });
    expect(semColuna.stockQuantity).toBe(50);
    expect(semColuna.city).toBe('Luanda');
  });

  test('avisa quando o número de fotos não bate com o de linhas de dados', async () => {
    const base = buildXlsxBuffer([
      HEADER,
      ['Elétrico, Iluminação e Automação', 'Item com fotos desalinhadas', 'x', 'Produto', 'un', '', '', '', '', '', '400000'],
    ]);
    // 1 linha de dados, 2 "fotos" embebidas — desalinhado de propósito.
    const buf = comImagensFalsas(base, 2);
    const res = await importService.importCatalog(buf, supplierId);
    expect(res.warnings).toHaveLength(1);
    expect(res.warnings[0]).toMatch(/2 imagem/);
    expect(res.warnings[0]).toMatch(/1 linha/);
  });

  test('não avisa quando o número de fotos bate com o de linhas', async () => {
    const base = buildXlsxBuffer([
      HEADER,
      ['Elétrico, Iluminação e Automação', 'Item com fotos alinhadas', 'x', 'Produto', 'un', '', '', '', '', '', '400000'],
    ]);
    const buf = comImagensFalsas(base, 1);
    const res = await importService.importCatalog(buf, supplierId);
    expect(res.warnings).toHaveLength(0);
    expect(res.withImages).toBe(1);
  });
});
