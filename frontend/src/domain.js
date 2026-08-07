// src/domain.js
// Constantes de domínio partilhadas — mantém os rótulos em português e os
// mapeamentos de estado num único sítio.

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

// Taxas apresentadas no resumo da cesta (nível de apresentação/estimativa).
export const KIXIMA_FEE_RATE = 0.065; // Comissão KIXIMA (o que fica com a plataforma)
export const IVA_RATE = 0.14; // IVA Angola (14% sobre tudo)

export function computeCartTotals(subtotal) {
  const fee = subtotal * KIXIMA_FEE_RATE;
  const iva = subtotal * IVA_RATE;
  return { subtotal, fee, iva, total: subtotal + fee + iva };
}

export function formatMoney(amount, currency = 'AOA') {
  const value = Number(amount ?? 0);
  // O Kwanza angolano mostra-se como "Kz" (a moeda local da plataforma).
  const symbol = currency === 'AOA' ? 'Kz' : currency;
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) +
    ' ' + symbol;
}

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-AO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}
