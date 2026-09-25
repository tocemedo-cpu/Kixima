// Porta de GET /api/notifications e PATCH /api/notifications/:id/read
// (NotificationController.java).
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { NotificationDto, NotificationListResponse } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  constructor(private readonly api: ApiService) {}

  list(page?: number, limit?: number): Observable<NotificationListResponse> {
    return this.api.get<NotificationListResponse>('/api/notifications', { page, limit });
  }

  // Devolve a notificação actualizada (não um ack). O Java NÃO verifica
  // posse antes de marcar como lida — comportamento herdado do Node,
  // reproduzido tal e qual, não é uma lacuna desta migração.
  markRead(id: string): Observable<NotificationDto> {
    return this.api.patch<NotificationDto>(`/api/notifications/${id}/read`);
  }
}
