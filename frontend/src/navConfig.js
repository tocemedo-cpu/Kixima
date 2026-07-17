// src/navConfig.js
// Itens de navegação da sidebar por persona, espelhando as tabelas de
// "Telas mínimas do MVP" da especificação (uma entrada por tela essencial).

export const NAV_CONFIG = {
  COMPRADOR: [
    { to: '/comprador', label: 'Início', end: true },
    { to: '/comprador/catalogo', label: 'Catálogo' },
    { to: '/comprador/cesta', label: 'Cesta' },
    { to: '/comprador/ordens', label: 'Ordens de Compra' },
  ],
  COMPANY_ADMIN: [
    { to: '/empresa', label: 'Início', end: true },
    { to: '/empresa/aprovacoes', label: 'Aprovações de PO' },
    { to: '/empresa/utilizadores', label: 'Utilizadores & Perfis' },
    { to: '/empresa/perfil', label: 'Perfil da Empresa' },
    { to: '/empresa/contratos', label: 'Contratos' },
  ],
  FORNECEDOR: [
    { to: '/fornecedor', label: 'Central de Negócios', end: true },
    { to: '/fornecedor/catalogo', label: 'Catálogo' },
    { to: '/fornecedor/ordens', label: 'Ordens Recebidas' },
    { to: '/fornecedor/faturas', label: 'Faturas' },
    { to: '/fornecedor/pagamentos', label: 'Pagamentos Recebidos' },
    { to: '/fornecedor/perfil', label: 'Perfil da Empresa' },
  ],
  FINANCEIRO: [
    { to: '/financeiro', label: 'Início', end: true },
    { to: '/financeiro/faturas', label: 'Faturas Pendentes' },
    { to: '/financeiro/historico', label: 'Histórico de Pagamentos' },
    { to: '/financeiro/perfil', label: 'Perfil da Empresa' },
  ],
  ADMIN_SISTEMA: [
    { to: '/sistema', label: 'Início', end: true },
    { to: '/sistema/due-diligence', label: 'Cadastro de Empresas' },
    { to: '/sistema/apolices', label: 'Gestão de Apólices' },
    { to: '/sistema/empresas', label: 'Empresas' },
  ],
};
