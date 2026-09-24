package ao.kixima.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Teste de paridade de contrato para o troço de tickets/chat de
 * supportRoutes.js/supportChatService.js: criação → listagem própria →
 * listagem admin (enriquecida) → assumir → mensagem com anexo → acesso ao
 * anexo (dono vs. estranho) → resposta do cliente → marcar lidas →
 * resolver/reabrir.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SupportControllerTest {

    private static final String PASSWORD = "Kixima@123";
    private static final String COMPRADOR_EMAIL = "comprador@petroangola.co.ao";
    private static final String FINANCEIRO_EMAIL = "financeiro@petroangola.co.ao";
    private static final String ADMIN_SISTEMA_EMAIL = "admin@kixima.co.ao";

    // Assinatura PNG real (8 bytes) + preenchimento — suficiente para passar FileSignature.verificar.
    private static final byte[] PNG_BYTES = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    };

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String login(String email) throws Exception {
        var res = mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void fluxoCompletoDeTicketEChatComAnexo() throws Exception {
        String compradorToken = login(COMPRADOR_EMAIL);
        String financeiroToken = login(FINANCEIRO_EMAIL);
        String adminToken = login(ADMIN_SISTEMA_EMAIL);

        // 1. Cliente cria o pedido.
        var createRes = mockMvc.perform(post("/api/support/tickets")
                        .header("Authorization", "Bearer " + compradorToken)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of(
                                "subject", "Dúvida sobre faturação", "category", "Faturação", "message", "Como funciona a faturação garantida?"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ABERTO"))
                .andExpect(jsonPath("$.reference").value(org.hamcrest.Matchers.matchesPattern("SUP-\\d{4}-\\d{5}")))
                .andReturn();
        String ticketId = objectMapper.readTree(createRes.getResponse().getContentAsString()).get("id").asText();

        // 2. Aparece na listagem própria do cliente.
        mockMvc.perform(get("/api/support/tickets").header("Authorization", "Bearer " + compradorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + ticketId + "')]").exists());

        // 3. Listagem admin, enriquecida com autor/empresa.
        var adminListRes = mockMvc.perform(get("/api/support/admin/tickets").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode adminList = objectMapper.readTree(adminListRes.getResponse().getContentAsString());
        JsonNode noAdminList = null;
        for (JsonNode t : adminList) if (ticketId.equals(t.get("id").asText())) noAdminList = t;
        assertTrue(noAdminList != null, "O ticket devia aparecer na listagem admin.");
        assertEquals("Ana Comprador", noAdminList.get("user").get("name").asText());
        assertEquals("Petro Angola Operações, Lda", noAdminList.get("company").asText());

        // Um utilizador que não é dono nem gere Suporte não vê o detalhe (404, não 403).
        mockMvc.perform(get("/api/support/tickets/" + ticketId).header("Authorization", "Bearer " + financeiroToken))
                .andExpect(status().isNotFound());

        // 4. Admin assume o ticket.
        mockMvc.perform(post("/api/support/admin/tickets/" + ticketId + "/assume").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EM_ANDAMENTO"));

        // 5. Admin responde com um anexo — o pedido passa a aguardar o cliente.
        var msgRes = mockMvc.perform(multipart("/api/support/tickets/" + ticketId + "/messages")
                        .file(new MockMultipartFile("attachment", "captura.png", "image/png", PNG_BYTES))
                        .param("body", "Pode explicar melhor o que não ficou claro?")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.attachmentUrl").isString())
                .andReturn();
        String attachmentUrl = objectMapper.readTree(msgRes.getResponse().getContentAsString()).get("attachmentUrl").asText();
        String attachmentFilename = attachmentUrl.substring(attachmentUrl.lastIndexOf('/') + 1);

        mockMvc.perform(get("/api/support/tickets/" + ticketId).header("Authorization", "Bearer " + compradorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AGUARDANDO_RESPOSTA"))
                .andExpect(jsonPath("$.statusLabel").value("Aguardando Cliente"));

        // 6. O DONO do ticket consegue ver o anexo. (charset=UTF-8 vem do
        // server.servlet.encoding.force=true, global à aplicação — ver M1;
        // inofensivo para uma imagem, os browsers ignoram-no aqui.)
        mockMvc.perform(get("/api/uploads/" + attachmentFilename).header("Authorization", "Bearer " + compradorToken))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().stringValues("Content-Type", "image/png;charset=UTF-8"));

        // 7. Um estranho (não dono, não admin) NÃO consegue — 404, não 403 (não confirma a existência).
        mockMvc.perform(get("/api/uploads/" + attachmentFilename).header("Authorization", "Bearer " + financeiroToken))
                .andExpect(status().isNotFound());

        // 8. Sem sessão nenhuma, o anexo privado pede 401.
        mockMvc.perform(get("/api/uploads/" + attachmentFilename)).andExpect(status().isUnauthorized());

        // 9. Cliente responde — volta para EM_ANDAMENTO.
        mockMvc.perform(multipart("/api/support/tickets/" + ticketId + "/messages")
                        .param("body", "Sim, a dúvida é sobre o prazo de pagamento.")
                        .header("Authorization", "Bearer " + compradorToken))
                .andExpect(status().isCreated());
        mockMvc.perform(get("/api/support/tickets/" + ticketId).header("Authorization", "Bearer " + compradorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EM_ANDAMENTO"));

        // 10. Marcar como lidas + contador.
        mockMvc.perform(post("/api/support/tickets/" + ticketId + "/read").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(true));

        // 11. Resolver e reabrir, com auditoria.
        mockMvc.perform(post("/api/support/admin/tickets/" + ticketId + "/resolve").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RESOLVIDO"));
        mockMvc.perform(post("/api/support/admin/tickets/" + ticketId + "/reopen").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EM_ANDAMENTO"));

        var auditRes = mockMvc.perform(get("/api/admin/audit-logs").header("Authorization", "Bearer " + adminToken)
                        .param("action", "SUPORTE_TICKET_RESOLVIDO"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode auditBody = objectMapper.readTree(auditRes.getResponse().getContentAsString());
        boolean auditoriaEncontrada = false;
        for (JsonNode item : auditBody.get("items")) {
            if (ticketId.equals(item.get("entityId").asText(null))) auditoriaEncontrada = true;
        }
        assertTrue(auditoriaEncontrada, "SUPORTE_TICKET_RESOLVIDO devia ter ficado no trilho de auditoria.");
    }

    @Test
    void rejeitaTicketSemAssuntoOuMensagem() throws Exception {
        String token = login(COMPRADOR_EMAIL);
        mockMvc.perform(post("/api/support/tickets")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("subject", "", "message", ""))))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void agenteNaoAdminNaoAcedeAoPainel() throws Exception {
        String token = login(COMPRADOR_EMAIL);
        mockMvc.perform(get("/api/support/admin/queue").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }
}
