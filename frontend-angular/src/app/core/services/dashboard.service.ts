// Porta dos painéis iniciais de Company Admin e Comprador —
// GET /api/company-admin/dashboard (CompanyAdminController.java) e
// GET /api/dashboard/comprador (PaineisController.java).
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CompanyAdminDashboardResponse, CompradorDashboardResponse } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private readonly api: ApiService) {}

  companyAdmin(): Observable<CompanyAdminDashboardResponse> {
    return this.api.get<CompanyAdminDashboardResponse>('/api/company-admin/dashboard');
  }

  comprador(): Observable<CompradorDashboardResponse> {
    return this.api.get<CompradorDashboardResponse>('/api/dashboard/comprador');
  }
}
