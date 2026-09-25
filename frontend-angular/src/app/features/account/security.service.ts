// Porta de PATCH /api/auth/password, GET/POST /api/auth/2fa/* (gestão a
// partir de uma sessão já autenticada — distintos do desafio de 2FA no
// momento de login) e GET /api/users/me/dados-pessoais + POST
// /api/users/me/anonimizar. Contratos confirmados por um agente de pesquisa
// dedicado antes de codificar.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  AnonimizarBody,
  ChangePasswordAck,
  ChangePasswordBody,
  DadosPessoaisDocumento,
  MfaEmailEnvio,
  ResultadoAnonimizacao,
  TotpCodeBody,
  TotpDisableResult,
  TotpEnableResult,
  TotpSetup,
  TotpStatus,
} from '../../core/models/security.model';

@Injectable({ providedIn: 'root' })
export class SecurityService {
  constructor(private readonly api: ApiService) {}

  changePassword(body: ChangePasswordBody): Observable<ChangePasswordAck> {
    return this.api.patch<ChangePasswordAck>('/api/auth/password', body);
  }

  totpStatus(): Observable<TotpStatus> {
    return this.api.get<TotpStatus>('/api/auth/2fa/status');
  }

  enviarCodigoEmail(): Observable<MfaEmailEnvio> {
    return this.api.post<MfaEmailEnvio>('/api/auth/2fa/email/enviar');
  }

  reenviarCodigoEmail(): Observable<MfaEmailEnvio> {
    return this.api.post<MfaEmailEnvio>('/api/auth/2fa/email/reenviar');
  }

  setupTotp(): Observable<TotpSetup> {
    return this.api.post<TotpSetup>('/api/auth/2fa/setup');
  }

  enableTotp(body: TotpCodeBody): Observable<TotpEnableResult> {
    return this.api.post<TotpEnableResult>('/api/auth/2fa/enable', body);
  }

  disableTotp(body: TotpCodeBody): Observable<TotpDisableResult> {
    return this.api.post<TotpDisableResult>('/api/auth/2fa/disable', body);
  }

  dadosPessoais(): Observable<DadosPessoaisDocumento> {
    return this.api.get<DadosPessoaisDocumento>('/api/users/me/dados-pessoais');
  }

  anonimizar(body: AnonimizarBody): Observable<ResultadoAnonimizacao> {
    return this.api.post<ResultadoAnonimizacao>('/api/users/me/anonimizar', body);
  }
}
