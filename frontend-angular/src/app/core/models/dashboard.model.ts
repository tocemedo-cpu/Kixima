// GET /api/company-admin/dashboard (CompanyAdminController.java) — painel
// inicial do Company Admin.
import { PoStatus } from './purchase-order.model';

export interface CompanyAdminDashboardKpis {
  pedidos: number;
  emExecucao: number;
  volumeNegocios: number;
  aprovarPO: number;
}
export interface CompanyAdminDashboardVolumePoint {
  label: string;
  value: number;
}
export interface CompanyAdminDashboardActivity {
  reference: string;
  status: PoStatus;
  at: string;
  party: string;
}
export interface CompanyAdminDashboardResumo {
  usuariosAtivos: number;
  contratosAtivos: number;
  totalContratos: number;
  concluidas: number;
  compliance: number;
}
export interface CompanyAdminDashboardResponse {
  kpis: CompanyAdminDashboardKpis;
  resumo: CompanyAdminDashboardResumo;
  volume: CompanyAdminDashboardVolumePoint[];
  recent: CompanyAdminDashboardActivity[];
}

// GET /api/dashboard/comprador (PaineisController.java) — painel inicial do
// Comprador. Requer papel COMPRADOR (não COMPANY_ADMIN).
export interface CompradorDashboardKpis {
  emAndamento: number;
  aguardandoPagamento: { count: number; total: number };
  emEntrega: { count: number; total: number };
  recebidasMes: number;
}
export interface CompradorDashboardOrdemResumo {
  label: string;
  count: number;
}
export interface CompradorDashboardResponse {
  kpis: CompradorDashboardKpis;
  minhasOrdens: CompradorDashboardOrdemResumo[];
}
