package ao.kixima.frontend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Sem FRONTEND_DIST (o contexto partilhado pelos outros testes não a define)
 * o comportamento é o de hoje: só a API responde, e qualquer rota de
 * navegação é uma rota que não existe — em JSON, como o notFoundHandler do Node
 * quando não encontra o frontend compilado.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SemFrontendDistTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FrontendDist frontendDist;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void semFrontendCompiladoSoAApiResponde() throws Exception {
        assertThat(frontendDist.disponivel()).isFalse();
        // Rotas de navegação: 404 JSON, sem exigir sessão (como o notFoundHandler do Node).
        for (String caminho : new String[]{"/", "/login", "/comprador/ordens"}) {
            mockMvc.perform(get(caminho))
                    .andExpect(status().isNotFound())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.error.code").value("ROUTE_NOT_FOUND"))
                    .andExpect(jsonPath("$.error.message").value("Rota GET " + caminho + " não existe."));
        }
        // /api: 401 sem sessão (como hoje) e 404 ROUTE_NOT_FOUND com sessão.
        mockMvc.perform(get("/api/inexistente")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/inexistente").header("Authorization", "Bearer " + login()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("ROUTE_NOT_FOUND"))
                .andExpect(jsonPath("$.error.message").value("Rota GET /api/inexistente não existe."));
    }

    private String login() throws Exception {
        var res = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "comprador@petroangola.co.ao", "password", "Kixima@123"))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void umCaminhoSemIndexHtmlContaComoAusente() {
        assertThat(FrontendDist.resolver("")).isNull();
        assertThat(FrontendDist.resolver("/pasta/que/nao/existe")).isNull();
        assertThat(FrontendDist.resolver(System.getProperty("java.io.tmpdir"))).as("pasta sem index.html").isNull();
    }
}
