// Espelha ResolvedInviteDto/CompanyUserDto/ResolvedAdminInviteDto (Java) —
// convites de equipa (companyRoutes.js) e de Admin do Sistema (adminRoutes.js).
export interface ResolvedInviteDto {
  companyName: string;
  companyType: string;
  role: string;
  name?: string | null;
  email?: string | null;
}

export interface AcceptInviteBody {
  name: string;
  email: string;
  password: string;
  termsAccepted: true;
}

export interface CompanyUserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export interface ResolvedAdminInviteDto {
  name: string;
  email: string;
  adminAreas: string[];
}

export interface AcceptAdminInviteBody {
  password: string;
  termsAccepted: true;
}
