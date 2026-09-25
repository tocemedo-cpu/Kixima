// Porta de frontend/src/domain.js — a parte usada pelo que já foi migrado
// para Angular (autenticação, cotações, catálogo, carrinho/checkout, ordens
// de compra). O resto do ficheiro (notificações→rota, etc.) fica para migrar
// junto com os respectivos ecrãs — ver docs/migracao-angular/PLANO.md.
import type { PersonaRole } from '../core/models/user.model';
import type { PoStatus } from '../core/models/purchase-order.model';

// IVA (lei angolana): 14% sobre tudo. Espelha domain.js:IVA_RATE — usado só
// para o RESUMO no ecrã (Cesta/Checkout); o cálculo autoritativo é sempre o
// do backend (taxService), tal como o comentário original explica.
export const IVA_RATE = 0.14;

// Ver a nota completa em frontend/src/domain.js sobre porquê "Dashboard" fica
// como está e porquê COMPANY_ADMIN deixou de estar em inglês.
export const ROLE_LABELS: Record<PersonaRole, string> = {
  COMPRADOR: 'Comprador',
  COMPANY_ADMIN: 'Administrador da Empresa',
  FORNECEDOR: 'Fornecedor',
  FINANCEIRO: 'Financeiro',
  ADMIN_SISTEMA: 'Admin do Sistema KIXIMA',
};

// Espelha backend/src/utils/adminAreas.js.
export const ADMIN_AREAS = ['cadastro', 'financeiro', 'faturacao', 'apolices', 'suporte', 'operacoes'] as const;

export const ADMIN_AREA_LABELS: Record<string, string> = {
  cadastro: 'Cadastro & Empresas',
  financeiro: 'Financeiro',
  faturacao: 'Faturação (AGT)',
  apolices: 'Apólices',
  suporte: 'Suporte',
  operacoes: 'Operação da Plataforma',
};

export const ROLE_HOME: Record<PersonaRole, string> = {
  COMPRADOR: '/comprador',
  COMPANY_ADMIN: '/empresa',
  FORNECEDOR: '/fornecedor',
  FINANCEIRO: '/financeiro',
  ADMIN_SISTEMA: '/sistema',
};

// Idênticas a formatMoney/formatDate/formatDateTime em frontend/src/domain.js,
// usando o locale do browser directamente (o sistema de i18n de PT/EN/FR do
// React ainda não foi portado — ver a secção "Pendente" do plano de migração;
// a aplicação continua a funcionar correctamente em português, que é a língua
// nativa dos textos e das mensagens de erro do servidor).
export function formatMoney(amount: string | number | null | undefined, currency = 'AOA'): string {
  const value = Number(amount ?? 0);
  const symbol = currency === 'AOA' ? 'Kz' : currency;
  return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + ' ' + symbol;
}

export function formatNumber(value: string | number | null | undefined): string {
  return new Intl.NumberFormat('pt-PT').format(Number(value ?? 0));
}

// Espelha formatUsd em frontend/src/domain.js — usado só pela Assinatura
// (preços de planos são sempre em USD, ao contrário do resto da plataforma).
// Sem casas decimais por omissão (os preços dos planos são valores redondos);
// quem precisa dos cêntimos (o equivalente mensal) pede-os via `decimais`.
export function formatUsd(amount: string | number | null | undefined, decimais = 0): string {
  return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: decimais, maximumFractionDigits: decimais }).format(Number(amount ?? 0)) + ' USD';
}

