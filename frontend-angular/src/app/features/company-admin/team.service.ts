// Porta do troço "Convites de utilizadores" e "Utilizadores & Perfis da
// própria empresa" de companyRoutes.js — usado por Users.jsx (Company Admin).
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { CompanyUserDto } from '../../core/models/invite.model';
import { CreateInviteBody, InviteDto } from '../../core/models/invite-management.model';

@Injectable({ providedIn: 'root' })
export class TeamService {
  constructor(private readonly api: ApiService) {}

  listUsers(): Observable<CompanyUserDto[]> {
    return this.api.get<CompanyUserDto[]>('/api/companies/users');
  }

  listInvites(): Observable<InviteDto[]> {
    return this.api.get<InviteDto[]>('/api/companies/invites');
  }

  createInvite(body: CreateInviteBody): Observable<unknown> {
    return this.api.post('/api/companies/invites', body);
  }

  resendInvite(id: string): Observable<unknown> {
    return this.api.post(`/api/companies/invites/${id}/resend`);
  }

  cancelInvite(id: string): Observable<unknown> {
    return this.api.post(`/api/companies/invites/${id}/cancel`);
  }

  activateUser(id: string): Observable<unknown> {
    return this.api.patch(`/api/companies/users/${id}/activate`);
  }

  removeUser(id: string): Observable<unknown> {
    return this.api.del(`/api/companies/users/${id}`);
  }
}
