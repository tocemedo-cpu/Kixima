// Espelha os endpoints de segurança da conta autenticada (PATCH /api/auth/
// password, GET/POST /api/auth/2fa/*, GET /api/users/me/dados-pessoais,
// POST /api/users/me/anonimizar) — confirmados por um agente de pesquisa
// dedicado. Distintos dos endpoints de 2FA usados no MOMENTO DE LOGIN
// (/api/auth/2fa/verify, /api/auth/2fa/reenviar, já modelados noutro sítio)
// — estes são para GERIR o 2FA a partir de uma sessão já autenticada.
export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

// {ok:true} — o único campo devolvido, confirmado contra AuthService.java.
export interface ChangePasswordAck {
  ok: true;
}

export type MetodoTotp = 'EMAIL' | 'TOTP';

export interface TotpStatus {
  enabled: boolean;
  enabledAt: string | null;
  metodo: MetodoTotp | null;
  // Mensagem explicativa (não um booleano) — presente quando o 2FA por
  // email não pode ser usado neste ambiente (ex.: EMAIL_PROVIDER=console).
  emailIndisponivel: string | null;
  // Email mascarado (ex.: "b***o@gmail.com"), presente sempre que o
  // utilizador tem email, independentemente de `enabled`.
  email: string | null;
}

// POST /api/auth/2fa/email/{enviar,reenviar} — mesma forma nos dois.
// `reaproveitado` só aparece (true) no fluxo automático de login, nunca
// nestes dois pedidos explícitos, mas fica modelado por completude.
export interface MfaEmailEnvio {
  enviadoPara: string;
  expiraEm: string;
  validadeMinutos: number;
  reaproveitado?: boolean;
}

export interface TotpSetup {
  secret: string;
  otpauthUrl: string;
}

export interface TotpCodeBody {
  code: string;
}

export interface TotpEnableResult {
  enabled: true;
  enabledAt: string;
  metodo: MetodoTotp;
}

export interface TotpDisableResult {
  enabled: false;
}

// GET /api/users/me/dados-pessoais — descarregado como ficheiro pelo
// cliente, nunca lido campo a campo; tipado aqui só o suficiente para
// descrever ao utilizador o que está a descarregar (5 categorias reais:
// conta, ordens criadas, ordens aprovadas, pagamentos autorizados, registo
// de ações/auditoria, e notificações recebidas — confirmado contra
// DadosPessoaisService.java, mais rico do que "perfil e ordens").
export interface DadosPessoaisDocumento {
  geradoEm: string;
  aviso: string;
  conta: Record<string, unknown>;
  atividade: {
    ordensCriadas: unknown[];
    ordensAprovadas: unknown[];
    pagamentosAutorizados: unknown[];
    registoDeAcoes: unknown[];
    notificacoesRecebidas: unknown[];
  };
  totais: Record<string, number>;
}

export interface AnonimizarBody {
  password: string;
  motivo?: string;
}

// Sempre com todos os campos presentes (@JsonInclude(ALWAYS)).
export interface ResultadoAnonimizacao {
  utilizador: { id: string; name: string; email: string; active: boolean };
  registosDeAuditoriaPreservados: number;
  notificacoesEliminadas: number;
  motivo: string | null;
  anonimizadoEm: string;
  nota: string;
}
