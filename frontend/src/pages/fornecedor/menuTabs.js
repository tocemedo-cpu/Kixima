// src/pages/fornecedor/menuTabs.js
// Listas de RouteTabs partilhadas pelas páginas de um mesmo grupo do menu do
// Fornecedor (ver data/sidebar.js — cada acordeão colapsou num link único, e
// os destinos que tinha viraram estes botões DENTRO das páginas do grupo).
// Cada array é usado por 2 ou mais páginas — vive aqui uma vez só, para as
// páginas nunca poderem divergir sobre quais são os destinos do grupo.

export const CATALOGO_TABS = [
  { label: 'Produtos & Serviços', to: '/fornecedor/catalogo', end: true },
  { label: 'Importar (Excel)', to: '/fornecedor/catalogo/importar' },
  { label: 'Categorias', to: '/fornecedor/catalogo/categorias' },
  { label: 'Marcas', to: '/fornecedor/catalogo/marcas' },
  { label: 'Kits', to: '/fornecedor/catalogo/kits' },
  { label: 'Promoções', to: '/fornecedor/catalogo/promocoes' },
];

export const INVENTARIO_TABS = [
  { label: 'Stock', to: '/fornecedor/inventario/stock', end: true },
  { label: 'Entradas', to: '/fornecedor/inventario/entradas' },
  { label: 'Saídas', to: '/fornecedor/inventario/saidas' },
  { label: 'Armazéns', to: '/fornecedor/inventario/armazens' },
];

export const PEDIDOS_TABS = [
  { label: 'Solicitações', to: '/fornecedor/pedidos/solicitacoes' },
  { label: 'Cotações', to: '/fornecedor/pedidos/cotacoes' },
  { label: 'Ordens', to: '/fornecedor/ordens', end: true },
  { label: 'Histórico', to: '/fornecedor/pedidos/historico' },
];

export const FINANCEIRO_TABS = [
  { label: 'Pagamentos', to: '/fornecedor/pagamentos', end: true },
  { label: 'Faturas', to: '/fornecedor/faturas', end: true },
  { label: 'Carteira', to: '/fornecedor/financeiro/carteira' },
];

export const RELATORIOS_TABS = [
  { label: 'Produtos mais vistos', to: '/fornecedor/relatorios/mais-vistos' },
  { label: 'Produtos mais vendidos', to: '/fornecedor/relatorios/mais-vendidos' },
  { label: 'Estatísticas', to: '/fornecedor/relatorios/estatisticas' },
];
