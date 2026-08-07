// tests/catalog-import.test.js
// Importação de catálogo em massa por Excel (.xlsx): dados (categoria, tipo,
// UNSPSC, país de origem, preço) e idempotência. As imagens embebidas são
// verificadas manualmente (o SheetJS não escreve imagens); aqui cobrimos o
// caminho de dados com um ficheiro construído em memória.
const XLSX = require('xlsx');
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

beforeAll(async () => {
  tokens = await loginAll();
  const sup = await prisma.company.findFirst({ where: { type: 'FORNECEDOR' } });
  supplierId = sup.id;
});
afterAll(async () => { await prisma.$disconnect(); });

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
});
