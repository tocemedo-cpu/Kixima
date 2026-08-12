// src/domain.js
// Constantes de domínio partilhadas — mantém os rótulos em português e os
// mapeamentos de estado num único sítio. Os rótulos são CHAVES i18n: quem os
// mostra passa-os por t() (os componentes partilhados fazem-no sozinhos).
import { activeLocale } from './i18n';

export const ROLE_LABELS = {
  COMPRADOR: 'Comprador',
  COMPANY_ADMIN: 'Company Admin',
  FORNECEDOR: 'Fornecedor',
  FINANCEIRO: 'Financeiro',
  ADMIN_SISTEMA: 'Admin do Sistema KIXIMA',
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
