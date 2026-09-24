package ao.kixima.po;

import ao.kixima.audit.AuditService;
import ao.kixima.po.dto.CreatePoRequest;
import ao.kixima.po.dto.PurchaseOrderDto;
import ao.kixima.po.dto.PurchaseOrderItemDto;
import ao.kixima.po.dto.ReasonRequest;
import ao.kixima.po.dto.ReceptionRequest;
import ao.kixima.po.dto.ResolveDivergenceRequest;
import ao.kixima.security.CurrentUser;
import ao.kixima.security.CurrentUserHolder;
import ao.kixima.security.RequireRole;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

import static ao.kixima.security.PersonaRole.COMPANY_ADMIN;
import static ao.kixima.security.PersonaRole.COMPRADOR;
import static ao.kixima.security.PersonaRole.FORNECEDOR;
import static org.springframework.http.HttpStatus.CREATED;

/**
 * Espelha backend/src/controllers/poController.js + o troço portado de
 * backend/src/routes/poRoutes.js. `history` (linha do tempo via AuditLog)
 * não está incluído — depende de uma leitura filtrada de AuditLog ainda não
 * exposta (M5).
 */
@RestController
@RequestMapping("/api/purchase-orders")
public class PoController {

    private final PoService poService;
    private final AuditService auditService;

    public PoController(PoService poService, AuditService auditService) {
        this.poService = poService;
        this.auditService = auditService;
    }

    @PostMapping
    @ResponseStatus(CREATED)
    @RequireRole({COMPRADOR, COMPANY_ADMIN})
    public PurchaseOrderDto create(@Valid @RequestBody CreatePoRequest body, HttpServletRequest req) {
        CurrentUser user = CurrentUserHolder.get();
        List<PoService.ItemPedido> itens = body.items().stream()
                .map(i -> new PoService.ItemPedido(i.productId(), i.quantity())).toList();
        PurchaseOrder po = poService.createPurchaseOrder(user.companyId(), body.supplierCompanyId(), user.id(), itens);
        auditService.recordSafe(new AuditService.Entry(auditService.actorFrom(user, req), "PO_CRIADA",
                "PurchaseOrder", po.getId(), po.getReference(),
                Map.of("valor", po.getTotalAmount().toPlainString(), "moeda", po.getCurrency(), "fornecedor", po.getSupplierCompanyId())));
        return toDto(po);
    }

    @GetMapping
    public List<PurchaseOrderDto> list(@RequestParam(required = false) String status) {
        CurrentUser user = CurrentUserHolder.get();
        PoStatus statusEnum = status == null ? null : PoStatus.valueOf(status);
        return poService.listPurchaseOrders(user.companyId(), user.role(), statusEnum).stream().map(this::toDto).toList();
    }

    @GetMapping("/{id}")
    public PurchaseOrderDto getOne(@PathVariable String id) {
        return toDto(poService.getPurchaseOrder(id, CurrentUserHolder.get()));
    }

    @PatchMapping("/{id}/approve")
    @RequireRole({COMPANY_ADMIN})
    public PurchaseOrderDto approve(@PathVariable String id, HttpServletRequest req) {
        CurrentUser user = CurrentUserHolder.get();
        PurchaseOrder po = poService.approvePurchaseOrder(id, user.id(), user.companyId());
        auditService.recordSafe(new AuditService.Entry(auditService.actorFrom(user, req), "PO_APROVADA",
                "PurchaseOrder", po.getId(), po.getReference(),
                Map.of("valor", po.getTotalAmount().toPlainString(), "moeda", po.getCurrency())));
        return toDto(po);
    }

    @PatchMapping("/{id}/reject")
    @RequireRole({COMPANY_ADMIN})
    public PurchaseOrderDto reject(@PathVariable String id, @RequestBody(required = false) ReasonRequest body, HttpServletRequest req) {
        CurrentUser user = CurrentUserHolder.get();
        String reason = body == null ? null : body.reason();
        PurchaseOrder po = poService.rejectPurchaseOrder(id, user.id(), reason, user.companyId());
        auditService.recordSafe(new AuditService.Entry(auditService.actorFrom(user, req), "PO_REJEITADA",
                "PurchaseOrder", po.getId(), po.getReference(), reasonDetail(reason)));
        return toDto(po);
    }

    @PatchMapping("/{id}/accept")
    @RequireRole({FORNECEDOR, COMPANY_ADMIN})
    public PurchaseOrderDto accept(@PathVariable String id, HttpServletRequest req) {
        CurrentUser user = CurrentUserHolder.get();
        PurchaseOrder po = poService.acceptPurchaseOrder(id, user.companyId());
        auditService.recordSafe(new AuditService.Entry(auditService.actorFrom(user, req), "PO_ACEITE",
                "PurchaseOrder", po.getId(), po.getReference(),
                Map.of("valor", po.getTotalAmount().toPlainString(), "moeda", po.getCurrency())));
        return toDto(po);
    }

