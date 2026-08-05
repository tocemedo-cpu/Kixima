import { AribaMapper, OracleMapper, PrimaveraMapper, SapMapper } from './erp.mappers';
import { PurchaseOrderApprovedPayload } from '@app/common/types/erp.types';

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
