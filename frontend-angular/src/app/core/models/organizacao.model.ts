// Espelha CompanyAdminPanelService.organizacao() (Java) — perfil da
// empresa + resumo (usado por Organization.jsx).
import { CompanyDetail } from './company.model';

export interface OrganizacaoSummary {
  users: number;
  contracts: number;
  documents: number;
  certifications: number;
}

export interface OrganizacaoResponse {
  company: CompanyDetail;
  summary: OrganizacaoSummary;
}