// Junta partes não-vazias (ex.: cidade/país) com um separador — extraído
// porque os templates do Angular não suportam arrow functions em bindings
// (`.filter(v => v)` falha em NG5002), ao contrário do JSX original.
export function joinNonEmpty(parts: Array<string | null | undefined>, sep = ', '): string {
  return parts.filter((v): v is string => Boolean(v)).join(sep);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

// Espelha PO_STATUS em frontend/src/domain.js:48-61.
export const PO_STATUS: Record<PoStatus, { label: string; tone: string }> = {
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

// Espelha INVOICE_STATUS em frontend/src/domain.js:63-68.
export const INVOICE_STATUS: Record<string, { label: string; tone: string }> = {
  PENDENTE: { label: 'Pendente', tone: 'pending' },
  PAGA: { label: 'Paga', tone: 'success' },
  VENCIDA: { label: 'Vencida', tone: 'danger' },
  CANCELADA: { label: 'Cancelada', tone: 'neutral' },
};

// Espelha CONTRACT_STATUS/BILLING_PERIODICITY em frontend/src/domain.js:77-86.
export const CONTRACT_STATUS: Record<string, { label: string; tone: string }> = {
  ATIVO: { label: 'Ativo', tone: 'success' },
  EXPIRADO: { label: 'Expirado', tone: 'danger' },
  ENCERRADO: { label: 'Encerrado', tone: 'neutral' },
};

export const BILLING_PERIODICITY: Record<string, string> = {
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
};

// Espelha COMPANY_STATUS/POLICY_STATUS em frontend/src/domain.js:70-93.
export const COMPANY_STATUS: Record<string, { label: string; tone: string }> = {
  PENDENTE: { label: 'Pendente de due diligence', tone: 'pending' },
  APROVADA: { label: 'Aprovada', tone: 'success' },
  REJEITADA: { label: 'Rejeitada', tone: 'danger' },
  SUSPENSA: { label: 'Suspensa', tone: 'danger' },
};

// Espelha resolverDestinoNotificacao em frontend/src/domain.js:190-246. Sem
// destino conhecido e seguro para o papel de quem clicou, devolve null —
// quem chama só marca como lida, sem navegar (mais vale não fazer nada do
// que mandar alguém para uma página que o roleGuard lhe vai recusar).
export function resolverDestinoNotificacao(
  n: { relatedEntityType?: string | null; relatedEntityId?: string | null; type: string } | null | undefined,
  user: { role: PersonaRole } | null | undefined,
): string | null {
  if (!n || !user) return null;
  const tipo = n.relatedEntityType;
  const id = n.relatedEntityId;
  const role = user.role;

  if (tipo === 'PurchaseOrder' && id) {
    const porPapel: Partial<Record<PersonaRole, string>> = {
      COMPRADOR: `/comprador/ordens/${id}`,
      COMPANY_ADMIN: `/empresa/aprovacoes/${id}`,
      FORNECEDOR: `/fornecedor/ordens/${id}`,
      FINANCEIRO: `/financeiro/ordens/${id}`,
    };
    return porPapel[role] || null;
  }
  if (tipo === 'Invoice') {
    return role === 'FINANCEIRO' ? '/financeiro/faturas' : null;
  }
  if (tipo === 'Payment') {
    if (role === 'FORNECEDOR') return '/fornecedor/pagamentos';
    if (role === 'COMPANY_ADMIN') return '/empresa';
    return null;
  }
  if (tipo === 'PlanoCobranca') {
    return role === 'COMPANY_ADMIN' || role === 'FINANCEIRO' ? '/empresa/assinatura' : null;
  }
  if (tipo === 'SupportTicket') {
    return id ? `/suporte/chat?ticket=${id}` : '/suporte/chat';
  }
  if (tipo === 'Conversation') {
    return id ? `/mensagens/chat-comercial?c=${id}` : '/mensagens/chat-comercial';
  }
  if (tipo === 'SupplierDevRequest') {
    return role === 'ADMIN_SISTEMA' ? '/sistema/supplier-development' : null;
  }

  switch (n.type) {
    case 'APOLICE_SUBMETIDA_APROVADA':
    case 'APOLICE_A_EXPIRAR':
      return role === 'COMPANY_ADMIN' || role === 'FINANCEIRO' ? '/empresa/documentos' : null;
    case 'CADASTRO_EMPRESA_APROVADO':
    case 'CADASTRO_EMPRESA_REJEITADO':
      return role === 'COMPANY_ADMIN' ? '/empresa/perfil' : null;
    case 'ALERTA_SEGURANCA':
      return role === 'ADMIN_SISTEMA' ? '/sistema/alertas-seguranca' : null;
    default:
      return null;
  }
}

export const POLICY_STATUS: Record<string, { label: string; tone: string }> = {
  SUBMETIDA: { label: 'Submetida', tone: 'pending' },
  APROVADA: { label: 'Aprovada', tone: 'success' },
  REJEITADA: { label: 'Rejeitada', tone: 'danger' },
  EXPIRADA: { label: 'Expirada', tone: 'danger' },
};
