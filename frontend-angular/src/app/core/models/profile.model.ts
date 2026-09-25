// Espelha GET /api/users/profile (UserController.java/ProfileService.java) —
// confirmado por um agente de pesquisa dedicado. Duas particularidades reais:
// `cards[].money` só aparece (true) na ÚNICA carta de dinheiro de cada perfil
// (@JsonInclude(NON_NULL) — nunca `false`, ausente nas outras); e
// `cards[].value` é sempre um NÚMERO cru (mesmo nas cartas de dinheiro) — a
// formatação com formatMoney() é sempre feita no cliente, nunca no servidor.
export type ProfileKind = 'admin' | 'supplier' | 'buyer';

// Sub-conjunto de campos de identificação da empresa devolvido aqui — mais
// rico do que o CompanyRef usado em purchase-order.model.ts (taxId/type/
// status/contactEmail/contactPhone/address/province incluídos), por isso um
// tipo próprio em vez de reutilizar aquele.
export interface ProfileCompanyRef {
  id: string;
  name: string;
  taxId: string;
  type: 'CLIENTE' | 'FORNECEDOR';
  status: string;
  contactEmail: string;
  contactPhone?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  logoUrl?: string | null;
  verified: boolean;
}

export interface ProfileCard {
  icon: string;
  tone: string;
  label: string;
  value: number;
  money?: boolean;
  sub: string;
}

export interface ProfileRecent {
  reference: string;
  party: string | null;
  status: string;
  at: string;
}

export interface ProfileResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
    createdAt: string;
  };
  // null só para ADMIN_SISTEMA (sem empresa).
  company: ProfileCompanyRef | null;
  kind: ProfileKind;
  cards: ProfileCard[];
  recent: ProfileRecent[];
}

// POST/DELETE /api/users/me/avatar devolvem sempre o UserPublicDto completo
// (UserController.java), nunca só {avatarUrl}.
export interface UserPublicDto {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  companyId: string | null;
  createdAt: string;
}
