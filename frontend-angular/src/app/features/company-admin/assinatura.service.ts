// Porta das chamadas a /api/assinatura — ver AssinaturaController.java/
// AssinaturaService.java, confirmados endpoint a endpoint por um agente de
// pesquisa dedicado antes de escrever este ficheiro.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  AssinaturaEstado,
  CanaisPagamento,
  CancelarCobrancaBody,
  PagarComBody,
  PedirPlanoBody,
  PlanoCobrancaDto,
} from '../../core/models/assinatura.model';

@Injectable({ providedIn: 'root' })
export class AssinaturaService {
  constructor(private readonly api: ApiService) {}

  estado(): Observable<AssinaturaEstado> {
    return this.api.get<AssinaturaEstado>('/api/assinatura');
  }

  canais(): Observable<CanaisPagamento> {
    return this.api.get<CanaisPagamento>('/api/assinatura/canais');
  }

  // 201 no Java, devolve o PlanoCobrancaDto completo (não só {referencia}).
  pedir(body: PedirPlanoBody): Observable<PlanoCobrancaDto> {
    return this.api.post<PlanoCobrancaDto>('/api/assinatura/pedir', body);
  }

  pagarCom(cobrancaId: string, body: PagarComBody): Observable<PlanoCobrancaDto> {
    return this.api.post<PlanoCobrancaDto>(`/api/assinatura/${cobrancaId}/pagar-com`, body);
  }

  comprovativo(cobrancaId: string, file: File): Observable<PlanoCobrancaDto> {
    return this.api.upload<PlanoCobrancaDto>(`/api/assinatura/${cobrancaId}/comprovativo`, file, 'comprovativo');
  }

  cancelar(cobrancaId: string, body: CancelarCobrancaBody): Observable<PlanoCobrancaDto> {
    return this.api.post<PlanoCobrancaDto>(`/api/assinatura/${cobrancaId}/cancelar`, body);
  }
}
