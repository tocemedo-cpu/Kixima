package ao.kixima.invoice;

import ao.kixima.common.persistence.AbstractPersistableEntity;
import ao.kixima.po.PurchaseOrder;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Espelha o modelo Prisma `Invoice` (schema.prisma:1103-1176, tabela
 * `invoices`). ÂMBITO NESTE MARCO (M3c): os campos de negócio e a cadeia de
 * integridade local (serie/numeroNaSerie/hash*). As colunas AGT
 * (agtDocumentNo, agtRequestId, agtResultCode, agtErro, agtEstado) ficam de
 * fora do mapeamento — existem na tabela mas entram no M4, quando o domínio
 * AGT for portado (não bloqueiam `ddl-auto=validate`, só não são lidas/
 * escritas por este marco). `contract`/`consolidatedCallOffs` (call-off)
 * também ficam para quando o domínio Contract for portado.
 */
@Entity
@Table(name = "invoices")
public class Invoice extends AbstractPersistableEntity<String> {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String reference;

    @Column(name = "purchase_order_id", unique = true)
    private String purchaseOrderId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_order_id", insertable = false, updatable = false)
    private PurchaseOrder purchaseOrder;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(name = "net_amount", precision = 14, scale = 2)
    private BigDecimal netAmount;

    @Column(name = "tax_amount", precision = 14, scale = 2)
    private BigDecimal taxAmount;

    @Column(name = "withholding_amount", precision = 14, scale = 2)
    private BigDecimal withholdingAmount;

    @Column(nullable = false)
    private String currency = "AOA";

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(nullable = false)
    private InvoiceStatus status = InvoiceStatus.PENDENTE;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "due_at", nullable = false)
    private Instant dueAt;

    private String serie;

    @Column(name = "numero_na_serie")
    private Integer numeroNaSerie;

    @Column(name = "hash_documento")
    private String hashDocumento;

    @Column(name = "hash_anterior")
    private String hashAnterior;

    @Column(name = "assinada_em")
    private Instant assinadaEm;

    @Column(name = "referencia_pagamento", unique = true)
    private String referenciaPagamento;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "invoice", fetch = FetchType.LAZY)
    @OrderBy("lineNumber ASC")
    private List<InvoiceLine> lines = new ArrayList<>();

    protected Invoice() {
        // JPA
    }

    public Invoice(String id, String reference, String purchaseOrderId, BigDecimal amount, BigDecimal netAmount,
                    BigDecimal taxAmount, BigDecimal withholdingAmount, String currency, InvoiceStatus status,
                    Instant issuedAt, Instant dueAt, String serie, Integer numeroNaSerie, String hashDocumento,
                    String hashAnterior, Instant assinadaEm, String referenciaPagamento, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.reference = reference;
        this.purchaseOrderId = purchaseOrderId;
        this.amount = amount;
        this.netAmount = netAmount;
        this.taxAmount = taxAmount;
        this.withholdingAmount = withholdingAmount;
        this.currency = currency;
        this.status = status;
        this.issuedAt = issuedAt;
        this.dueAt = dueAt;
        this.serie = serie;
        this.numeroNaSerie = numeroNaSerie;
        this.hashDocumento = hashDocumento;
        this.hashAnterior = hashAnterior;
        this.assinadaEm = assinadaEm;
        this.referenciaPagamento = referenciaPagamento;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() {
        return id;
    }

    public String getReference() {
        return reference;
    }

    public String getPurchaseOrderId() {
        return purchaseOrderId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public BigDecimal getNetAmount() {
        return netAmount;
    }

    public BigDecimal getTaxAmount() {
        return taxAmount;
    }

    public BigDecimal getWithholdingAmount() {
        return withholdingAmount;
    }

    public String getCurrency() {
        return currency;
    }

    public InvoiceStatus getStatus() {
        return status;
    }

    public void setStatus(InvoiceStatus status) {
        this.status = status;
    }

    public Instant getIssuedAt() {
        return issuedAt;
    }

    public Instant getDueAt() {
        return dueAt;
    }

    public String getSerie() {
        return serie;
    }

    public Integer getNumeroNaSerie() {
        return numeroNaSerie;
    }

    public String getHashDocumento() {
        return hashDocumento;
    }

    public String getReferenciaPagamento() {
        return referenciaPagamento;
    }

    public void setReferenciaPagamento(String referenciaPagamento) {
        this.referenciaPagamento = referenciaPagamento;
    }

    public List<InvoiceLine> getLines() {
        return lines;
    }
}
