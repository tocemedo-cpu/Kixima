package ao.kixima.supplierdev;

import ao.kixima.common.error.ValidationException;
import ao.kixima.plan.PlanService;
import ao.kixima.security.CurrentUser;
import ao.kixima.security.CurrentUserHolder;
import ao.kixima.security.RequirePermission;
import ao.kixima.security.RequireRole;
import ao.kixima.supplierdev.dto.ApproveSupplierDevRequest;
import ao.kixima.supplierdev.dto.CreateSupplierDevRequest;
import ao.kixima.supplierdev.dto.SupplierDevCreatedDto;
import ao.kixima.supplierdev.dto.SupplierDevListResponse;
import ao.kixima.supplierdev.dto.SupplierDevPublicDto;
import ao.kixima.supplierdev.dto.SupplierDevRequestDto;
import ao.kixima.supplierdev.dto.UpdateSupplierDevRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static ao.kixima.security.AdminArea.SUPORTE;
import static ao.kixima.security.PersonaRole.ADMIN_SISTEMA;
import static org.springframework.http.HttpStatus.CREATED;

/**
 * Espelha backend/src/routes/supplierDevRoutes.js — a CANDIDATURA é
 * pública (entra pela página de login e pela home, pode vir de empresa
 * ainda sem conta); a GESTÃO é do Admin do Sistema, área Suporte.
 *
 * NÃO PORTADO: o limitador de 10 candidaturas/15min
 * ({@code publicLimiter}) — precisa de Bucket4j, ainda não é dependência
 * do projeto (mesma lacuna documentada em SupportController/
 * ConversationController para os seus próprios limitadores).
 */
@RestController
@RequestMapping("/api/supplier-development")
public class SupplierDevController {

    private final SupplierDevService supplierDevService;
    private final PlanService planService;

    public SupplierDevController(SupplierDevService supplierDevService, PlanService planService) {
        this.supplierDevService = supplierDevService;
        this.planService = planService;
    }

    // --- Público -------------------------------------------------------

    @GetMapping("/fee")
    public PlanService.SupplierDevAccessFee taxaDeAcesso() {
        return planService.supplierDevAccessFee();
    }

    @PostMapping("/requests")
    @ResponseStatus(CREATED)
    public SupplierDevCreatedDto candidatar(@RequestBody CreateSupplierDevRequest body) {
        validarCandidatura(body);
        CurrentUser user = CurrentUserHolder.get();
        SupplierDevTrack track = body.track() == null || body.track().isBlank()
                ? SupplierDevTrack.AMBOS : trackValido(body.track());
        return supplierDevService.criar(user == null ? null : user.companyId(), body.companyName().trim(),
                body.taxId(), body.contactName().trim(), body.contactEmail(), body.contactPhone(), body.province(),
                body.sector(), body.employees(), track, body.needs());
    }

    private void validarCandidatura(CreateSupplierDevRequest body) {
        if (body.companyName() == null || body.companyName().trim().length() < 2) {
            throw new ValidationException("Indique o nome da empresa.");
        }
        if (body.contactName() == null || body.contactName().trim().length() < 2) {
            throw new ValidationException("Indique o nome do contacto.");
        }
        if (body.contactEmail() == null || !body.contactEmail().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new ValidationException("Indique um email válido.");
        }
        if (!Boolean.TRUE.equals(body.feeAccepted())) {
            throw new ValidationException("Confirme que aceita a taxa de acesso cobrada na submissão.");
        }
    }

    @GetMapping("/requests/{reference}/track")
    public SupplierDevPublicDto acompanhar(@PathVariable String reference) {
        return supplierDevService.acompanharPorReferencia(reference);
    }

    // --- Admin do Sistema ------------------------------------------------

    @GetMapping("/requests")
    @RequireRole({ADMIN_SISTEMA})
    @RequirePermission(SUPORTE)
    public SupplierDevListResponse listar(@RequestParam(required = false) Integer page,
                                           @RequestParam(required = false) Integer limit,
                                           @RequestParam(required = false) String status,
                                           @RequestParam(required = false) String track,
                                           @RequestParam(required = false) String q) {
        SupplierDevStatus s = status == null || status.isBlank() ? null : SupplierDevStatus.valueOf(status);
        SupplierDevTrack t = track == null || track.isBlank() ? null : trackValido(track);
        return supplierDevService.listar(page, limit, s, t, q);
    }

    @PatchMapping("/requests/{id}")
    @RequireRole({ADMIN_SISTEMA})
    @RequirePermission(SUPORTE)
    public SupplierDevRequestDto atualizar(@PathVariable String id, @RequestBody UpdateSupplierDevRequest body) {
        return supplierDevService.atualizar(id, body, CurrentUserHolder.get());
    }

    @PatchMapping("/requests/{id}/approve")
    @RequireRole({ADMIN_SISTEMA})
    @RequirePermission(SUPORTE)
    public SupplierDevRequestDto aprovar(@PathVariable String id, @RequestBody ApproveSupplierDevRequest body, HttpServletRequest req) {
        String baseUrl = req.getScheme() + "://" + (req.getHeader("host") != null ? req.getHeader("host") : req.getServerName());
        return supplierDevService.aprovar(id, body, CurrentUserHolder.get(), baseUrl);
    }

    private SupplierDevTrack trackValido(String track) {
        try {
            return SupplierDevTrack.valueOf(track);
        } catch (Exception e) {
            throw new ValidationException("Percurso inválido — use BUROCRACIA, PARCERIA ou AMBOS.");
        }
    }
}
