// src/navConfig.js
// Itens de navegação da sidebar por persona, espelhando as tabelas de
// "Telas mínimas do MVP" da especificação (uma entrada por tela essencial).
// `icon` refere um ícone de src/components/icons.jsx.

export const NAV_CONFIG = {
  COMPRADOR: [
    { to: '/comprador', label: 'Início', end: true, icon: 'home' },
    { to: '/comprador/catalogo', label: 'Catálogo', icon: 'catalog' },
    { to: '/comprador/cesta', label: 'Cesta', icon: 'cart', badge: 'cart' },
    { to: '/comprador/ordens', label: 'Ordens de Compra', icon: 'orders' },
  ],
  COMPANY_ADMIN: [
    { to: '/empresa', label: 'Início', end: true, icon: 'home' },
    { to: '/empresa/aprovacoes', label: 'Aprovações de PO', icon: 'approvals' },
    { to: '/empresa/utilizadores', label: 'Utilizadores & Perfis', icon: 'users' },
    { to: '/empresa/perfil', label: 'Perfil da Empresa', icon: 'building' },
    { to: '/empresa/contratos', label: 'Contratos', icon: 'contract' },
  ],
  FORNECEDOR: [
    { to: '/fornecedor', label: 'Central de Negócios', end: true, icon: 'home' },
    { to: '/fornecedor/catalogo', label: 'Catálogo', icon: 'catalog' },
    { to: '/fornecedor/ordens', label: 'Ordens Recebidas', icon: 'orders' },
    { to: '/fornecedor/faturas', label: 'Faturas', icon: 'invoice' },
    { to: '/fornecedor/pagamentos', label: 'Pagamentos Recebidos', icon: 'payment' },
    { to: '/fornecedor/perfil', label: 'Perfil da Empresa', icon: 'building' },
  ],
  FINANCEIRO: [
    { to: '/financeiro', label: 'Início', end: true, icon: 'home' },
    { to: '/financeiro/faturas', label: 'Faturas Pendentes', icon: 'invoice' },
    { to: '/financeiro/historico', label: 'Histórico de Pagamentos', icon: 'history' },
    { to: '/financeiro/perfil', label: 'Perfil da Empresa', icon: 'building' },
  ],
  ADMIN_SISTEMA: [
    { to: '/sistema', label: 'Início', end: true, icon: 'home' },
    { to: '/sistema/due-diligence', label: 'Cadastro de Empresas', icon: 'dueDiligence' },
    { to: '/sistema/apolices', label: 'Gestão de Apólices', icon: 'policy' },
    { to: '/sistema/contratos', label: 'Contratos-Quadro', icon: 'contract' },
    { to: '/sistema/empresas', label: 'Empresas', icon: 'suppliers' },
  ],
};
