package ao.kixima.support;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, String> {

    List<SupportTicket> findByUserIdOrderByCreatedAtDesc(String userId, Pageable pageable);

    /** Fila: pedidos em aberto, sem ninguém a atender ainda. */
    List<SupportTicket> findByStatusAndAssignedToIdIsNullOrderByCreatedAtAsc(SupportStatus status);

    /** "Os meus atendimentos" — do assessor, ainda em curso. */
    List<SupportTicket> findByAssignedToIdAndStatusInOrderByCreatedAtAsc(String assignedToId, List<SupportStatus> statuses);

    /** Admin: listagem geral, sem filtro de estado (duas queries derivadas em vez de um JPQL com `(:status IS NULL OR ...)` — ver ProductSpecifications, M2, para o bug do Postgres com enum nativo nessa forma). */
    Page<SupportTicket> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<SupportTicket> findByStatusOrderByCreatedAtDesc(SupportStatus status, Pageable pageable);
}
