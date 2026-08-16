// src/domain.js
// Constantes de domínio partilhadas — mantém os rótulos em português e os
// mapeamentos de estado num único sítio. Os rótulos são CHAVES i18n: quem os
// mostra passa-os por t() (os componentes partilhados fazem-no sozinhos).
import { activeLocale } from './i18n';

// O rótulo de cada perfil, em português — que é a língua-chave do dicionário.
//
// `COMPANY_ADMIN` era o ÚNICO dos cinco em inglês: um utilizador português via
// "Comprador", "Fornecedor", "Financeiro", "Admin do Sistema KIXIMA"... e
// "Company Admin". Não era falta de tradução (a chave tinha EN e FR); era a
// própria chave portuguesa escrita em inglês.
//
// "Dashboard" fica como está de propósito: é usado de forma consistente em toda
// a aplicação e é um estrangeirismo assente no software de gestão. Trocá-lo por
// "Painel" seria decisão de produto, não correção de defeito.
export const ROLE_LABELS = {
  COMPRADOR: 'Comprador',
  COMPANY_ADMIN: 'Administrador da Empresa',
  FORNECEDOR: 'Fornecedor',
  FINANCEIRO: 'Financeiro',
  ADMIN_SISTEMA: 'Admin do Sistema KIXIMA',
};

// As áreas em que o Admin do Sistema se pode dividir — espelha
// backend/src/utils/adminAreas.js. adminAreas VAZIO (a omissão de quem já
// tinha o papel) significa Super Admin: acede a tudo, sem nada aqui marcado.
export const ADMIN_AREAS = ['cadastro', 'financeiro', 'faturacao', 'apolices', 'suporte', 'operacoes'];

export const ADMIN_AREA_LABELS = {
  cadastro: 'Cadastro & Empresas',
  financeiro: 'Financeiro',
  faturacao: 'Faturação (AGT)',
  apolices: 'Apólices',
  suporte: 'Suporte',
  operacoes: 'Operação da Plataforma',
};

export const ROLE_HOME = {
  COMPRADOR: '/comprador',
  COMPANY_ADMIN: '/empresa',
  FORNECEDOR: '/fornecedor',
  FINANCEIRO: '/financeiro',
  ADMIN_SISTEMA: '/sistema',
};

// Estado da PO -> { rótulo, tom do badge }
export const PO_STATUS = {
  AGUARDANDO_APROVACAO: { label: 'Aguardando aprovação', tone: 'pending' },
  APROVADA: { label: 'Aprovada', tone: 'info' },
  REJEITADA: { label: 'Rejeitada', tone: 'danger' },
  ACEITE_FORNECEDOR: { label: 'Aceite pelo fornecedor', tone: 'info' },
  RECUSADA_FORNECEDOR: { label: 'Recusada pelo fornecedor', tone: 'danger' },
  AGUARDANDO_PAGAMENTO: { label: 'Aguardando pagamento', tone: 'pending' },
  PAGA: { label: 'Paga', tone: 'success' },
  EM_EXECUCAO: { label: 'Em execução', tone: 'info' },
  ENTREGUE: { label: 'Entregue', tone: 'info' },
  RECEBIDA_CONFORME: { label: 'Recebida — conforme', tone: 'success' },
  RECEBIDA_COM_DIVERGENCIA: { label: 'Recebida — com divergência', tone: 'danger' },
  CONCLUIDA: { label: 'Concluída', tone: 'success' },
};

export const INVOICE_STATUS = {
  PENDENTE: { label: 'Pendente', tone: 'pending' },
  PAGA: { label: 'Paga', tone: 'success' },
  VENCIDA: { label: 'Vencida', tone: 'danger' },
  CANCELADA: { label: 'Cancelada', tone: 'neutral' },
};

export const COMPANY_STATUS = {
  PENDENTE: { label: 'Pendente de due diligence', tone: 'pending' },
  APROVADA: { label: 'Aprovada', tone: 'success' },
  REJEITADA: { label: 'Rejeitada', tone: 'danger' },
  SUSPENSA: { label: 'Suspensa', tone: 'danger' },
};

