// src/data/sidebar.test.js
import { describe, test, expect } from 'vitest';
import { SIDEBAR_MENUS, filtrarPorAreas } from './sidebar';

describe('menu do comprador', () => {
  const COMPRADOR = SIDEBAR_MENUS.COMPRADOR;

  // Produtos/Serviços deixaram de ser submenu na sidebar — passaram a botões
  // DENTRO da página Catálogo (RouteTabs, ver Catalog.jsx/Services.jsx). O
  // menu em si é agora um link directo, sem `children`.
  test('"Catálogo" é um link directo para /comprador/catalogo, sem submenu', () => {
    const catalogo = COMPRADOR.find((m) => m.label === 'Catálogo');
    expect(catalogo).toBeTruthy();
    expect(catalogo.to).toBe('/comprador/catalogo');
    expect(catalogo.children).toBeUndefined();
  });

  // Idem para Ordens de Compra: Todas as Ordens/Acompanhar Entrega/Recepção
  // viraram botões dentro da página (RouteTabs em Orders/Deliveries/Receptions.jsx).
  test('"Ordens de Compra" é um link directo para /comprador/ordens, sem submenu', () => {
    const ordens = COMPRADOR.find((m) => m.label === 'Ordens de Compra');
    expect(ordens).toBeTruthy();
    expect(ordens.to).toBe('/comprador/ordens');
    expect(ordens.children).toBeUndefined();
  });

  test('já não existe "Explorar / Pesquisa" nem "Checkout" como itens de menu', () => {
    expect(COMPRADOR.find((m) => m.label === 'Explorar / Pesquisa')).toBeUndefined();
    expect(COMPRADOR.find((m) => m.label === 'Checkout')).toBeUndefined();
  });
});

// O Fornecedor tinha 9 itens de topo + 7 acordeões (27 destinos). Cada
// acordeão colapsou num único link; os seus destinos viraram botões (RouteTabs)
// dentro das páginas do grupo (CatalogManage/CatalogImport/CatalogInsights/
// Kits, Inventory/StockMovements, OrdersReceived/SupplierQuotes/OrderHistory,
// Invoices/Payments/Wallet, Documents, ProductRanking/Reports).
describe('menu do fornecedor', () => {
  const FORNECEDOR = SIDEBAR_MENUS.FORNECEDOR;

  test('nenhum item tem `children` — todos os acordeões colapsaram em links directos', () => {
    for (const item of FORNECEDOR) expect(item.children).toBeUndefined();
  });

  test('"API de catálogo" foi eliminada — não é alcançável a partir de nenhum item', () => {
    const labels = FORNECEDOR.map((m) => m.label);
    const tos = FORNECEDOR.map((m) => m.to);
    expect(labels).not.toContain('API de catálogo');
    expect(tos).not.toContain('/fornecedor/api');
  });

  test('Catálogo, Inventário, Ordens, Faturas, Documentação e Relatórios são links directos aos destinos certos', () => {
    const byLabel = Object.fromEntries(FORNECEDOR.map((m) => [m.label, m.to]));
    expect(byLabel['Catálogo']).toBe('/fornecedor/catalogo');
    expect(byLabel['Inventário']).toBe('/fornecedor/inventario/stock');
    expect(byLabel['Ordens']).toBe('/fornecedor/ordens');
    expect(byLabel['Faturas']).toBe('/fornecedor/faturas');
    expect(byLabel['Documentação']).toBe('/fornecedor/documentacao/certificacoes');
    expect(byLabel['Relatórios']).toBe('/fornecedor/relatorios/estatisticas');
  });
});

// Suporte — Chat, Suporte — Feedback e Chat Comercial não têm item próprio na
// sidebar (nem solto, nem agrupado num menu "Chat") — vivem como botões
// dentro da página Ajuda (ver Help.jsx, atalhos "hs-quickcard"). Só "Ajuda"
// fica no rodapé comum a todas as personas.
describe('COMMON_TAIL — Suporte/Chat Comercial vivem em Ajuda, não na sidebar', () => {
  test.each(['COMPRADOR', 'COMPANY_ADMIN', 'FORNECEDOR', 'FINANCEIRO'])(
    '%s não tem "Chat", "Suporte — Chat", "Suporte — Feedback" nem "Chat Comercial" na sidebar',
    (papel) => {
      const menu = SIDEBAR_MENUS[papel];
      for (const label of ['Chat', 'Suporte — Chat', 'Suporte — Feedback', 'Chat Comercial']) {
        expect(menu.find((m) => m.label === label)).toBeUndefined();
      }
      expect(menu.find((m) => m.label === 'Ajuda')).toBeTruthy();
    },
  );
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
