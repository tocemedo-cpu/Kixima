// Espelha BuyerPanelService.deliveries()/receptions() (Java) —
// backend/src/services/buyerService.js (Acompanhar Entrega, item 8; Receção, item 9).
import { CompanyRef } from './purchase-order.model';

export type DeliveryStage = 'EM_TRANSITO' | 'EM_PREPARACAO' | 'ENTREGUE' | 'CANCELADA';

export interface DeliveryRow {
  id: string;
  reference: string;
  supplier: CompanyRef;
  itemsCount: number;
  emittedAt: string;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  stage: DeliveryStage;
  label: string;
  progress: number;
  location: string;
}

export interface DeliveriesKpis {
  emTransito: number;
  emPreparacao: number;
  entregues: number;
  canceladas: number;
}

export interface DeliveriesResponse {
  kpis: DeliveriesKpis;
  items: DeliveryRow[];
}

export type ReceptionStatus = 'A_RECEBER' | 'RECEBIDO' | 'DIVERGENCIA';

export interface ReceptionRow {
  id: string;
  poId: string;
  reference: string;
  supplier: CompanyRef;
  item?: string | null;
  sku?: string | null;
  quantity: number;
  receivedAt?: string | null;
  status: ReceptionStatus;
  receptionStatus?: string | null;
}

export interface ReceptionsKpis {
  aReceber: number;
  recebidos: number;
  divergencia: number;
  total: number;
}

export interface ReceptionsResponse {
  kpis: ReceptionsKpis;
  items: ReceptionRow[];
}