export const CONTRACT_STATUS = {
  ATIVO: { label: 'Ativo', tone: 'success' },
  EXPIRADO: { label: 'Expirado', tone: 'danger' },
  ENCERRADO: { label: 'Encerrado', tone: 'neutral' },
};

export const BILLING_PERIODICITY = {
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
};

export const POLICY_STATUS = {
  SUBMETIDA: { label: 'Submetida', tone: 'pending' },
  APROVADA: { label: 'Aprovada', tone: 'success' },
  REJEITADA: { label: 'Rejeitada', tone: 'danger' },
  EXPIRADA: { label: 'Expirada', tone: 'danger' },
};

// Taxas apresentadas ao COMPRADOR no resumo da cesta.
//
// A Taxa KIXIMA não está aqui de propósito: é cobrada ao FORNECEDOR, à parte da
// ordem de compra e da fatura, e é calculada no servidor (8 USD por PO + 15 USD
// por fatura; acima de 11.500 USD, 0,20% do valor, a cobrir as duas parcelas).
// O comprador não a paga — logo não a vê, nem entra no total da cesta.
export const IVA_RATE = 0.14; // IVA Angola (14% sobre tudo)
// Retenção na Fonte de Imposto Industrial (Lei 26/20): 6,5% sobre SERVIÇOS.
// Não soma à fatura — é descontada ao fornecedor (o comprador entrega à AGT).
export const WITHHOLDING_RATE = 0.065;

export function computeCartTotals(subtotal) {
  const iva = subtotal * IVA_RATE;
  return { subtotal, iva, total: subtotal + iva };
}

/**
 * Valor em dólares — o preço dos planos e das cobranças de subscrição.
 *
 * Existe porque a mesma quantia estava a ser escrita de quatro maneiras: cada
 * ecrã que mostrava dólares tinha o seu próprio `toLocaleString`, e três deles
 * discordavam nas casas decimais. O mesmo plano custava "5 000 USD" na página
 * pública e "5 000,00 USD" no ecrã do Admin do Sistema — o que num contexto de
 * preços não é um detalhe estético: é a pessoa a perguntar-se se são valores
 * diferentes.
 *
 * Todos eles fixavam também 'pt-AO' à mão, por isso com a interface em inglês
 * os números continuavam com agrupamento angolano. Aqui segue o idioma ativo,
 * como o formatMoney já fazia.
 *
 * SEM CASAS DECIMAIS por omissão: os preços dos planos são valores redondos
 * (100, 5000) e ".00" só acrescenta ruído. Quem precisa dos cêntimos — o
 * equivalente mensal, 416,67 — pede-os.
 */
export function formatUsd(amount, { decimais = 0 } = {}) {
  return new Intl.NumberFormat(activeLocale(), {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  }).format(Number(amount ?? 0)) + ' USD';
}

/**
 * Número simples (contagens, quantidades), no locale ativo.
 *
 * Existia por todo o lado como `n.toLocaleString('pt-PT')` — com o locale
 * ESCRITO À MÃO. O efeito só se via mudando de idioma: um utilizador em inglês
 * ou francês recebia a contagem com separadores portugueses, enquanto os
 * valores em dinheiro ao lado, esses, seguiam o idioma escolhido. Dois números
 * na mesma frase formatados por regras diferentes.
 */
export function formatNumber(value) {
  return new Intl.NumberFormat(activeLocale()).format(Number(value ?? 0));
}

export function formatMoney(amount, currency = 'AOA') {
  const value = Number(amount ?? 0);
  // O Kwanza angolano mostra-se como "Kz" (a moeda local da plataforma).
  const symbol = currency === 'AOA' ? 'Kz' : currency;
  return new Intl.NumberFormat(activeLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) +
    ' ' + symbol;
}

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(activeLocale(), { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(activeLocale(), {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}
