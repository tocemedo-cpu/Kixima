-- ERP DOA Approval (KIXIMA PRO): novo tipo de evento consumido do exchange
-- kixima.events — pede ao ERP do tenant para correr o próprio workflow/DOA de
-- aprovação de uma PO.
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'PURCHASE_ORDER_APPROVAL_REQUESTED';
