// src/data/sidebar.test.js
import { describe, test, expect } from 'vitest';
import { SIDEBAR_MENUS } from './sidebar';

describe('menu do comprador', () => {
  const COMPRADOR = SIDEBAR_MENUS.COMPRADOR;

  test('existe um menu "Catálogo" com submenus Produtos e Serviços', () => {
    const catalogo = COMPRADOR.find((m) => m.label === 'Catálogo');
    expect(catalogo).toBeTruthy();
    const childLabels = (catalogo.children || []).map((c) => c.label);
    expect(childLabels).toContain('Produtos');
    expect(childLabels).toContain('Serviços');
  });

  test('já não existe o menu antigo "Produtos / Serviços"', () => {
    expect(COMPRADOR.find((m) => m.label === 'Produtos / Serviços')).toBeUndefined();
  });

  test('Produtos aponta para /comprador/catalogo e Serviços para /comprador/servicos', () => {
    const catalogo = COMPRADOR.find((m) => m.label === 'Catálogo');
    const byLabel = Object.fromEntries(catalogo.children.map((c) => [c.label, c.to]));
    expect(byLabel.Produtos).toBe('/comprador/catalogo');
    expect(byLabel.Serviços).toBe('/comprador/servicos');
  });
});

describe('menus por papel', () => {
  test('todos os papéis têm um menu definido', () => {
    for (const role of ['COMPRADOR', 'COMPANY_ADMIN', 'FORNECEDOR', 'FINANCEIRO', 'ADMIN_SISTEMA']) {
      expect(Array.isArray(SIDEBAR_MENUS[role])).toBe(true);
      expect(SIDEBAR_MENUS[role].length).toBeGreaterThan(0);
    }
  });

  test('o Admin do Sistema tem o livro "Taxa KIXIMA"', () => {
    expect(SIDEBAR_MENUS.ADMIN_SISTEMA.some((m) => m.label === 'Taxa KIXIMA')).toBe(true);
  });
});
