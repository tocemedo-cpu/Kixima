package ao.kixima.frontend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.util.FileSystemUtils;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * O deploy de serviço único, do lado Java: com FRONTEND_DIST a apontar a uma
 * pasta com index.html, o mesmo processo serve os ficheiros do Vite e o
 * history fallback do SPA — e NADA disso toca no contrato da API: rota
 * desconhecida em /api continua a ser 404 ROUTE_NOT_FOUND em JSON, e as rotas
 * protegidas continuam a exigir sessão. A pasta é temporária e criada antes
 * do contexto (static), porque a propriedade tem de existir quando o bean
 * FrontendDist arranca.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SpaFallbackTest {

    private static final String INDEX = "<!doctype html><html><body><div id=\"root\">KIXIMA SPA</div></body></html>";
    private static final String SEGREDO = "fora da pasta do frontend";

    private static final Path RAIZ = criarPastaTemporaria();
    private static final Path DIST = RAIZ.resolve("dist");

    private static Path criarPastaTemporaria() {
        try {
            Path raiz = Files.createTempDirectory("kixima-frontend-dist-");
            Path dist = raiz.resolve("dist");
            Files.createDirectories(dist.resolve("assets"));
            Files.writeString(dist.resolve("index.html"), INDEX);
            Files.writeString(dist.resolve("assets").resolve("index-Bx7Qk2Lm.js"), "console.log('kixima');");
            Files.writeString(dist.resolve("assets").resolve("index-Bx7Qk2Lm.css"), "body{margin:0}");
            Files.writeString(dist.resolve("LOGO.txt"), "KIXIMA");
            // Fora de dist/: nunca pode ser servido, por mais ".." que o pedido traga.
            Files.writeString(raiz.resolve("segredo.txt"), SEGREDO);
            return raiz;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @DynamicPropertySource
    static void frontendDist(DynamicPropertyRegistry registry) {
        registry.add("kixima.frontend-dist", DIST::toString);
    }

    @AfterAll
    static void apagarPastaTemporaria() throws IOException {
        FileSystemUtils.deleteRecursively(RAIZ);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void paginasPublicasEProtegidasDoSpaDevolvemOIndexSemSessao() throws Exception {
        for (String pagina : new String[]{"/", "/login", "/cadastro", "/comprador/ordens", "/admin/prontidao", "/rota/que/nao/existe"}) {
            mockMvc.perform(get(pagina))
                    .andExpect(status().isOk())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                    .andExpect(content().string(INDEX))
                    // Um deploy novo tem de chegar ao browser no pedido seguinte.
                    .andExpect(header().string("Cache-Control", "no-cache"))
                    // Os cabeçalhos do helmet/CSP cobrem também as páginas, como no Node.
                    .andExpect(header().exists("Content-Security-Policy"))
                    .andExpect(header().string("X-Content-Type-Options", "nosniff"));
        }
        mockMvc.perform(head("/login")).andExpect(status().isOk());
    }

    @Test
    void ficheirosEstaticosComTipoCertoECacheLongaSoNosAssetsComHash() throws Exception {
        mockMvc.perform(get("/assets/index-Bx7Qk2Lm.js"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/javascript"))
                .andExpect(content().string("console.log('kixima');"))
                .andExpect(header().string("Cache-Control", containsString("max-age=31536000")))
                .andExpect(header().string("Cache-Control", containsString("immutable")));
        mockMvc.perform(get("/assets/index-Bx7Qk2Lm.css"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/css"));
        // Os outros ficheiros (imagens, vídeos, modelos) seguem a omissão do express.static.
        mockMvc.perform(get("/LOGO.txt"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_PLAIN))
                .andExpect(content().string("KIXIMA"))
                .andExpect(header().string("Cache-Control", containsString("max-age=0")));
        // Um asset que já não existe (deploy novo, browser com HTML antigo) cai no fallback, como no Node.
        mockMvc.perform(get("/assets/index-antigo.js"))
                .andExpect(status().isOk())
                .andExpect(content().string(INDEX));
    }

    @Test
    void oContratoDaApiNaoMuda() throws Exception {
        String token = login();
        // Com sessão, uma rota desconhecida em /api é o mesmo 404 JSON de sempre — nunca HTML.
        mockMvc.perform(get("/api/inexistente").header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error.code").value("ROUTE_NOT_FOUND"))
                .andExpect(jsonPath("$.error.message").value("Rota GET /api/inexistente não existe."));
        mockMvc.perform(get("/api").header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("ROUTE_NOT_FOUND"));
        // Sem sessão, /api continua a ser 401 ANTES de se saber se a rota existe (como hoje):
        // o SPA ser público não abre a API, nem sequer para descobrir rotas.
        for (String protegida : new String[]{"/api/auth/me", "/api/inexistente", "/api"}) {
            mockMvc.perform(get(protegida))
                    .andExpect(status().isUnauthorized())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
        }
        // Um caminho disfarçado nunca passa por página: o ";" é recusado logo pelo
        // StrictHttpFirewall do Spring Security (400) e o percent-encoding é
        // normalizado antes de se decidir que é do SPA (401 como qualquer /api sem sessão).
        for (String disfarcado : new String[]{"/api;x/auth/me", "/%61pi/auth/me", "/%2Fapi/auth/me"}) {
            var res = mockMvc.perform(get(disfarcado)).andReturn().getResponse();
            assertThat(res.getStatus()).as(disfarcado).isIn(400, 401);
            assertThat(res.getContentAsString()).as(disfarcado).doesNotContain("KIXIMA SPA");
        }
        // As sondas continuam a ser JSON, não HTML.
        mockMvc.perform(get("/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void caminhosReservadosEOutrosMetodosNaoTemFallback() throws Exception {
        String token = login();
        // O socket.io só existe no Node; um cliente antigo recebe um 404 claro, não HTML
        // (e sem sessão o 401 de sempre — o caminho é reservado, não é página).
        mockMvc.perform(get("/socket.io/?EIO=4&transport=polling").header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("ROUTE_NOT_FOUND"));
        mockMvc.perform(get("/socket.io/?EIO=4&transport=polling")).andExpect(status().isUnauthorized());
        // /ws/** é público (a autenticação é no CONNECT STOMP) mas não é do SPA.
        mockMvc.perform(get("/ws/qualquer-coisa"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("ROUTE_NOT_FOUND"));
        // Só GET/HEAD: um POST a uma rota de navegação é uma rota que não existe —
        // e, como qualquer rota não pública, sem sessão é 401 antes disso.
        mockMvc.perform(post("/comprador/ordens").header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.error.code").value("ROUTE_NOT_FOUND"))
                .andExpect(jsonPath("$.error.message").value("Rota POST /comprador/ordens não existe."));
        mockMvc.perform(put("/login").header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        mockMvc.perform(post("/comprador/ordens")).andExpect(status().isUnauthorized());
    }

    /** Sessão de uma persona semeada (prisma/seed.demo.js), como nos outros testes de controller. */
    private String login() throws Exception {
        var res = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "comprador@petroangola.co.ao", "password", "Kixima@123"))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    void nuncaSaiDaPastaDoFrontend() throws Exception {
        for (String tentativa : new String[]{"/../segredo.txt", "/assets/../../segredo.txt", "/%2e%2e/segredo.txt", "/..%2fsegredo.txt"}) {
            var res = mockMvc.perform(get(tentativa)).andReturn().getResponse();
            assertThat(res.getContentAsString()).as(tentativa).doesNotContain(SEGREDO);
        }
        // Ficheiros escondidos também não (dotfiles: 'ignore' do express.static).
        Files.writeString(DIST.resolve(".env"), "SEGREDO=1");
        mockMvc.perform(get("/.env")).andExpect(status().isOk()).andExpect(content().string(INDEX));
    }
}
