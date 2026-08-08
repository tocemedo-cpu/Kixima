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
  { label: 'Perfil da Empresa', icon: 'building', to: '/fornecedor/empresa' },
  {
    label: 'Catálogo', icon: 'catalog', children: [
      { label: 'Produtos & Serviços', to: '/fornecedor/catalogo' },
      { label: 'Importar (Excel)', to: '/fornecedor/catalogo/importar' },
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
    // Documentação de produto (o vendedor gere o catálogo). Os documentos da
    // EMPRESA (licenças/alvarás) são geridos apenas pelo Company Admin.
    label: 'Documentação', icon: 'contract', children: [
      { label: 'Certificados de Produto', to: '/fornecedor/documentacao/certificacoes' },
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
      { label: 'Segurança', to: '/seguranca' },
      { label: 'Notificações', to: '/notificacoes' },
    ],
  },
  ...COMMON_TAIL,
];

// Bloco de configurações pessoais, comum às personas.
const CONFIG = {
  label: 'Configurações', icon: 'settings', children: [
    { label: 'Perfil', to: '/perfil' },
    { label: 'Segurança', to: '/seguranca' },
    { label: 'Notificações', to: '/notificacoes' },
  ],
};

// Comprador — descobrir, encomendar e acompanhar (não gere catálogo próprio).
const COMPRADOR = [
  { label: 'Home Marketplace', icon: 'home', to: '/comprador', end: true },
  { label: 'Explorar / Pesquisa', icon: 'search', to: '/comprador/explorar' },
  {
    label: 'Catálogo', icon: 'catalog', children: [
      { label: 'Produtos', to: '/comprador/catalogo' },
      { label: 'Serviços', to: '/comprador/servicos' },
    ],
  },
  { label: 'Minha Cesta', icon: 'cart', to: '/comprador/cesta', badge: 'cart' },
  { label: 'Checkout', icon: 'checkout', to: '/comprador/checkout' },
  {
    label: 'Ordens de Compra', icon: 'orders', children: [
      { label: 'Todas as Ordens', to: '/comprador/ordens' },
      { label: 'Acompanhar Entrega', to: '/comprador/entregas' },
      { label: 'Recepção', to: '/comprador/recepcao' },
    ],
  },
  { label: 'Pagamento', icon: 'payment', to: '/comprador/pagamentos' },
  { label: 'Fornecedores', icon: 'suppliers', to: '/comprador/fornecedores' },
  { label: 'Atividades', icon: 'activities', to: '/comprador/atividades' },
  { label: 'Perfil', icon: 'profile', to: '/comprador/perfil' },
  ...COMMON_TAIL,
];

// Company Admin — aprova POs, gere equipa, a organização e os contratos.
const COMPANY_ADMIN = [
  { label: 'Dashboard', icon: 'home', to: '/empresa', end: true },
  { label: 'Usuários & Perfis', icon: 'users', to: '/empresa/utilizadores' },
  { label: 'Permissões', icon: 'shield', to: '/empresa/permissoes' },
  { label: 'Perfil da Empresa', icon: 'building', to: '/empresa/organizacao' },
  { label: 'Documentos da Empresa', icon: 'contract', to: '/empresa/documentos' },
  { label: 'Aprovações de PO', icon: 'approvals', to: '/empresa/aprovacoes' },
  { label: 'Contratos', icon: 'contract', to: '/empresa/contratos' },
  { label: 'Relatórios', icon: 'report', to: '/empresa/relatorios' },
  { label: 'Atividades', icon: 'activities', to: '/empresa/atividades' },
  { label: 'Configurações', icon: 'settings', to: '/empresa/configuracoes' },
  ...COMMON_TAIL,
];

// Financeiro — paga faturas dentro do SLA e acompanha o histórico.
const FINANCEIRO = [
  { label: 'Centro Financeiro', icon: 'wallet', to: '/financeiro', end: true },
  { label: 'Faturas', icon: 'invoice', to: '/financeiro/faturas' },
  { label: 'Pagamentos', icon: 'payment', to: '/financeiro/historico' },
  ...COMMON_TAIL,
];

// Admin do Sistema KIXIMA — credenciamento, apólices e contratos-quadro.
const ADMIN_SISTEMA = [
  { label: 'Dashboard', icon: 'home', to: '/sistema', end: true },
  {
    label: 'Credenciamento', icon: 'dueDiligence', children: [
      { label: 'Cadastro de Empresas', to: '/sistema/due-diligence' },
      { label: 'Empresas', to: '/sistema/empresas' },
    ],
  },
  { label: 'Gestão de Apólices', icon: 'policy', to: '/sistema/apolices' },
  { label: 'Integrações ERP', icon: 'offshore', to: '/sistema/integracoes-erp' },
  { label: 'Contratos-Quadro', icon: 'contract', to: '/sistema/contratos' },
  { label: 'Taxa KIXIMA', icon: 'wallet', to: '/sistema/taxas' },
  {
    // No Admin do Sistema, o suporte e a ajuda vivem dentro das configurações.
    label: 'Configurações e Suporte', icon: 'settings', children: [
      { label: 'Perfil', to: '/perfil' },
      { label: 'Segurança', to: '/seguranca' },
      { label: 'Permissões', to: '/sistema/permissoes' },
      { label: 'Gestão de Atividades', to: '/sistema/atividades' },
      { label: 'Ajuda', to: '/ajuda' },
    ],
  },
  { label: 'Sair', icon: 'logout', action: 'logout' },
];

export const SIDEBAR_MENUS = { COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA };
