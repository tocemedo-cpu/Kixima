// Porta de GET /api/planos — usado por CatalogManage.jsx (limites de mídia,
// posição na pesquisa) e, no futuro, por Plans.jsx. Endpoint público, sem
// autenticação (PublicoCobrancaController.java:44-56 / PublicPaths.java:78).
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PlanosResponse } from '../models/plan.model';

@Injectable({ providedIn: 'root' })
export class PlansService {
  constructor(private readonly api: ApiService) {}

  planos(): Observable<PlanosResponse> {
    return this.api.get<PlanosResponse>('/api/planos');
  }
}
