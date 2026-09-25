// Forma REAL confirmada contra o backend Java em execução (não apenas lida
// no código): GET /api/auth/me e POST /api/auth/login devolvem objectos
// "user" com campos DIFERENTES entre si — companyName só existe na resposta
// do login/2FA, companyPlan/approvalCap só existem em /me. O tipo abaixo
// reflecte essa diferença real em vez de fingir um contrato único.
export type PersonaRole = 'COMPRADOR' | 'COMPANY_ADMIN' | 'FORNECEDOR' | 'FINANCEIRO' | 'ADMIN_SISTEMA';

// Campos presentes em AMBAS as respostas.
export interface KiximaUser {
  id: string;
  name: string;
  email: string;
  role: PersonaRole;
  adminAreas: string[];
  companyId: string | null;
  companyType: 'CLIENTE' | 'FORNECEDOR' | null;
  avatarUrl: string | null;
  mfaPendente?: boolean;
  mfaRestrita?: boolean;
  mfaPrazo?: string | null;
  // Só em POST /api/auth/login e POST /api/auth/2fa/verify.
  companyName?: string | null;
  // Só em GET /api/auth/me.
  companyPlan?: string | null;
  approvalCap?: string | null;
}

// Resposta de POST /api/auth/login quando a conta tem 2FA activa.
export interface Requires2faResponse {
  requires2fa: true;
  metodo: 'TOTP' | 'EMAIL';
  challenge: string;
}

// Resposta de POST /api/auth/login (sem 2FA) e de POST /api/auth/2fa/verify.
export interface SessionResponse {
  token: string;
  mfaPendente: boolean;
  mfaRestrita: boolean;
  mfaPrazo: string | null;
  user: KiximaUser;
}

export type LoginResponse = Requires2faResponse | SessionResponse;

export function isRequires2fa(res: LoginResponse): res is Requires2faResponse {
  return (res as Requires2faResponse).requires2fa === true;
}
