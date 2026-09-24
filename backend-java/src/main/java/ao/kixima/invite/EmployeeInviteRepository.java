package ao.kixima.invite;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface EmployeeInviteRepository extends JpaRepository<EmployeeInvite, String> {

    List<EmployeeInvite> findByCompanyIdOrderByCreatedAtDesc(String companyId);

    Optional<EmployeeInvite> findByIdAndCompanyId(String id, String companyId);

    long countByCompanyIdAndStatusAndExpiresAtAfter(String companyId, InviteStatus status, Instant instant);
}
