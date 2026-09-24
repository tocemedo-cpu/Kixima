package ao.kixima.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, String>, JpaSpecificationExecutor<AuditLog> {

    /** Espelha `findFirst({ where: { action, entityRef }, orderBy: { createdAt: 'desc' } })` — alertaOperacionalService.avisadoRecentemente. */
    List<AuditLog> findByActionAndEntityRefOrderByCreatedAtDesc(String action, String entityRef, Pageable pageable);
}
