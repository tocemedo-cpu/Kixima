// Porta de /api/addons — mesmo mecanismo de cobrança dos planos (transferência
// com comprovativo, confirmada pelo Admin Sistema), para funcionalidades
// pagas à parte (ex.: Automatic PO Robot). Contratos confirmados contra
// AddonController.java/AddonCobrancaService.java por um agente de pesquisa
// dedicado — não assumidos do React.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  AddonCatalogoItem,
  AddonCobrancaDto,
  AddonsFila,
  CancelarCobrancaBody,
  ConfirmarCobrancaBody,
} from '../../core/models/assinatura.model';

@Injectable({ providedIn: 'root' })
export class AddonsService {
  constructor(private readonly api: ApiService) {}

  // Sem restrição de papel no Java — qualquer sessão autenticada.
  catalogo(): Observable<AddonCatalogoItem[]> {
    return this.api.get<AddonCatalogoItem[]>('/api/addons/catalogo');
  }

  // ADMIN_SISTEMA + AdminArea.FINANCEIRO.
  fila(): Observable<AddonsFila> {
    return this.api.get<AddonsFila>('/api/addons/fila');
  }

  confirmar(cobrancaId: string, body: ConfirmarCobrancaBody = {}): Observable<AddonCobrancaDto> {
    return this.api.post<AddonCobrancaDto>(`/api/addons/${cobrancaId}/confirmar`, body);
  }

  // COMPANY_ADMIN (só a própria empresa) ou ADMIN_SISTEMA + AdminArea.FINANCEIRO.
  cancelar(cobrancaId: string, body: CancelarCobrancaBody): Observable<AddonCobrancaDto> {
    return this.api.post<AddonCobrancaDto>(`/api/addons/${cobrancaId}/cancelar`, body);
  }
}
