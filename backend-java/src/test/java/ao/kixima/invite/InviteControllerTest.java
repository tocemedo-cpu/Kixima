package ao.kixima.invite;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Teste de paridade de contrato para o troço "Convites de utilizadores" +
 * "Utilizadores & Perfis" de companyService.js/companyController.js/
 * companyRoutes.js: criação de convite pelo Company Admin, resolução e
 * aceitação públicas (o token JWT é a própria autorização), e o ciclo de
 * vida da conta criada (inativa até o Company Admin a ativar).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class InviteControllerTest {

    private static final String PASSWORD = "Kixima@123";
    private static final String COMPANY_ADMIN_EMAIL = "admin@petroangola.co.ao";
    private static final String COMPRADOR_EMAIL = "comprador@petroangola.co.ao";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PersistenceContext
    private EntityManager entityManager;

    private String login(String email) throws Exception {
        var res = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void cicloDeVidaCompletoDoConviteEDaContaCriada() throws Exception {
        String adminToken = login(COMPANY_ADMIN_EMAIL);
        String compradorToken = login(COMPRADOR_EMAIL);

        // Um perfil não convidável para uma empresa CLIENTE (FORNECEDOR é só para empresas fornecedoras).
        mockMvc.perform(post("/api/companies/invites")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("role", "FORNECEDOR", "name", "Alguém", "email", "alguem@exemplo.co.ao"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("BUSINESS_RULE_VIOLATION"));

        // Só o Company Admin convida.
        mockMvc.perform(post("/api/companies/invites")
                        .header("Authorization", "Bearer " + compradorToken)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("role", "COMPRADOR", "name", "Novo Comprador", "email", "novo.comprador@petroangola.co.ao"))))
                .andExpect(status().isForbidden());

        // Já existe conta com este email.
        mockMvc.perform(post("/api/companies/invites")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("role", "COMPRADOR", "name", "Duplicado", "email", COMPRADOR_EMAIL))))
                .andExpect(status().isConflict());

        // Criação normal.
        var criarRes = mockMvc.perform(post("/api/companies/invites")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("role", "COMPRADOR", "name", "Novo Comprador", "email", "novo.comprador@petroangola.co.ao"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDENTE"))
                .andExpect(jsonPath("$.companyName").value("Petro Angola Operações, Lda"))
                .andReturn();
        String inviteId = objectMapper.readTree(criarRes.getResponse().getContentAsString()).get("id").asText();
        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(get("/api/companies/invites").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + inviteId + "')].status").value("PENDENTE"));

        // O token nunca é devolvido pela API — lido diretamente da base, como o email faria.
        String token = jdbcTemplate.queryForObject("SELECT token FROM employee_invites WHERE id = ?", String.class, inviteId);

        // Resolução pública — sem sessão.
        mockMvc.perform(get("/api/companies/invite/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.companyName").value("Petro Angola Operações, Lda"))
                .andExpect(jsonPath("$.role").value("COMPRADOR"))
                .andExpect(jsonPath("$.name").value("Novo Comprador"));

        // Aceitar sem aceitar os Termos é rejeitado.
        mockMvc.perform(post("/api/companies/invite/" + token + "/accept")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("password", "SenhaForte@123"))))
                .andExpect(status().isUnprocessableEntity());

        // Aceitação — cria a conta, inativa (perfil COMPRADOR, não é convite de fundação).
        var aceitarRes = mockMvc.perform(post("/api/companies/invite/" + token + "/accept")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("password", "SenhaForte@123", "termsAccepted", true))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("novo.comprador@petroangola.co.ao"))
                .andExpect(jsonPath("$.role").value("COMPRADOR"))
                .andExpect(jsonPath("$.active").value(false))
                .andReturn();
        String novoUserId = objectMapper.readTree(aceitarRes.getResponse().getContentAsString()).get("id").asText();
        entityManager.flush();
        entityManager.clear();

        // Um segundo pedido com o mesmo token já não serve — o convite foi ACEITO.
        mockMvc.perform(post("/api/companies/invite/" + token + "/accept")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("password", "OutraSenha@123", "termsAccepted", true))))
                .andExpect(status().isBadRequest());

        // A conta ainda não pode entrar — está inativa (à espera de aprovação do Company Admin).
        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("email", "novo.comprador@petroangola.co.ao", "password", "SenhaForte@123"))))
                .andExpect(status().isForbidden());

        // O Company Admin ativa.
        mockMvc.perform(patch("/api/companies/users/" + novoUserId + "/activate").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true));
        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(get("/api/companies/users").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + novoUserId + "')].active").value(true));

        // Agora já entra.
        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("email", "novo.comprador@petroangola.co.ao", "password", "SenhaForte@123"))))
                .andExpect(status().isOk());

        // Bloquear — não pode bloquear a própria conta nem o Company Admin.
        mockMvc.perform(patch("/api/companies/users/" + novoUserId + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("active", false))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));

        // Remover.
        mockMvc.perform(delete("/api/companies/users/" + novoUserId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(novoUserId));
    }

    @Test
    void naoPodeRemoverOuBloquearOAdministradorDaEmpresaNemAPropriaConta() throws Exception {
        String adminToken = login(COMPANY_ADMIN_EMAIL);
        String adminId = objectMapper.readTree(
                        mockMvc.perform(get("/api/companies/users").header("Authorization", "Bearer " + adminToken))
                                .andReturn().getResponse().getContentAsString())
                .findValuesAsText("id").stream()
                .filter(id -> {
                    try {
                        return COMPANY_ADMIN_EMAIL.equals(jdbcTemplate.queryForObject(
                                "SELECT email FROM users WHERE id = ?", String.class, id));
                    } catch (Exception e) {
                        return false;
                    }
                }).findFirst().orElseThrow();

        mockMvc.perform(patch("/api/companies/users/" + adminId + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("active", false))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(delete("/api/companies/users/" + adminId).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }
}
