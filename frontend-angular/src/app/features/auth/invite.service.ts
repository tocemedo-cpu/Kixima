// Porta de GET/POST /api/companies/invite/:token — usado por AcceptInvite.jsx.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AcceptInviteBody, CompanyUserDto, ResolvedInviteDto } from '../../core/models/invite.model';

@Injectable({ providedIn: 'root' })
export class InviteService {
  constructor(private readonly api: ApiService) {}

  resolve(token: string): Observable<ResolvedInviteDto> {
    return this.api.get<ResolvedInviteDto>(`/api/companies/invite/${token}`);
  }

  accept(token: string, body: AcceptInviteBody): Observable<CompanyUserDto> {
    return this.api.post<CompanyUserDto>(`/api/companies/invite/${token}/accept`, body);
  }
}
