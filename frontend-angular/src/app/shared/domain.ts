// Porta de frontend/src/domain.js — só a parte usada pelo que já foi migrado
// para Angular (autenticação + cotações + catálogo). O resto do ficheiro
// (PO_STATUS, INVOICE_STATUS, notificações→rota, etc.) fica para migrar junto
// com os respectivos ecrãs — ver docs/migracao-angular/PLANO.md.
import type { PersonaRole } from '../core/models/user.model';

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
