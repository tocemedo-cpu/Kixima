// Porta de GET /api/notifications (NotificationController.java) — usado
// nesta fase só pela Home do Comprador (últimas actividades).
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { NotificationListResponse } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  constructor(private readonly api: ApiService) {}

  list(page?: number, limit?: number): Observable<NotificationListResponse> {
    return this.api.get<NotificationListResponse>('/api/notifications', { page, limit });
  }
}
