/**
 * Mapeadores de payload: transformam os eventos canónicos da KIXIMA no formato
 * de documento de cada ERP. Mantidos separados dos adapters (transporte) para
 * que o mapeamento seja testável e evolua por ERP sem tocar no fluxo.
 */
import {
  GoodsReceivedPayload,
  InvoiceIssuedPayload,
  PaymentCompletedPayload,
  PurchaseOrderApprovedPayload,
} from '@app/common/types/erp.types';

const iso = (d: string): string => d;

// ---------------------------------------------------------------------
// SAP S/4HANA — entidades OData (A_PurchaseOrder, A_SupplierInvoice, …).
// ---------------------------------------------------------------------
export const SapMapper = {
  purchaseOrder(p: PurchaseOrderApprovedPayload): Record<string, unknown> {
    return {
      PurchaseOrderType: 'NB',
      CompanyCode: '1000',
      PurchasingOrganization: '1000',
      Supplier: p.supplier.taxId,
      DocumentCurrency: p.currency,
      PurchaseOrderReference: p.reference,
      to_PurchaseOrderItem: {
        results: p.lines.map((l, i) => ({
          PurchaseOrderItem: String((i + 1) * 10),
          Material: l.sku ?? '',
          PurchaseOrderItemText: l.description,
          OrderQuantity: l.quantity,
          NetPriceAmount: l.unitPrice,
        })),
      },
    };
  },
  supplierInvoice(p: InvoiceIssuedPayload): Record<string, unknown> {
    return {
      CompanyCode: '1000',
      DocumentDate: iso(p.issuedAt),
      InvoicingParty: p.supplier.taxId,
      DocumentCurrency: p.currency,
      InvoiceGrossAmount: p.amount,
      SupplierInvoiceIDByInvcgParty: p.reference,
    };
  },
  materialDocument(p: GoodsReceivedPayload): Record<string, unknown> {
    return {
      GoodsMovementCode: '01',
      PostingDate: iso(p.receivedAt),
      ReferenceDocument: p.poReference,
      to_MaterialDocumentItem: {
        results: p.lines.map((l) => ({ Material: l.sku ?? '', QuantityInEntryUnit: l.quantityReceived })),
      },
    };
  },
  paymentRequest(p: PaymentCompletedPayload): Record<string, unknown> {
    return {
      PaymentReference: p.invoiceReference,
      AmountInPaymentCurrency: p.amount,
      PaymentCurrency: p.currency,
      PaymentDate: iso(p.paidAt),
      PaymentMethod: p.method,
    };
  },
};

// ---------------------------------------------------------------------
// Oracle ERP Cloud — recursos REST (Financials Cloud).
// ---------------------------------------------------------------------
export const OracleMapper = {
  purchaseOrder(p: PurchaseOrderApprovedPayload): Record<string, unknown> {
    return {
      OrderNumber: p.reference,
      Supplier: p.supplier.name,
      CurrencyCode: p.currency,
      Total: p.totalAmount,
      lines: p.lines.map((l, i) => ({
        LineNumber: i + 1,
        Description: l.description,
        Quantity: l.quantity,
        Price: l.unitPrice,
      })),
    };
  },
  invoice(p: InvoiceIssuedPayload): Record<string, unknown> {
    return {
      InvoiceNumber: p.reference,
      Supplier: p.supplier.name,
      InvoiceCurrency: p.currency,
      InvoiceAmount: p.amount,
      InvoiceDate: iso(p.issuedAt),
      PaymentTermsDate: iso(p.dueAt),
    };
  },
  receivingReceipt(p: GoodsReceivedPayload): Record<string, unknown> {
    return {
      ReceiptSourceCode: 'VENDOR',
      OrderNumber: p.poReference,
      lines: p.lines.map((l) => ({ ItemDescription: l.description, Quantity: l.quantityReceived })),
    };
  },
  payment(p: PaymentCompletedPayload): Record<string, unknown> {
    return {
      PaymentReference: p.invoiceReference,
      PaymentAmount: p.amount,
      Currency: p.currency,
      PaymentDate: iso(p.paidAt),
      PaymentMethodCode: p.method,
    };
  },
};

// ---------------------------------------------------------------------
// Primavera ERP — REST (documentos simples chave/valor).
// ---------------------------------------------------------------------
export const PrimaveraMapper = {
  purchaseOrder(p: PurchaseOrderApprovedPayload): Record<string, unknown> {
    return {
      numero: p.reference,
      fornecedorNif: p.supplier.taxId,
      moeda: p.currency,
      total: p.totalAmount,
      linhas: p.lines.map((l) => ({ artigo: l.sku ?? '', descricao: l.description, qtd: l.quantity, preco: l.unitPrice })),
    };
  },
  invoice(p: InvoiceIssuedPayload): Record<string, unknown> {
    return {
      numero: p.reference,
      fornecedorNif: p.supplier.taxId,
      moeda: p.currency,
      valor: p.amount,
      dataEmissao: iso(p.issuedAt),
      dataVencimento: iso(p.dueAt),
    };
  },
  goodsReceipt(p: GoodsReceivedPayload): Record<string, unknown> {
    return {
      ordemCompra: p.poReference,
      data: iso(p.receivedAt),
      linhas: p.lines.map((l) => ({ artigo: l.sku ?? '', descricao: l.description, qtdRecebida: l.quantityReceived })),
    };
  },
  payment(p: PaymentCompletedPayload): Record<string, unknown> {
    return {
      fatura: p.invoiceReference,
      valor: p.amount,
      moeda: p.currency,
      data: iso(p.paidAt),
      metodo: p.method,
    };
  },
};

// ---------------------------------------------------------------------
// SAP Ariba — corpos cXML (objetos convertidos em XML pelo adapter).
// ---------------------------------------------------------------------
export const AribaMapper = {
  orderRequest(p: PurchaseOrderApprovedPayload): Record<string, unknown> {
    return {
      OrderRequestHeader: {
        '@_orderID': p.reference,
        '@_orderDate': iso(p.approvedAt),
        Total: { Money: { '@_currency': p.currency, '#text': p.totalAmount } },
      },
      ItemOut: p.lines.map((l, i) => ({
        '@_quantity': l.quantity,
        '@_lineNumber': i + 1,
        ItemID: { SupplierPartID: l.sku ?? '' },
        ItemDetail: {
          UnitPrice: { Money: { '@_currency': p.currency, '#text': l.unitPrice } },
          Description: l.description,
        },
      })),
    };
  },
  invoiceDetailRequest(p: InvoiceIssuedPayload): Record<string, unknown> {
    return {
      InvoiceDetailRequestHeader: { '@_invoiceID': p.reference, '@_invoiceDate': iso(p.issuedAt) },
      InvoiceDetailSummary: { GrossAmount: { Money: { '@_currency': p.currency, '#text': p.amount } } },
    };
  },
  receiptRequest(p: GoodsReceivedPayload): Record<string, unknown> {
    return {
      ReceiptRequestHeader: { '@_receiptDate': iso(p.receivedAt), '@_orderID': p.poReference },
      ReceiptItem: p.lines.map((l) => ({ '@_quantity': l.quantityReceived, ItemID: { SupplierPartID: l.sku ?? '' } })),
    };
  },
  paymentRemittanceRequest(p: PaymentCompletedPayload): Record<string, unknown> {
    return {
      PaymentRemittanceRequestHeader: { '@_paymentDate': iso(p.paidAt) },
      PaymentRemittanceSummary: {
        InvoiceReference: { '@_invoiceID': p.invoiceReference },
        AmountPaid: { Money: { '@_currency': p.currency, '#text': p.amount } },
      },
    };
  },
};
