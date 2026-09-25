// Porta de GET /api/users/profile e POST/DELETE /api/users/me/avatar
// (UserController.java) — confirmados por um agente de pesquisa dedicado.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ProfileResponse, UserPublicDto } from '../../core/models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private readonly api: ApiService) {}

  profile(): Observable<ProfileResponse> {
    return this.api.get<ProfileResponse>('/api/users/profile');
  }

  // Campo multipart "image" — confirmado contra UserController.java.
  uploadAvatar(file: File): Observable<UserPublicDto> {
    return this.api.upload<UserPublicDto>('/api/users/me/avatar', file, 'image');
  }

  // Sem erro se não houver avatar para remover — o Java define avatarUrl a
  // null incondicionalmente e devolve 200.
  removeAvatar(): Observable<UserPublicDto> {
    return this.api.del<UserPublicDto>('/api/users/me/avatar');
  }
}
