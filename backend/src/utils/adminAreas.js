// src/utils/adminAreas.js
// As áreas em que o poder de ADMIN_SISTEMA se pode dividir.
//
// Até aqui, ADMIN_SISTEMA era um papel só: quem o tinha, tinha tudo —
// cadastro de empresas, dinheiro, faturação certificada AGT, apólices,
// suporte, operação da plataforma. Dar acesso ao sistema a alguém era dar-lhe
// literalmente tudo, sem meio-termo.
//
// Cada chave aqui corresponde a um pedaço fechado de rotas administrativas —
// ver onde CADA_AREA é usada em requirePermission() pelos ficheiros de rotas.
// FATURACAO fica separada de FINANCEIRO de propósito: tem implicações fiscais
// diretas (certificação AGT, SAF-T), e nem toda gente do financeiro devia
// mexer nisso sem mais ninguém saber.
const CADASTRO = 'cadastro';
const FINANCEIRO = 'financeiro';
const FATURACAO = 'faturacao';
const APOLICES = 'apolices';
const SUPORTE = 'suporte';
const OPERACOES = 'operacoes';

const AREAS_ADMIN = [CADASTRO, FINANCEIRO, FATURACAO, APOLICES, SUPORTE, OPERACOES];

const AREAS_ADMIN_LABEL = {
  [CADASTRO]: 'Cadastro & Empresas',
  [FINANCEIRO]: 'Financeiro',
  [FATURACAO]: 'Faturação (AGT)',
  [APOLICES]: 'Apólices',
  [SUPORTE]: 'Suporte',
  [OPERACOES]: 'Operação da Plataforma',
};

module.exports = {
  CADASTRO, FINANCEIRO, FATURACAO, APOLICES, SUPORTE, OPERACOES,
  AREAS_ADMIN, AREAS_ADMIN_LABEL,
};
