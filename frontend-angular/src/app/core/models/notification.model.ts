// GET /api/notifications (NotificationController.java) — usado pela Home do
// Comprador (últimas actividades). Envelope real tem paginação e contagem de
// não lidas; a Home só consome `itens`.
export interface NotificationDto {
  id: string;
  userId: string;
  companyId?: string | null;
  type: string;
  channel: string;
  title?: string | null;
  message: string;
  readAt?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  itens: NotificationDto[];
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
  porLer: number;
}
