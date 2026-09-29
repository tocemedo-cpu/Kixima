// src/data/sidebar.js
// Fonte única da navegação da sidebar. Cada persona tem um array de itens; a
// Sidebar gera o menu automaticamente por map(). Um item pode ser:
//   - link:      { label, icon, to, end? }
//   - accordion: { label, icon, children: [ { label, to }, ... ] }
//   - ação:      { label, icon, action: 'logout' }
// Para adicionar/alterar menus basta editar este ficheiro — nada de código novo.

// Itens comuns ao rodapé de todas as personas.
//
// Suporte — Chat, Suporte — Feedback e Chat Comercial deixaram de ter item
// próprio na sidebar — não formam um menu à parte. Os três vivem agora como
// botões dentro da página Ajuda (Help.jsx, cartões "hs-quickcard", o mesmo
// padrão já usado por "Perguntas Frequentes"/"Contato com Suporte"/"Tickets
// Abertos"), alcançável a partir do único item "Ajuda" abaixo.
const COMMON_TAIL = [
  { label: 'Ajuda', icon: 'help', to: '/ajuda' },
  { label: 'Sair', icon: 'logout', action: 'logout' },
];

// Estrutura do Fornecedor. Já foi uma árvore de ERP (SAP Ariba/Oracle-like) —
// nove itens de topo, sete acordeões, 27 entradas. Cada acordeão colapsou num
// único link; os seus destinos passaram a botões (RouteTabs) DENTRO das
// páginas do próprio grupo, tal como no Comprador (Catálogo/Ordens de Compra).
// "API de catálogo" foi eliminada (deixou de ter botão nem rota alcançável
// daqui). "Configurações" fica só como link — Perfil/Segurança/Notificações
// são páginas partilhadas por todas as personas, não exclusivas do Fornecedor.
const FORNECEDOR = [
  { label: 'Dashboard', icon: 'home', to: '/fornecedor', end: true },
  { label: 'Catálogo', icon: 'catalog', to: '/fornecedor/catalogo', end: true },
  { label: 'Inventário', icon: 'warehouse', to: '/fornecedor/inventario/stock' },
  { label: 'Ordens', icon: 'orders', to: '/fornecedor/ordens' },
  { label: 'Faturas', icon: 'invoice', to: '/fornecedor/faturas' },
  {
    // Documentação de produto (o vendedor gere o catálogo). Os documentos da
    // EMPRESA (licenças/alvarás) são geridos apenas pelo Company Admin.
    label: 'Documentação', icon: 'contract', to: '/fornecedor/documentacao/certificacoes',
  },
  { label: 'Relatórios', icon: 'report', to: '/fornecedor/relatorios/estatisticas' },
  { label: 'Configurações', icon: 'settings', to: '/perfil' },
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
//
// Catálogo e Ordens de Compra deixaram de ter submenu na sidebar: Produtos/
// Serviços e Todas as Ordens/Acompanhar Entrega/Recepção passaram a ser
// botões DENTRO de cada página (RouteTabs, ver Catalog.jsx/Services.jsx e
// Orders.jsx/Deliveries.jsx/Receptions.jsx). Checkout deixou de ser item de
// menu — vive como botão dentro do Catálogo (e continua alcançável a partir
// da Cesta, como sempre esteve).
const COMPRADOR = [
  { label: 'Home Marketplace', icon: 'home', to: '/comprador', end: true },
  { label: 'Catálogo', icon: 'catalog', to: '/comprador/catalogo' },
  { label: 'Minha Cesta', icon: 'cart', to: '/comprador/cesta', badge: 'cart' },
  { label: 'Ordens de Compra', icon: 'orders', to: '/comprador/ordens' },
  { label: 'Pagamento', icon: 'payment', to: '/comprador/pagamentos' },
  { label: 'Fornecedores', icon: 'suppliers', to: '/comprador/fornecedores' },
  { label: 'Economia de Escala', icon: 'chart', to: '/comprador/economia-de-escala' },
  { label: 'Automatic PO Robot', icon: 'engineering', to: '/comprador/po-robot' },
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
  { label: 'Conteúdo local', icon: 'chart', to: '/empresa/conteudo-local' },
  { label: 'Subscrição', icon: 'wallet', to: '/empresa/assinatura' },
  { label: 'Atividades', icon: 'activities', to: '/empresa/atividades' },
  { label: 'Configurações', icon: 'settings', to: '/empresa/configuracoes' },
  ...COMMON_TAIL,
];

// Financeiro — paga faturas dentro do SLA e acompanha o histórico.
const FINANCEIRO = [
  { label: 'Centro Financeiro', icon: 'wallet', to: '/financeiro', end: true },
  { label: 'Faturas', icon: 'invoice', to: '/financeiro/faturas' },
  { label: 'Pagamentos', icon: 'payment', to: '/financeiro/historico' },
  // O Financeiro não escolhe o plano, mas é quem faz as transferências e
  // carrega o comprovativo. Sem esta entrada tinha acesso à página e nenhuma
  // forma de lá chegar.
  { label: 'Subscrição', icon: 'building', to: '/empresa/assinatura' },
  ...COMMON_TAIL,
];

// Financeiro numa empresa FORNECEDORA — vê os DOIS lados: recebe dos clientes
// (confirma a entrada do valor, Taxa KIXIMA) E paga as próprias compras
// (fornecedoras também compram materiais na plataforma). Selecionado no
// AppLayout quando user.companyType === 'FORNECEDOR'.
const FINANCEIRO_FORNECEDOR = [
  { label: 'Centro Financeiro', icon: 'wallet', to: '/financeiro', end: true },
  { label: 'Pagamentos Recebidos', icon: 'payment', to: '/financeiro/recebidos' },
  { label: 'Faturas a Pagar', icon: 'invoice', to: '/financeiro/faturas' },
  { label: 'Pagamentos Feitos', icon: 'history', to: '/financeiro/historico' },
  { label: 'Subscrição', icon: 'building', to: '/empresa/assinatura' },
  ...COMMON_TAIL,
];

// Admin do Sistema KIXIMA — credenciamento, apólices e contratos-quadro.
// Cada entrada do Admin do Sistema abaixo com `area` corresponde a uma área de
// backend/src/utils/adminAreas.js — filtrarPorAreas() esconde o que um
// assessor restrito não pode tocar. Sem `area`, o item é sempre visível
// (Dashboard, Perfil, Segurança, Ajuda) ou é a Auditoria, que fica visível a
// qualquer Admin do Sistema de propósito (ver a nota em adminRoutes.js: quem
// vigia um assessor precisa de ver o rasto de tudo, não só da própria área).
// 'SUPER_ADMIN_ONLY' não é uma área atribuível — nunca aparece em AREAS_ADMIN,
// por isso nenhum assessor a tem, e o item fica reservado ao Super Admin.
const SUPER_ADMIN_ONLY = 'SUPER_ADMIN_ONLY';

const ADMIN_SISTEMA = [
  { label: 'Dashboard', icon: 'home', to: '/sistema', end: true },
  {
    label: 'Credenciamento', icon: 'dueDiligence', area: 'cadastro', children: [
      { label: 'Cadastro de Empresas', to: '/sistema/due-diligence' },
      { label: 'Empresas', to: '/sistema/empresas' },
    ],
  },
  { label: 'Gestão de Apólices', icon: 'policy', to: '/sistema/apolices', area: 'apolices' },
  { label: 'Integrações ERP', icon: 'offshore', to: '/sistema/integracoes-erp', area: 'cadastro' },
  { label: 'Contratos-Quadro', icon: 'contract', to: '/sistema/contratos', area: 'cadastro' },
  { label: 'Taxa KIXIMA', icon: 'wallet', to: '/sistema/taxas', area: 'financeiro' },
  { label: 'Planos e Subscrições', icon: 'building', to: '/sistema/planos', area: 'cadastro' },
  { label: 'Cobranças de subscrição', icon: 'invoice', to: '/sistema/cobrancas', area: 'financeiro' },
  { label: 'Economia de Escala', icon: 'tag', to: '/sistema/economia-de-escala', area: 'financeiro' },
  { label: 'Supplier Development', icon: 'suppliers', to: '/sistema/supplier-development', area: 'suporte' },
  { label: 'Chat de Suporte', icon: 'chat', to: '/suporte/chat', area: 'suporte', badge: 'suporte' },
  { label: 'Alertas de Segurança', icon: 'alert', to: '/sistema/alertas-seguranca', area: 'suporte', badge: 'alertas' },
  { label: 'Avaliações', icon: 'report', to: '/sistema/avaliacoes', area: 'suporte' },
  {
    // No Admin do Sistema, o suporte e a ajuda vivem dentro das configurações.
    // Grupo sem `area` própria — mistura itens pessoais (sempre visíveis) com
    // itens de área, marcados um a um.
    label: 'Configurações e Suporte', icon: 'settings', children: [
      { label: 'Perfil', to: '/perfil' },
      { label: 'Segurança', to: '/seguranca' },
      { label: 'Permissões', to: '/sistema/permissoes', area: SUPER_ADMIN_ONLY },
      { label: 'Administradores do Sistema', to: '/sistema/administradores', area: SUPER_ADMIN_ONLY },
      { label: 'Gestão de Atividades', to: '/sistema/atividades', area: 'operacoes' },
      { label: 'Auditoria', to: '/sistema/auditoria' },
      { label: 'Prontidão para produção', to: '/sistema/prontidao', area: 'operacoes' },
      { label: 'Solicitar Série', to: '/sistema/solicitar-serie', area: 'faturacao' },
      { label: 'Ajuda', to: '/ajuda' },
    ],
  },
  { label: 'Sair', icon: 'logout', action: 'logout' },
];

/**
 * Filtra o menu do Admin do Sistema pelas áreas de quem está a ver.
 *
 * `areas` VAZIO (Super Admin) devolve tudo sem tocar — é o comportamento de
 * sempre, para ninguém que já tinha o papel ver o menu encolher. Só um
 * assessor com áreas de facto atribuídas vê o menu reduzido à sua área.
 */
export function filtrarPorAreas(items, areas) {
  if (!areas || areas.length === 0) return items;
  const permitido = (area) => !area || areas.includes(area);
  return items
    .filter((item) => permitido(item.area))
    .map((item) => {
      if (!item.children) return item;
      const children = item.children.filter((c) => permitido(c.area));
      return children.length ? { ...item, children } : null;
    })
    .filter(Boolean);
}

export const SIDEBAR_MENUS = { COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, FINANCEIRO_FORNECEDOR, ADMIN_SISTEMA };
