// Espelha InviteDto (Java) — lista de convites do Company Admin
// (nunca inclui o token). CompanyUserDto já vive em invite.model.ts.
export interface InviteDto {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'PENDENTE' | 'ACEITO' | 'EXPIRADO' | 'CANCELADO';
  expiresAt?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
}

export interface CreateInviteBody {
  role: string;
  name: string;
  email: string;
}
