-- Aviso ao fornecedor quando o stock de um item cruza o mínimo definido —
-- ver catalogService.createStockMovement/updateStock e
-- notificationService.events.estoqueBaixo.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ESTOQUE_BAIXO';
