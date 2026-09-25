// Porta de GET/POST /api/admin/invite/:token — usado por AcceptAdminInvite.jsx.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AcceptAdminInviteBody, CompanyUserDto, ResolvedAdminInviteDto } from '../../core/models/invite.model';

@Injectable({ providedIn: 'root' })
export class AdminInviteService {
  constructor(private readonly api: ApiService) {}

  resolve(token: string): Observable<ResolvedAdminInviteDto> {
    return this.api.get<ResolvedAdminInviteDto>(`/api/admin/invite/${token}`);
  }

  accept(token: string, body: AcceptAdminInviteBody): Observable<CompanyUserDto> {
    return this.api.post<CompanyUserDto>(`/api/admin/invite/${token}/accept`, body);
  }
}
