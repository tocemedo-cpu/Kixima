// tests/reference.test.js
// As referências (PO-2026-000123) nunca se repetem.
//
// Existe por causa de um 409 intermitente ao criar ordens: o número saía de um
// COUNT das linhas existentes, o que falha de duas maneiras —
//   1) não é atómico: dois pedidos simultâneos contam o mesmo valor e geram a
//      MESMA referência; a segunda gravação rebenta e o comprador leva um erro
//      ao fechar a cesta;
//   2) desfaz-se com qualquer eliminação: o número libertado é reatribuído a
//      uma referência que já existe.
const { nextReference } = require('../src/utils/reference');
const { prisma } = require('./helpers');

describe('Geração de referências', () => {
  test('o formato é PREFIXO-ANO-000000', async () => {
    const ref = await nextReference('TST', 'purchaseOrder');
    expect(ref).toMatch(/^TST-\d{4}-\d{6}$/);
  });

  test('pedidos SIMULTÂNEOS recebem referências diferentes', async () => {
    const refs = await Promise.all(Array.from({ length: 25 }, () => nextReference('CNC', 'purchaseOrder')));
    expect(new Set(refs).size).toBe(refs.length);
  });

  test('o contador não recua quando se apagam linhas', async () => {
    const antes = await nextReference('DEL', 'purchaseOrder');
    // Apagar ordens não pode libertar números já emitidos.
    await prisma.purchaseOrder.deleteMany({ where: { reference: { startsWith: 'DEL-' } } });
    const depois = await nextReference('DEL', 'purchaseOrder');
    expect(Number(depois.split('-').pop())).toBeGreaterThan(Number(antes.split('-').pop()));
  });

  test('nunca repete uma referência já existente na tabela', async () => {
    // Referência antiga com 5 dígitos (formato legado) — o contador tem de
    // arrancar ACIMA dela, e não somar-lhe o hífen.
    const ano = new Date().getFullYear();
    await prisma.$executeRawUnsafe('DELETE FROM reference_counters WHERE key = $1', `LEG-${ano}`);
    const po = await prisma.purchaseOrder.findFirst();
    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { reference: `LEG-${ano}-00042` } });

    const nova = await nextReference('LEG', 'purchaseOrder');
    expect(Number(nova.split('-').pop())).toBeGreaterThan(42);

    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { reference: po.reference } });
  });
});
