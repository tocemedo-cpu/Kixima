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
