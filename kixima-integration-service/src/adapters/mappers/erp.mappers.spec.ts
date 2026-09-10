import { AribaMapper, OracleMapper, PrimaveraMapper, SapMapper } from './erp.mappers';
import { PurchaseOrderApprovalRequestedPayload, PurchaseOrderApprovedPayload } from '@app/common/types/erp.types';

const PO: PurchaseOrderApprovedPayload = {
  poId: 'po-1',
  reference: 'PO-2026-00002',
  buyer: { taxId: 'AO-CLI-0001', name: 'Petro Angola' },
  supplier: { taxId: 'AO-FOR-0001', name: 'Kianda' },
  currency: 'AOA',
  totalAmount: 2_100_000,
  lines: [{ sku: 'GEN-500', description: 'Gerador Diesel 500 kVA', quantity: 1, unitPrice: 2_100_000, lineTotal: 2_100_000 }],
  approvedAt: '2026-07-29T00:00:00.000Z',
};

const PO_APPROVAL_REQUEST: PurchaseOrderApprovalRequestedPayload = {
  poId: 'po-2',
  reference: 'PO-2026-00003',
  buyer: { taxId: 'AO-CLI-0001', name: 'Petro Angola' },
  supplier: { taxId: 'AO-FOR-0001', name: 'Kianda' },
  currency: 'AOA',
  totalAmount: 3_500_000,
  lines: [{ sku: 'VLV-10', description: 'Válvula industrial', quantity: 2, unitPrice: 1_750_000, lineTotal: 3_500_000 }],
  requestedAt: '2026-09-16T00:00:00.000Z',
};

describe('ERP mappers — Purchase Order', () => {
  it('SAP mapeia para A_PurchaseOrder', () => {
    const b = SapMapper.purchaseOrder(PO) as Record<string, unknown>;
    expect(b.Supplier).toBe('AO-FOR-0001');
    expect(b.DocumentCurrency).toBe('AOA');
    expect((b.to_PurchaseOrderItem as { results: unknown[] }).results).toHaveLength(1);
  });

  it('Oracle mapeia para OrderNumber/lines', () => {
    const b = OracleMapper.purchaseOrder(PO) as Record<string, unknown>;
    expect(b.OrderNumber).toBe('PO-2026-00002');
    expect(b.Total).toBe(2_100_000);
  });

  it('Primavera mapeia para numero/linhas', () => {
    const b = PrimaveraMapper.purchaseOrder(PO) as Record<string, unknown>;
    expect(b.numero).toBe('PO-2026-00002');
    expect(b.fornecedorNif).toBe('AO-FOR-0001');
  });

  it('Ariba mapeia para OrderRequestHeader/ItemOut', () => {
    const b = AribaMapper.orderRequest(PO) as Record<string, unknown>;
    expect((b.OrderRequestHeader as Record<string, unknown>)['@_orderID']).toBe('PO-2026-00002');
    expect(b.ItemOut).toHaveLength(1);
  });
});

// ERP DOA Approval: pedido de aprovação é uma operação DISTINTA de
// "empurrar a PO já aprovada" (approvedAt não existe neste payload) — os
// mapeadores têm de produzir um corpo próprio, não reaproveitar por acaso o
// de purchaseOrder/orderRequest.
describe('ERP mappers — pedido de aprovação (DOA)', () => {
  it('SAP mapeia para A_PurchaseOrder sob estratégia de liberação', () => {
    const b = SapMapper.approvalRequest(PO_APPROVAL_REQUEST) as Record<string, unknown>;
    expect(b.Supplier).toBe('AO-FOR-0001');
    expect(b.PurchaseOrderReference).toBe('PO-2026-00003');
    expect((b.to_PurchaseOrderItem as { results: unknown[] }).results).toHaveLength(1);
  });

  it('Oracle mapeia com RequestApproval=true', () => {
    const b = OracleMapper.approvalRequest(PO_APPROVAL_REQUEST) as Record<string, unknown>;
    expect(b.OrderNumber).toBe('PO-2026-00003');
    expect(b.RequestApproval).toBe(true);
    expect(b.Total).toBe(3_500_000);
  });

  it('Primavera mapeia com pedirAprovacao=true', () => {
    const b = PrimaveraMapper.approvalRequest(PO_APPROVAL_REQUEST) as Record<string, unknown>;
    expect(b.numero).toBe('PO-2026-00003');
    expect(b.pedirAprovacao).toBe(true);
  });

  it('Ariba mapeia para ApprovalRequestHeader/ItemOut', () => {
    const b = AribaMapper.approvalRequest(PO_APPROVAL_REQUEST) as Record<string, unknown>;
    expect((b.ApprovalRequestHeader as Record<string, unknown>)['@_orderID']).toBe('PO-2026-00003');
    expect(b.ItemOut).toHaveLength(1);
  });
});
