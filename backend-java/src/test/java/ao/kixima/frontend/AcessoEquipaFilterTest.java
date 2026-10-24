package ao.kixima.frontend;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.util.FileSystemUtils;
import org.springframework.web.servlet.HandlerExecutionChain;
import org.springframework.web.servlet.resource.ResourceHttpRequestHandler;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O acesso da equipa (espelha o describe "acesso da equipa" de backend/tests/lancamento.test.js):
 * a chave secreta grava um cookie que mostra a aplicação com o modo de lançamento ligado; sem
 * ela, ou com uma chave curta, o modo é estrito. Sem contexto Spring nem base de dados.
 */
class AcessoEquipaFilterTest {

    private static final String CHAVE = "chave-secreta-da-equipa-123456";
    private static final String APP = "<html><body>KIXIMA APP</body></html>";
    private static final String LANC = "<html><body>ESTAMOS A CHEGAR</body></html>";

    private static Path raiz;
    private static SpaHandlerMapping mapping;

    @BeforeAll
    static void preparar() throws Exception {
        raiz = Files.createTempDirectory("kixima-equipa-");
        Path dist = raiz.resolve("dist");
        Files.createDirectories(dist);
        Files.writeString(dist.resolve("index.html"), APP);
        Files.writeString(dist.resolve("launch.html"), LANC);
        Files.writeString(dist.resolve("launch.json"), "{\"enabled\": true}");
        mapping = new SpaHandlerMapping(new FrontendDist(dist.toString(), new MockEnvironment().withProperty("spring.profiles.active", "test")));
    }

    @AfterAll
    static void limpar() throws IOException {
        FileSystemUtils.deleteRecursively(raiz);
    }

    /** Passa pelo filtro; se ele deixar seguir, pelo mapeamento do SPA. */
    private record Resultado(MockHttpServletResponse resposta, String corpo) { }

