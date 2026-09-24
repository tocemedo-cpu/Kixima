package ao.kixima.security;

import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Caminhos que NÃO passam por {@link AuthenticationFilter} — espelha, rota a
 * rota, quais têm `authenticate` composto no Node (a maioria) e quais não
 * (login, forgot/reset-password, 2fa/verify, 2fa/reenviar — ver
 * authRoutes.js). Cada marco (M2+) acrescenta aqui os caminhos públicos do
 * seu próprio domínio à medida que os controllers são portados — nunca ao
 * contrário: por omissão, um caminho novo é PROTEGIDO, tal como no Node um
 * router novo exige `authenticate` a menos que se decida o oposto
 * explicitamente.
 */
@Component
public class PublicPaths {

    private final Set<String> exatos = ConcurrentHashMap.newKeySet();
    private final AntPathMatcher matcher = new AntPathMatcher();

    public PublicPaths() {
        // authRoutes.js — só estas cinco rotas não têm `authenticate`.
        exatos.add("/api/auth/login");
        exatos.add("/api/auth/forgot-password");
        exatos.add("/api/auth/reset-password");
        exatos.add("/api/auth/2fa/verify");
        exatos.add("/api/auth/2fa/reenviar");
        exatos.add("/actuator/health");
        // uploadsRoutes.js — `optionalAuthenticate`, não `authenticate`: o mesmo
        // filtro que decide "público" também popula CurrentUserHolder quando um
        // token válido vem no pedido (só os ramos de token AUSENTE/INVÁLIDO é que
        // seguem sem utilizador) — por isso marcar como público aqui já reproduz
        // "autenticação opcional", sem precisar de um segundo modo no filtro.
        exatos.add("/api/uploads/*");
        // companyRoutes.js — resolução/aceitação de convite são públicas: o
        // token assinado (ver InviteController/InviteService) é a própria
        // autorização, tal como authenticate não está composto nestas duas
        // rotas no Node.
        exatos.add("/api/companies/invite/*");
        exatos.add("/api/companies/invite/*/accept");
    }

    public void adicionar(String pathPattern) {
        exatos.add(pathPattern);
    }

    public boolean ePublico(String path) {
        return exatos.stream().anyMatch(p -> matcher.match(p, path));
    }
}