    @PatchMapping("/{id}/refuse")
    @RequireRole({FORNECEDOR, COMPANY_ADMIN})
    public PurchaseOrderDto refuse(@PathVariable String id, @Valid @RequestBody ReasonRequest body, HttpServletRequest req) {
        CurrentUser user = CurrentUserHolder.get();
        PurchaseOrder po = poService.refusePurchaseOrder(id, user.companyId(), body.reason());
        auditService.recordSafe(new AuditService.Entry(auditService.actorFrom(user, req), "PO_RECUSADA_FORNECEDOR",
                "PurchaseOrder", po.getId(), po.getReference(), Map.of("motivo", body.reason())));
        return toDto(po);
    }

    @PatchMapping("/{id}/dispatch")
    @RequireRole({FORNECEDOR, COMPANY_ADMIN})
    public PurchaseOrderDto dispatch(@PathVariable String id, HttpServletRequest req) {
        CurrentUser user = CurrentUserHolder.get();
        PurchaseOrder po = poService.dispatchPurchaseOrder(id, user.companyId());
        auditService.recordSafe(new AuditService.Entry(auditService.actorFrom(user, req), "PO_DESPACHADA",
                "PurchaseOrder", po.getId(), po.getReference(), null));
        return toDto(po);
    }

    @PatchMapping("/{id}/delivered")
    @RequireRole({FORNECEDOR, COMPANY_ADMIN})
    public PurchaseOrderDto delivered(@PathVariable String id, HttpServletRequest req) {
        CurrentUser user = CurrentUserHolder.get();
        PurchaseOrder po = poService.markDelivered(id, user.companyId());
        auditService.recordSafe(new AuditService.Entry(auditService.actorFrom(user, req), "PO_ENTREGUE",
                "PurchaseOrder", po.getId(), po.getReference(), null));
        return toDto(po);
    }

    @PatchMapping("/{id}/reception")
    @RequireRole({COMPRADOR, COMPANY_ADMIN})
    public PurchaseOrderDto receive(@PathVariable String id, @Valid @RequestBody ReceptionRequest body, HttpServletRequest req) {
        CurrentUser user = CurrentUserHolder.get();
        PurchaseOrder po = poService.confirmReception(id, user.companyId(), new PoService.ConfirmacaoRececao(body.conforme(), body.notes()));
        auditService.recordSafe(new AuditService.Entry(auditService.actorFrom(user, req), "RECECAO_MERCADORIA",
                "PurchaseOrder", po.getId(), po.getReference(), Map.of("conforme", body.conforme(), "notas", body.notes() != null ? body.notes() : "")));
        // Receção conforme fecha a ordem automaticamente — evento próprio na linha do tempo, distinto da receção em si.
        if (po.getStatus() == PoStatus.CONCLUIDA) {
            auditService.recordSafe(new AuditService.Entry(auditService.actorFrom(user, req), "PO_CONCLUIDA",
                    "PurchaseOrder", po.getId(), po.getReference(), Map.of("motivo", "receção conforme")));
        }
        return toDto(po);
    }

    @PatchMapping("/{id}/resolve-divergence")
    @RequireRole({COMPRADOR, COMPANY_ADMIN})
    public PurchaseOrderDto resolveDivergence(@PathVariable String id, @Valid @RequestBody ResolveDivergenceRequest body, HttpServletRequest req) {
        CurrentUser user = CurrentUserHolder.get();
        PurchaseOrder po = poService.resolveDivergence(id, user.companyId(), new PoService.ResolucaoDivergencia(body.outcome(), body.notes()));
        auditService.recordSafe(new AuditService.Entry(auditService.actorFrom(user, req), "DIVERGENCIA_RESOLVIDA",
                "PurchaseOrder", po.getId(), po.getReference(),
                Map.of("desfecho", body.outcome(), "notas", body.notes() != null ? body.notes() : "")));
        return toDto(po);
    }

    private Map<String, Object> reasonDetail(String reason) {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("motivo", reason);
        return m;
    }

    private PurchaseOrderDto toDto(PurchaseOrder po) {
        List<PurchaseOrderItemDto> items = po.getItems().stream()
                .map(i -> new PurchaseOrderItemDto(i.getId(), i.getProductId(), i.getQuantity(), i.getUnitPrice(), i.getLineTotal()))
                .toList();
        return new PurchaseOrderDto(
                po.getId(), po.getReference(), po.getBuyerCompanyId(), po.getSupplierCompanyId(),
                po.getCreatedById(), po.getApprovedById(), po.getStatus().name(),
                po.getTotalAmount(), po.getNetAmount(), po.getTaxAmount(), po.getWithholdingAmount(),
                po.getCurrency(), po.isCallOff(), po.isErpManaged(),
                po.getAcceptedAt(), po.getPaymentDueAt(), po.getDispatchedAt(), po.getDeliveredAt(), po.getReceivedAt(),
                po.getReceptionStatus(), po.getDivergenceResolution(), po.getDivergenceResolutionNotes(),
                po.getApprovedAt(), po.getRejectedAt(), po.getRejectionReason(), po.getRefusedAt(), po.getRefusalReason(),
                po.getCreatedBySource(), po.getCreatedAt(),
                items);
    }
}