    private static Resultado pedir(AcessoEquipaFilter filtro, String metodo, String uri, String query, Cookie cookie) throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest(metodo, uri);
        if (query != null) { req.setQueryString(query); for (String par : query.split("&")) { String[] kv = par.split("=", 2); req.addParameter(kv[0], kv.length > 1 ? kv[1] : ""); } }
        if (cookie != null) req.setCookies(cookie);
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filtro.doFilter(req, res, chain);
        if (chain.getRequest() == null) return new Resultado(res, res.getContentAsString()); // o filtro respondeu
        HandlerExecutionChain cadeia = mapping.getHandler(req);
        if (cadeia == null) return new Resultado(res, null);
        ((ResourceHttpRequestHandler) cadeia.getHandler()).handleRequest(req, res);
        return new Resultado(res, res.getContentAsString());
    }

    private static Cookie cookieDe(MockHttpServletResponse res) {
        String set = res.getHeader("Set-Cookie");
        assertThat(set).as("Set-Cookie").isNotNull();
        String[] kv = set.split(";")[0].split("=", 2);
        return new Cookie(kv[0], kv.length > 1 ? kv[1] : "");
    }

    @Test
    void chaveCertaGravaOCookieERedirecionaSemOParametro() throws Exception {
        AcessoEquipaFilter f = new AcessoEquipaFilter(CHAVE);
        Resultado r = pedir(f, "GET", "/login", "acesso=" + CHAVE + "&next=%2Fsistema", null);
        assertThat(r.resposta().getStatus()).isEqualTo(302);
        assertThat(r.resposta().getHeader("Location")).isEqualTo("/login?next=%2Fsistema");
        String set = r.resposta().getHeader("Set-Cookie");
        assertThat(set).contains("kixima_equipa=").contains("HttpOnly").contains("SameSite=Lax").contains("Path=/").contains("Max-Age=2592000");
        assertThat(set).doesNotContain(CHAVE);
        assertThat(r.resposta().getHeader("Cache-Control")).isEqualTo("no-store");
    }

    @Test
    void comOCookieAEquipaVeAAppEOLaunchJsonDizDesligado() throws Exception {
        AcessoEquipaFilter f = new AcessoEquipaFilter(CHAVE);
        Cookie cookie = cookieDe(pedir(f, "GET", "/login", "acesso=" + CHAVE, null).resposta());
        for (String p : new String[]{"/", "/index.html", "/login", "/cadastro", "/sistema/auditoria", "/comprador", "/nao-existe"}) {
            Resultado r = pedir(f, "GET", p, null, cookie);
            assertThat(r.corpo()).as(p).contains("KIXIMA APP").doesNotContain("ESTAMOS A CHEGAR");
        }
        Resultado j = pedir(f, "GET", "/launch.json", null, cookie);
        assertThat(j.corpo()).isEqualTo("{\"enabled\":false}");
        assertThat(j.resposta().getHeader("Cache-Control")).isEqualTo("no-store");
    }

    @Test
    void oPublicoSemCookieVeSoAPaginaEmBreveEOLaunchJsonVerdadeiro() throws Exception {
        AcessoEquipaFilter f = new AcessoEquipaFilter(CHAVE);
        for (String p : new String[]{"/", "/login", "/sistema", "/nao-existe"}) {
            assertThat(pedir(f, "GET", p, null, null).corpo()).as(p).contains("ESTAMOS A CHEGAR");
        }
        assertThat(pedir(f, "GET", "/launch.json", null, null).corpo()).contains("\"enabled\": true");
    }

    @Test
    void chaveErradaCookieFalsificadoOuDeOutraChaveNaoValem() throws Exception {
        AcessoEquipaFilter f = new AcessoEquipaFilter(CHAVE);
        for (String errada : new String[]{"", "x", CHAVE.substring(1), CHAVE + "x", CHAVE.toUpperCase()}) {
            Resultado r = pedir(f, "GET", "/login", "acesso=" + errada, null);
            assertThat(r.resposta().getStatus()).as(errada).isEqualTo(200);
            assertThat(r.resposta().getHeader("Set-Cookie")).as(errada).isNull();
            assertThat(r.corpo()).as(errada).contains("ESTAMOS A CHEGAR");
        }
        Cookie boa = cookieDe(pedir(f, "GET", "/", "acesso=" + CHAVE, null).resposta());
        for (Cookie c : new Cookie[]{new Cookie("kixima_equipa", "abc"), new Cookie("kixima_equipa", ""), new Cookie("kixima_equipa", boa.getValue().substring(1))}) {
            assertThat(pedir(f, "GET", "/login", null, c).corpo()).contains("ESTAMOS A CHEGAR");
        }
        AcessoEquipaFilter outra = new AcessoEquipaFilter("outra-chave-completamente-diferente");
        assertThat(pedir(outra, "GET", "/login", null, boa).corpo()).as("mudar a chave revoga").contains("ESTAMOS A CHEGAR");
    }

    @Test
    void sairApagaOCookie() throws Exception {
        AcessoEquipaFilter f = new AcessoEquipaFilter(CHAVE);
        Cookie cookie = cookieDe(pedir(f, "GET", "/", "acesso=" + CHAVE, null).resposta());
        Resultado r = pedir(f, "GET", "/sistema", "acesso=sair", cookie);
        assertThat(r.resposta().getStatus()).isEqualTo(302);
        assertThat(r.resposta().getHeader("Location")).isEqualTo("/sistema");
        assertThat(r.resposta().getHeader("Set-Cookie")).contains("kixima_equipa=;").contains("Max-Age=0");
    }

    @Test
    void semChaveOuComChaveCurtaOAcessoDaEquipaEstaDesligado() throws Exception {
        for (String chave : new String[]{"", null, "curta", "quinze-chars-ab"}) {
            AcessoEquipaFilter f = new AcessoEquipaFilter(chave);
            assertThat(f.ativo()).isFalse();
            Resultado r = pedir(f, "GET", "/login", "acesso=" + (chave == null || chave.isEmpty() ? "qualquer" : chave), null);
            assertThat(r.resposta().getHeader("Set-Cookie")).isNull();
            assertThat(r.corpo()).contains("ESTAMOS A CHEGAR");
        }
    }

    @Test
    void aApiEAsSondasNaoSaoTocadasNemOutrosMetodos() throws Exception {
        AcessoEquipaFilter f = new AcessoEquipaFilter(CHAVE);
        for (String p : new String[]{"/api/ping", "/health", "/ready", "/actuator/health", "/ws/x"}) {
            Resultado r = pedir(f, "GET", p, "acesso=" + CHAVE, null);
            assertThat(r.resposta().getHeader("Set-Cookie")).as(p).isNull();
            assertThat(r.corpo()).as(p).isNull(); // nem sequer é do SPA: segue para a API
        }
        assertThat(pedir(f, "POST", "/login", "acesso=" + CHAVE, null).resposta().getHeader("Set-Cookie")).isNull();
    }
}
