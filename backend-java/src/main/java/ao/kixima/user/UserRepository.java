package ao.kixima.user;

import ao.kixima.security.PersonaRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);

    /** Espelha `prisma.user.findMany({ where: { companyId, role: { in: roles }, active: true } })` (notificationService.notifyUsersByRole). */
    List<User> findByCompanyIdAndRoleInAndActiveTrue(String companyId, List<PersonaRole> roles);

    /** Usado por UploadAccessService — o avatar de um utilizador é sempre público. */
    boolean existsByAvatarUrl(String avatarUrl);

    /** Lista de assessores para o seletor "Transferir para..." (SupportController.agentes). */
    List<User> findByRoleAndActiveTrue(PersonaRole role);

    /** Lugares já ocupados no plano da empresa — ver InviteService.assertLugaresDisponiveis. */
    long countByCompanyIdAndActiveTrue(String companyId);

    Optional<User> findByIdAndCompanyId(String id, String companyId);

    /** Espelha `orderBy: [{ active: 'asc' }, { createdAt: 'desc' }]` de companyService.listCompanyUsers. */
    @Query("SELECT u FROM User u WHERE u.companyId = :companyId ORDER BY u.active ASC, u.createdAt DESC")
    List<User> findByCompanyIdOrderByActiveAscCreatedAtDesc(@Param("companyId") String companyId);

    /**
     * `company` é LAZY (plano, secção 2) — o AuthenticationFilter e o login
     * precisam de `company.type`/`company.plan` na mesma resposta que o
     * Node devolve (`include: { company: ... }`), por isso trazem-na já
     * carregada aqui em vez de arriscar LazyInitializationException fora
     * de uma sessão aberta.
     */
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.company WHERE u.id = :id")
    Optional<User> findByIdWithCompany(@Param("id") String id);

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.company WHERE u.email = :email")
    Optional<User> findByEmailWithCompany(@Param("email") String email);
}
