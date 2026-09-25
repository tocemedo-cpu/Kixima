// Porta de frontend/src/pages/shared/PrintableDocument.jsx. Documento
// imprimível/descarregável da Ordem de Compra ou da Fatura, modelo oficial
// KIXIMA (folha A4). Reutiliza GET /api/purchase-orders/:id (OrdersService/
// PurchaseOrderDto), estendido com os campos confirmados por um agente de
// pesquisa dedicado (dados da empresa, produto, linhas de fatura, hash).
import { Component, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { OrdersService } from '../orders/orders.service';
import { PurchaseOrderDto } from '../../core/models/purchase-order.model';
import { ApiError } from '../../core/models/api-error.model';
import { formatMoneyDoc, formatDateDoc, formatDateTimeDoc } from '../../shared/print-document';
import { PO_STATUS, INVOICE_STATUS, joinNonEmpty } from '../../shared/domain';
import { LoadingComponent } from '../../shared/components/loading.component';
import { ErrorBannerComponent } from '../../shared/components/error-banner.component';

// IVA (lei angolana): 14% sobre tudo. Retenção na Fonte de Imposto Industrial
// (Lei 26/20): 6,5% só sobre serviços. Os valores gravados pelo servidor
// mandam sempre — este cálculo local só serve as ordens antigas, criadas
// antes de o servidor passar a gravar netAmount/taxAmount/withholdingAmount
// na própria PO (o mesmo comentário existe no React de origem).
const IVA_RATE = 0.14;
const WHT_RATE = 0.065;

@Component({
  selector: 'app-printable-document',
  standalone: true,
  imports: [LoadingComponent, ErrorBannerComponent],
  templateUrl: './printable-document.component.html',
})
export class PrintableDocumentComponent {
  readonly isInvoice: boolean;
  readonly po = signal<PurchaseOrderDto | null>(null);
  readonly error = signal('');

  readonly PO_STATUS = PO_STATUS;
  readonly INVOICE_STATUS = INVOICE_STATUS;
  readonly formatMoneyDoc = formatMoneyDoc;
  readonly formatDateDoc = formatDateDoc;
  readonly formatDateTimeDoc = formatDateTimeDoc;
  readonly joinNonEmpty = joinNonEmpty;
  readonly agora = new Date().toISOString();

  private jaImprimiu = false;

  constructor(
    route: ActivatedRoute,
    private readonly ordersService: OrdersService,
    private readonly location: Location,
  ) {
    this.isInvoice = route.snapshot.data['kind'] === 'invoice';
    const id = route.snapshot.paramMap.get('id') || '';
    // "Baixar PDF" chega aqui com ?baixar=1 (ver OrderDetailComponent) —
    // poupa o clique extra no botão, abrindo já o diálogo de impressão.
    const baixarAutomatico = route.snapshot.queryParamMap.get('baixar') === '1';

    this.ordersService.get(id).subscribe({
      next: (po) => {
        this.po.set(po);
        if (baixarAutomatico && !this.jaImprimiu) {
          this.jaImprimiu = true;
          // O documento só existe depois de o browser desenhar a página —
          // sem o atraso, o diálogo de impressão às vezes abre sobre uma
          // folha ainda em branco.
          setTimeout(() => window.print(), 300);
        }
      },
      error: (e) => this.error.set(e instanceof ApiError ? e.message : 'Ocorreu um erro inesperado.'),
    });
  }

  voltar(): void {
    this.location.back();
  }

  imprimir(): void {
    window.print();
  }

  get invoice() {
    return this.po()?.invoice ?? null;
  }

  get buyer() {
    return this.po()?.buyerCompany ?? {};
  }

  get supplier() {
    return this.po()?.supplierCompany ?? {};
  }

  get currency(): string {
    return this.po()?.currency || 'AOA';
  }

  get subtotal(): number {
    return (this.po()?.items || []).reduce((s, it) => s + Number(it.lineTotal || 0), 0);
  }

  private get taxCalc(): number {
    return (this.po()?.items || []).reduce((s, it) => s + Number(it.lineTotal || 0) * IVA_RATE, 0);
  }

  private get whtCalc(): number {
    return (this.po()?.items || []).reduce(
      (s, it) => s + (it.product?.kind === 'SERVICO' ? Number(it.lineTotal || 0) * WHT_RATE : 0),
      0,
    );
  }

  get net(): number {
    const fonte = this.isInvoice ? this.invoice : this.po();
    return Number(fonte?.netAmount ?? this.subtotal);
  }

  get tax(): number {
    const fonte = this.isInvoice ? this.invoice : this.po();
    return Number(fonte?.taxAmount ?? this.taxCalc);
  }

  get withheld(): number {
    const fonte = this.isInvoice ? this.invoice : this.po();
    return Number(fonte?.withholdingAmount ?? this.whtCalc);
  }

  get total(): number {
    const po = this.po();
    if (!po) return 0;
    return this.isInvoice ? Number(this.invoice?.amount) : Number(po.totalAmount ?? this.subtotal + this.taxCalc);
  }

  // "Estimado" só quando o valor não veio do servidor.
  get estimado(): boolean {
    return !this.isInvoice && this.po()?.taxAmount == null;
  }

  get reference(): string {
    const po = this.po();
    if (!po) return '';
    return this.isInvoice ? this.invoice?.reference || '' : po.reference;
  }

  get invoiceLines() {
    return this.isInvoice ? this.invoice?.lines || [] : [];
  }

  get delivery(): string {
    const buyer = this.buyer as { address?: string | null; city?: string | null; province?: string | null; country?: string | null };
    return buyer.address || this.joinNonEmpty([buyer.city, buyer.province, buyer.country]) || 'A definir na receção';
  }

  // Espelha faturacaoService.numeroDocumentoAGT() do backend — série + ano de
  // emissão + sequencial com 7 dígitos, sem letra de tipo de documento. Sem
  // campo pré-formatado no contrato (confirmado por um agente de pesquisa
  // dedicado) — o cliente monta-o, tal como o React.
  numeroDocumentoAGT(doc: { serie?: string | null; numeroNaSerie?: number | null; issuedAt: string } | null | undefined): string | null {
    if (!doc?.serie || !doc?.numeroNaSerie) return null;
    const ano = new Date(doc.issuedAt).getFullYear();
    return `${doc.serie}.${ano}/${String(doc.numeroNaSerie).padStart(7, '0')}`;
  }

  numeroDocumentoAGTCreditNota(n: { serie?: string | null; numeroNaSerie?: number | null; issuedAt: string; reference: string }): string {
    return this.numeroDocumentoAGT(n) || n.reference;
  }
}
