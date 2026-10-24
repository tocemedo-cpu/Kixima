package ao.kixima.frontend;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UriUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.regex.Pattern;

/**
 * O ACESSO DA EQUIPA ao site com o modo de lançamento ligado (espelha acessoEquipa em
 * backend/src/middleware/frontend.js).
 *
 * <p>Com a variável {@code LAUNCH_BYPASS_KEY} definida (segredo só no painel do Render; mínimo
 * {@value #CHAVE_MINIMA} caracteres), abrir qualquer página com {@code ?acesso=<chave>} grava o cookie
 * httpOnly {@code kixima_equipa} (30 dias; é o HMAC da chave, nunca a própria chave) e redirecciona
 * para o mesmo endereço sem o parâmetro. Com o cookie válido o {@link SpaHandlerMapping} serve a
 * aplicação normal, e o {@code /launch.json} responde {@code {"enabled": false}} só a essa pessoa
 * (é o que o SPA lê). {@code ?acesso=sair} apaga o cookie. Sem a variável, ou com uma chave curta,
 * está DESLIGADO e o modo é estrito para toda a gente. Mudar a chave invalida todos os cookies.
 *
 * <p>Corre antes do Spring Security e só em pedidos GET/HEAD de página (nunca {@code /api},
 * {@code /health}, {@code /ready}, …: o mesmo critério do {@link SpaHandlerMapping#eCaminhoDoSpa}).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class AcessoEquipaFilter extends OncePerRequestFilter {

    public static final String COOKIE = "kixima_equipa";
    public static final String PARAMETRO = "acesso";
    public static final String ATRIBUTO = AcessoEquipaFilter.class.getName() + ".ACESSO";
    static final int CHAVE_MINIMA = 16;

    private static final Pattern PARAMETRO_ACESSO = Pattern.compile("(^|&)" + PARAMETRO + "=[^&]*");

    private final String chave;
    private final String esperado;

    public AcessoEquipaFilter(@Value("${LAUNCH_BYPASS_KEY:}") String chave) {
        this.chave = chave == null ? "" : chave;
        this.esperado = ativo() ? token(this.chave) : null;
    }

    public boolean ativo() {
        return chave.length() >= CHAVE_MINIMA;
    }

    /** O pedido traz o cookie válido da equipa (marcado por este filtro). */
    public static boolean temAcesso(HttpServletRequest request) {
        return Boolean.TRUE.equals(request.getAttribute(ATRIBUTO));
    }

    static String token(String chave) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(chave.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal("kixima-equipa-v1".getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static boolean iguais(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!ativo() || !SpaHandlerMapping.eCaminhoDoSpa(request.getMethod(), request.getRequestURI())) {
            chain.doFilter(request, response);
            return;
        }

        String valor = request.getParameter(PARAMETRO);
        if (valor != null && (valor.equals("sair") || iguais(valor, chave))) {
            boolean sair = valor.equals("sair");
            ResponseCookie.ResponseCookieBuilder c = ResponseCookie.from(COOKIE, sair ? "" : esperado)
                    .httpOnly(true).secure(request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto")))
                    .sameSite("Lax").path("/").maxAge(sair ? Duration.ZERO : Duration.ofDays(30));
            response.addHeader("Set-Cookie", c.build().toString());
            response.setHeader("Cache-Control", "no-store");
            response.setStatus(HttpServletResponse.SC_FOUND);
            response.setHeader("Location", destino(request));
            return;
        }

        if (cookieValido(request)) {
            request.setAttribute(ATRIBUTO, Boolean.TRUE);
            // O interruptor que o SPA lê: para a equipa responde "desligado" (o ficheiro não muda).
            if ("/launch.json".equals(SpaHandlerMapping.normalizar(request.getRequestURI(), request.getContextPath()))) {
                response.setStatus(HttpServletResponse.SC_OK);
                response.setContentType("application/json;charset=UTF-8");
                response.setHeader("Cache-Control", "no-store");
                if (!"HEAD".equalsIgnoreCase(request.getMethod())) response.getWriter().write("{\"enabled\":false}");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private boolean cookieValido(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return false;
        for (Cookie c : cookies) {
            if (COOKIE.equals(c.getName()) && c.getValue() != null && iguais(c.getValue(), esperado)) return true;
        }
        return false;
    }

    /** O mesmo endereço sem o parâmetro {@code acesso}, mantendo o resto da query. */
    static String destino(HttpServletRequest request) {
        String caminho = SpaHandlerMapping.normalizar(request.getRequestURI(), request.getContextPath());
        String query = request.getQueryString();
        String resto = query == null ? "" : PARAMETRO_ACESSO.matcher(query).replaceAll("").replaceFirst("^&", "");
        String base = UriUtils.encodePath(caminho == null ? "/" : caminho, StandardCharsets.UTF_8);
        return resto.isEmpty() ? base : base + "?" + resto;
    }
}
