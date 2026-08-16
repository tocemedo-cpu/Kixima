// src/data/sidebar.test.js
import { describe, test, expect } from 'vitest';
import { SIDEBAR_MENUS, filtrarPorAreas } from './sidebar';

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

describe('filtrarPorAreas — o menu de um assessor restrito', () => {
  const ADMIN_SISTEMA = SIDEBAR_MENUS.ADMIN_SISTEMA;

  function labelsAchatadas(items) {
    return items.flatMap((i) => [i.label, ...(i.children || []).map((c) => c.label)]);
  }

  test('adminAreas VAZIO (Super Admin) devolve o menu inteiro, sem tirar nada', () => {
    expect(filtrarPorAreas(ADMIN_SISTEMA, [])).toEqual(ADMIN_SISTEMA);
    expect(filtrarPorAreas(ADMIN_SISTEMA, undefined)).toEqual(ADMIN_SISTEMA);
  });

  test('um assessor só de Suporte vê "Supplier Development", não vê "Taxa KIXIMA" nem "Gestão de Apólices"', () => {
    const labels = labelsAchatadas(filtrarPorAreas(ADMIN_SISTEMA, ['suporte']));
    expect(labels).toContain('Supplier Development');
    expect(labels).not.toContain('Taxa KIXIMA');
    expect(labels).not.toContain('Gestão de Apólices');
  });

  test('"Permissões" nunca aparece para um assessor — não é uma área atribuível', () => {
    for (const area of ['cadastro', 'financeiro', 'faturacao', 'apolices', 'suporte', 'operacoes']) {
      const labels = labelsAchatadas(filtrarPorAreas(ADMIN_SISTEMA, [area]));
      expect(labels).not.toContain('Permissões');
    }
  });

  test('"Auditoria" aparece para QUALQUER assessor, mesmo sem a área correspondente a nada', () => {
    const labels = labelsAchatadas(filtrarPorAreas(ADMIN_SISTEMA, ['suporte']));
    expect(labels).toContain('Auditoria');
  });

  test('itens pessoais (Perfil, Segurança, Ajuda) sobrevivem a qualquer filtro', () => {
    const labels = labelsAchatadas(filtrarPorAreas(ADMIN_SISTEMA, ['apolices']));
    expect(labels).toEqual(expect.arrayContaining(['Perfil', 'Segurança', 'Ajuda', 'Dashboard', 'Sair']));
  });

  test('um grupo (ex.: Credenciamento) desaparece por completo fora da sua área', () => {
    const labels = labelsAchatadas(filtrarPorAreas(ADMIN_SISTEMA, ['operacoes']));
    expect(labels).not.toContain('Credenciamento');
    expect(labels).not.toContain('Cadastro de Empresas');
    expect(labels).not.toContain('Empresas');
  });

  test('com a área certa, um assessor de Operações vê "Gestão de Atividades" e "Prontidão"', () => {
    const labels = labelsAchatadas(filtrarPorAreas(ADMIN_SISTEMA, ['operacoes']));
    expect(labels).toContain('Gestão de Atividades');
    expect(labels).toContain('Prontidão para produção');
  });

  test('duas áreas juntas somam o que cada uma dava sozinha', () => {
    const labels = labelsAchatadas(filtrarPorAreas(ADMIN_SISTEMA, ['apolices', 'financeiro']));
    expect(labels).toContain('Gestão de Apólices');
    expect(labels).toContain('Taxa KIXIMA');
    expect(labels).not.toContain('Supplier Development');
  });
});
