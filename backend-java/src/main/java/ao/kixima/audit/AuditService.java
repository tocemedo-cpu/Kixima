package ao.kixima.audit;

import ao.kixima.security.CurrentUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Espelha backend/src/services/auditService.js — trilho de auditoria
 * APPEND-ONLY. Este marco porta {@code actorFrom}/{@code anonimoFrom}/
 * {@code contextoFrom}/{@code recordSafe}, usados nos fluxos de autenticação
 * (M1). {@code list()} (listagem paginada para o Admin do Sistema) entra no
 * M5, quando a rota /api/admin/audit-logs for portada.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository repository;
    private final ObjectMapper objectMapper;

    public AuditService(AuditLogRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public Actor actorFrom(CurrentUser user, HttpServletRequest req) {
        if (user == null) return anonimoFrom(req);
        return new Actor(user.id(), user.name(), user.role() == null ? null : user.role().name(),
                user.companyId(), req.getRemoteAddr());
    }

    public Actor anonimoFrom(HttpServletRequest req) {
        return Actor.anonimo(req.getRemoteAddr());
    }

    public Map<String, Object> contextoFrom(HttpServletRequest req) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ip", req.getRemoteAddr());
        String agente = req.getHeader("user-agent");
        m.put("agente", agente == null ? null : agente.substring(0, Math.min(180, agente.length())));
        return m;
    }

    public record Entry(Actor actor, String action, String entityType, String entityId,
                         String entityRef, Object detail) {
        public Entry(Actor actor, String action, String entityType) {
            this(actor, action, entityType, null, null, null);
        }
    }

    /**
     * Variante "não pode partir o negócio": regista após o sucesso da
     * operação; uma falha aqui vai para o log (Sentry entra quando M0
     * adicionar essa dependência — ver TODO em GlobalExceptionHandler).
     */
    public void recordSafe(Entry entry) {
        try {
            String detailJson = entry.detail() == null ? null : objectMapper.writeValueAsString(entry.detail());
            Actor a = entry.actor() == null ? Actor.anonimo(null) : entry.actor();
            AuditLog row = new AuditLog(UUID.randomUUID().toString(), entry.action(), entry.entityType(),
                    entry.entityId(), entry.entityRef(), a.actorId(), a.actorName(), a.actorRole(),
                    a.companyId(), a.ip(), detailJson, Instant.now());
            repository.save(row);
        } catch (Exception e) {
            log.error("AUDITORIA FALHOU — registo perdido: action={}", entry.action(), e);
        }
    }
}
