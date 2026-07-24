// src/data/sidebar.js
// Fonte única da navegação da sidebar. Cada persona tem um array de itens; a
// Sidebar gera o menu automaticamente por map(). Um item pode ser:
//   - link:      { label, icon, to, end? }
//   - accordion: { label, icon, children: [ { label, to }, ... ] }
//   - ação:      { label, icon, action: 'logout' }
// Para adicionar/alterar menus basta editar este ficheiro — nada de código novo.

// Itens comuns ao rodapé de todas as personas.
const COMMON_TAIL = [
  { label: 'Ajuda', icon: 'help', to: '/ajuda' },
  { label: 'Sair', icon: 'logout', action: 'logout' },
];

// Estrutura ERP completa da visão do Fornecedor (SAP Ariba / Oracle-like).
const FORNECEDOR = [
  { label: 'Dashboard', icon: 'home', to: '/fornecedor', end: true },
  { label: 'Empresa', icon: 'building', to: '/fornecedor/perfil' },
  {
    label: 'Catálogo', icon: 'catalog', children: [
      { label: 'Produtos', to: '/fornecedor/catalogo' },
      { label: 'Serviços', to: '/fornecedor/catalogo/servicos' },
      { label: 'Categorias', to: '/fornecedor/catalogo/categorias' },
      { label: 'Marcas', to: '/fornecedor/catalogo/marcas' },
      { label: 'Kits', to: '/fornecedor/catalogo/kits' },
      { label: 'Promoções', to: '/fornecedor/catalogo/promocoes' },
    ],
  },
  {
    label: 'Inventário', icon: 'warehouse', children: [
      { label: 'Stock', to: '/fornecedor/inventario/stock' },
      { label: 'Entradas', to: '/fornecedor/inventario/entradas' },
      { label: 'Saídas', to: '/fornecedor/inventario/saidas' },
      { label: 'Armazéns', to: '/fornecedor/inventario/armazens' },
    ],
  },
  {
    label: 'Pedidos', icon: 'orders', children: [
      { label: 'Solicitações', to: '/fornecedor/pedidos/solicitacoes' },
      { label: 'Cotações', to: '/fornecedor/pedidos/cotacoes' },
      { label: 'Ordens', to: '/fornecedor/ordens' },
      { label: 'Histórico', to: '/fornecedor/pedidos/historico' },
    ],
  },
  {
    label: 'Financeiro', icon: 'wallet', children: [
      { label: 'Pagamentos', to: '/fornecedor/pagamentos' },
      { label: 'Faturas', to: '/fornecedor/faturas' },
      { label: 'Carteira', to: '/fornecedor/financeiro/carteira' },
    ],
  },
  {
    label: 'Documentação', icon: 'contract', children: [
      { label: 'Certificações', to: '/fornecedor/documentacao/certificacoes' },
      { label: 'Licenças', to: '/fornecedor/documentacao/licencas' },
      { label: 'Catálogos PDF', to: '/fornecedor/documentacao/catalogos' },
      { label: 'Fichas Técnicas', to: '/fornecedor/documentacao/fichas' },
    ],
  },
  {
    label: 'Relatórios', icon: 'report', children: [
      { label: 'Produtos mais vistos', to: '/fornecedor/relatorios/mais-vistos' },
      { label: 'Produtos mais vendidos', to: '/fornecedor/relatorios/mais-vendidos' },
      { label: 'Estatísticas', to: '/fornecedor/relatorios/estatisticas' },
    ],
  },
  {
    label: 'Configurações', icon: 'settings', children: [
      { label: 'Perfil', to: '/perfil' },
      { label: 'Segurança', to: '/fornecedor/configuracoes/seguranca' },
      { label: 'Notificações', to: '/notificacoes' },
    ],
  },
  ...COMMON_TAIL,
];

// Personas restantes — listas simples (a Sidebar rende-as como links diretos).
const COMPRADOR = [
  { label: 'Início', icon: 'home', to: '/comprador', end: true },
  { label: 'Catálogo', icon: 'catalog', to: '/comprador/catalogo' },
  { label: 'Cesta', icon: 'cart', to: '/comprador/cesta', badge: 'cart' },
  { label: 'Ordens de Compra', icon: 'orders', to: '/comprador/ordens' },
  ...COMMON_TAIL,
];
const COMPANY_ADMIN = [
  { label: 'Início', icon: 'home', to: '/empresa', end: true },
  { label: 'Aprovações de PO', icon: 'approvals', to: '/empresa/aprovacoes' },
  { label: 'Utilizadores & Perfis', icon: 'users', to: '/empresa/utilizadores' },
  { label: 'Perfil da Empresa', icon: 'building', to: '/empresa/perfil' },
  { label: 'Contratos', icon: 'contract', to: '/empresa/contratos' },
  ...COMMON_TAIL,
];
const FINANCEIRO = [
  { label: 'Início', icon: 'home', to: '/financeiro', end: true },
  { label: 'Faturas Pendentes', icon: 'invoice', to: '/financeiro/faturas' },
  { label: 'Histórico de Pagamentos', icon: 'history', to: '/financeiro/historico' },
  { label: 'Perfil da Empresa', icon: 'building', to: '/financeiro/perfil' },
  ...COMMON_TAIL,
];
const ADMIN_SISTEMA = [
  { label: 'Início', icon: 'home', to: '/sistema', end: true },
  { label: 'Cadastro de Empresas', icon: 'dueDiligence', to: '/sistema/due-diligence' },
  { label: 'Gestão de Apólices', icon: 'policy', to: '/sistema/apolices' },
  { label: 'Contratos-Quadro', icon: 'contract', to: '/sistema/contratos' },
  { label: 'Empresas', icon: 'suppliers', to: '/sistema/empresas' },
  ...COMMON_TAIL,
];

export const SIDEBAR_MENUS = { COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA };
