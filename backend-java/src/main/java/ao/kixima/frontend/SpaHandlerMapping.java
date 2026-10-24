package ao.kixima.frontend;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.Ordered;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.handler.AbstractHandlerMapping;
import org.springframework.web.servlet.resource.ResourceHttpRequestHandler;
import org.springframework.web.util.UriUtils;
import org.springframework.web.util.UrlPathHelper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Espelha as duas linhas finais do app.js do Node no deploy de serviço único:
 * <pre>
 *   app.use(express.static(frontendDist));
 *   app.get(/^(?!\/api\/).*&#47;, (req, res) => res.sendFile('index.html'));   // history fallback
 * </pre>
 *
 * <p>É um {@link HandlerMapping} com a precedência MAIS BAIXA de todas — o
 * DispatcherServlet só o consulta depois de nenhum controller ({@code /api},
 * {@code /health}, {@code /ready}), do WebSocket ({@code /ws}) e do actuator
 * terem reclamado o pedido. E recusa-se ({@code null}) em dois casos, para o
 * pedido seguir para {@code NoHandlerFoundException} → 404 {@code ROUTE_NOT_FOUND}
 * exactamente como hoje (GlobalExceptionHandler):
 * <ul>
 *   <li>qualquer método que não GET/HEAD — o fallback é só para navegação;</li>
 *   <li>qualquer caminho reservado ({@link #RESERVADOS}) — um {@code /api/inexistente}
 *       nunca recebe HTML, e {@code /socket.io} (que só existe no Node) também não.</li>
 * </ul>
 *
 * <p>Não se liga {@code spring.web.resources.add-mappings}: o handler de
 * recursos global apanharia {@code /api/inexistente} e devolveria a sua própria
 * resposta em vez do envelope JSON. Servir os ficheiros fica a cargo de três
 * {@link ResourceHttpRequestHandler} (tipo de conteúdo, Last-Modified/304,
 * Range para os vídeos), que só diferem no Cache-Control:
 * {@code /assets/*} (nomes com hash do Vite) um ano e imutável; os outros
 * ficheiros {@code max-age=0} como o {@code express.static}; e o
 * {@code index.html} {@code no-cache}, para um deploy novo chegar ao browser
 * no pedido seguinte.
 */
@Component
public class SpaHandlerMapping extends AbstractHandlerMapping {

    /**
     * Prefixos que NUNCA são do SPA, mesmo sem handler: a API e o WebSocket do
     * Java, as sondas, o actuator, e o {@code /socket.io} do Node (o cliente
     * antigo não deve receber HTML em vez de um erro claro).
     */
    static final List<String> RESERVADOS = List.of("/api", "/ws", "/socket.io", "/health", "/ready", "/actuator", "/error");

    private static final String ASSETS = "assets/";

    private final FrontendDist frontendDist;
    private final ResourceHttpRequestHandler assets;
    private final ResourceHttpRequestHandler estaticos;
    private final ResourceHttpRequestHandler index;

    public SpaHandlerMapping(FrontendDist frontendDist) throws Exception {
        this.frontendDist = frontendDist;
        setOrder(Ordered.LOWEST_PRECEDENCE);
        if (frontendDist.disponivel()) {
            // A barra final é obrigatória: sem ela, createRelative() substitui o último segmento em vez de entrar na pasta.
            Resource raiz = new FileSystemResource(frontendDist.dir().toString() + "/");
            this.assets = handler(raiz, CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());
            this.estaticos = handler(raiz, CacheControl.maxAge(Duration.ZERO).cachePublic());
            this.index = handler(raiz, CacheControl.noCache());
        } else {
            this.assets = null;
            this.estaticos = null;
            this.index = null;
        }
    }

    private static ResourceHttpRequestHandler handler(Resource raiz, CacheControl cache) throws Exception {
        ResourceHttpRequestHandler h = new ResourceHttpRequestHandler();
        h.setLocations(List.of(raiz));
        h.setCacheControl(cache);
        // Tipos que faltam na tabela mime.types do Spring e que um build do Vite pode trazer.
        h.setMediaTypes(Map.of(
                "woff2", new MediaType("font", "woff2"),
                "woff", new MediaType("font", "woff"),
                "mjs", new MediaType("application", "javascript"),
                "webmanifest", new MediaType("application", "manifest+json")));
        h.afterPropertiesSet();
        return h;
    }

    @Override
    protected Object getHandlerInternal(HttpServletRequest request) {
        if (index == null) return null; // sem FRONTEND_DIST: só a API, como hoje
        String caminho = normalizar(request.getRequestURI(), request.getContextPath());
        if (caminho == null || !eCaminhoDoSpa(request.getMethod(), caminho)) return null;

        String relativo = caminho.substring(1);
        Path ficheiro = frontendDist.ficheiro(relativo);
        if (ficheiro != null) {
            request.setAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE, relativo);
            return relativo.startsWith(ASSETS) ? assets : estaticos;
        }
        // History fallback: qualquer outra rota de navegação é a app (React Router decide lá dentro).
        request.setAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE, FrontendDist.INDEX);
        return index;
    }

    /**
     * É um pedido que pertence ao SPA (uma página ou um ficheiro estático) e
     * por isso fica FORA da autenticação, tal como no Node o
     * {@code express.static} e o fallback nunca passam por {@code authenticate}?
     * Só GET/HEAD, e nunca um caminho reservado. O caminho é normalizado aqui
     * (parâmetros ";", percent-encoding, "." e "..") para {@code /api;x/auth/me}
     * ou {@code /%61pi/auth/me} não passarem por página quando o MVC os vai
     * tratar como {@code /api/auth/me}.
     */
    public static boolean eCaminhoDoSpa(String metodo, String uri) {
        if (!"GET".equalsIgnoreCase(metodo) && !"HEAD".equalsIgnoreCase(metodo)) return false;
        String caminho = normalizar(uri, "");
        if (caminho == null) return false;
        for (String reservado : RESERVADOS) {
            if (caminho.equals(reservado) || caminho.startsWith(reservado + "/")) return false;
        }
        return true;
    }

    /**
     * O caminho tal como o MVC o vai interpretar: sem o context path, sem
     * conteúdo ";...", percent-descodificado, sem "//" nem "./"/"../"
     * (segmentos ".." que não têm para onde subir ficam, e {@link FrontendDist#ficheiro}
     * recusa-os). Null quando a codificação é inválida — quem chama trata
     * isso como "não é do SPA".
     */
    static String normalizar(String uri, String contextPath) {
        if (uri == null) return null;
        String caminho = uri;
        if (contextPath != null && !contextPath.isEmpty() && caminho.startsWith(contextPath)) {
            caminho = caminho.substring(contextPath.length());
        }
        caminho = UrlPathHelper.defaultInstance.removeSemicolonContent(caminho);
        try {
            caminho = UriUtils.decode(caminho, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (caminho.indexOf('\0') >= 0) return null;
        caminho = StringUtils.cleanPath(caminho).replaceAll("/{2,}", "/");
        return caminho.startsWith("/") ? caminho : "/" + caminho;
    }
}
