package ao.kixima.frontend;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.util.FileSystemUtils;
import org.springframework.web.servlet.HandlerExecutionChain;
import org.springframework.web.servlet.resource.ResourceHttpRequestHandler;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O modo de lançamento no servidor (espelha backend/tests/lancamento.test.js): com launch.json
 * {"enabled": true} QUALQUER pedido de página devolve launch.html — "/", "/index.html", /login,
 * dashboards, administração, rotas desconhecidas, maiúsculas, percent-encoding — e a API, as sondas e
 * os ficheiros não são tocados. Desligado (ou sem ficheiro, ou valor inválido) é o comportamento de
 * antes. Sem contexto Spring nem base de dados: constrói o SpaHandlerMapping sobre uma pasta temporária.
 */
class ModoLancamentoTest {

    private static final String APP = "<!doctype html><html><body>KIXIMA APP</body></html>";
    private static final String LANC = "<!doctype html><html><body>ESTAMOS A CHEGAR</body></html>";

    private static Path raiz;
    private static Path dist;
    private static SpaHandlerMapping mapping;
    private static long relogio = 0;

    @BeforeAll
    static void preparar() throws Exception {
        raiz = Files.createTempDirectory("kixima-lancamento-");
        dist = raiz.resolve("dist");
        Files.createDirectories(dist.resolve("assets"));
        Files.writeString(dist.resolve("index.html"), APP);
        Files.writeString(dist.resolve("launch.html"), LANC);
        Files.writeString(dist.resolve("assets").resolve("index-abc.js"), "console.log('app');");
        Files.writeString(dist.resolve("LOGO.txt"), "KIXIMA");
        mapping = new SpaHandlerMapping(new FrontendDist(dist.toString(), new MockEnvironment().withProperty("spring.profiles.active", "test")));
    }

    @AfterAll
    static void limpar() throws IOException {
        FileSystemUtils.deleteRecursively(raiz);
    }

    @BeforeEach
    void ligar() throws IOException {
        estado("{\"enabled\": true}");
    }

    /** Escreve o launch.json garantindo que a data de modificação muda (a resolução do sistema de ficheiros engana). */
    private static void estado(String json) throws IOException {
        Path f = dist.resolve("launch.json");
        Files.writeString(f, json);
        Files.setLastModifiedTime(f, FileTime.from(Instant.now().plusSeconds(2 * (++relogio))));
    }

    /** O corpo que o SPA devolveria, ou null quando o pedido nem é do SPA (API, sondas, outros métodos). */
    private static Resposta pedir(String metodo, String uri) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest(metodo, uri);
        HandlerExecutionChain cadeia = mapping.getHandler(req);
        if (cadeia == null) return null;
        MockHttpServletResponse res = new MockHttpServletResponse();
        ((ResourceHttpRequestHandler) cadeia.getHandler()).handleRequest(req, res);
        return new Resposta(res.getStatus(), res.getContentAsString(), res.getHeader("Cache-Control"));
    }

    private record Resposta(int estado, String corpo, String cache) { }

    @Test
    void ligadoQualquerPaginaEALancamento() throws Exception {
        String[] paginas = {"/", "/index.html", "/login", "/cadastro", "/register", "/recuperar/abc", "/comprador", "/comprador/catalogo",
                "/empresa/aprovacoes", "/fornecedor/faturas", "/financeiro/historico", "/sistema", "/sistema/auditoria",
                "/sistema/administradores", "/seguranca", "/planos", "/em-breve", "/institucional", "/launch.html", "/nao-existe",
                "/a/b/c/d", "/LOGIN", "/Sistema/Auditoria", "//login", "/login/", "/%6cogin", "/sistema;x=1",
                "/assets/velho-que-ja-nao-existe.js", "/foto-inexistente.png"};
        for (String p : paginas) {
            Resposta r = pedir("GET", p);
            assertThat(r).as(p).isNotNull();
            assertThat(r.estado()).as(p).isEqualTo(200);
            assertThat(r.corpo()).as(p).contains("ESTAMOS A CHEGAR").doesNotContain("KIXIMA APP");
            assertThat(r.cache()).as(p).isEqualTo("no-store");
        }
        assertThat(pedir("HEAD", "/login")).isNotNull();
    }

    @Test
    void apiSondasEOutrosMetodosNaoSaoTocados() throws Exception {
        for (String p : new String[]{"/api", "/api/ping", "/api/auth/login", "/api/inexistente", "/health", "/ready", "/actuator/health", "/ws/x", "/socket.io/?EIO=4", "/error", "/%61pi/auth/me"}) {
            assertThat(pedir("GET", p)).as(p).isNull();
        }
        // Só GET/HEAD: um POST a uma página não é do SPA.
        assertThat(pedir("POST", "/login")).isNull();
        assertThat(pedir("PUT", "/comprador/ordens")).isNull();
    }

    @Test
    void ficheirosEstaticosContinuamAServirSe() throws Exception {
        assertThat(pedir("GET", "/assets/index-abc.js").corpo()).contains("console.log('app')");
        assertThat(pedir("GET", "/LOGO.txt").corpo()).isEqualTo("KIXIMA");
        assertThat(pedir("GET", "/launch.json").corpo()).contains("\"enabled\": true");
    }

    @Test
    void desligadoOuInvalidoEComoAntes() throws Exception {
        for (String valor : new String[]{"{\"enabled\": false}", "{}", "{\"enabled\": \"true\"}", "{\"enabled\": 1}", "{ nao e json", ""}) {
            estado(valor);
            for (String p : new String[]{"/", "/index.html", "/login", "/sistema/auditoria", "/nao-existe", "/assets/velho.js"}) {
                Resposta r = pedir("GET", p);
                assertThat(r.corpo()).as(valor + " " + p).contains("KIXIMA APP").doesNotContain("ESTAMOS A CHEGAR");
            }
        }
        Files.delete(dist.resolve("launch.json"));
        assertThat(pedir("GET", "/login").corpo()).contains("KIXIMA APP");
    }

    @Test
    void reLeOFicheiroSemReiniciar() throws Exception {
        assertThat(pedir("GET", "/").corpo()).contains("ESTAMOS A CHEGAR");
        estado("{\"enabled\": false}");
        assertThat(pedir("GET", "/").corpo()).contains("KIXIMA APP");
        estado("{\"enabled\": true}");
        assertThat(pedir("GET", "/login").corpo()).contains("ESTAMOS A CHEGAR");
    }

    @Test
    void ligadoSemLaunchHtmlServeAApp() throws Exception {
        Path pagina = dist.resolve("launch.html");
        Path bak = dist.resolve("launch.html.bak");
        Files.move(pagina, bak);
        try {
            assertThat(pedir("GET", "/login").corpo()).contains("KIXIMA APP");
        } finally {
            Files.move(bak, pagina);
        }
    }

    @Test
    void ePaginaDistingueNavegacaoDeFicheiros() {
        for (String p : new String[]{"/", "/login", "/a/b", "/index.html", "/x.HTML", "/ponto.", "/sistema/auditoria"}) {
            assertThat(ModoLancamento.ePagina(p)).as(p).isTrue();
        }
        for (String p : new String[]{"/assets/a.js", "/img/x.png", "/LOGO.txt", "/launch.json", "/font.woff2"}) {
            assertThat(ModoLancamento.ePagina(p)).as(p).isFalse();
        }
    }
}
