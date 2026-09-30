package ao.kixima.frontend;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;

/**
 * Onde está o frontend compilado (Vite → {@code frontend/dist}) que este
 * processo serve na mesma origem que a API — o deploy de serviço único do
 * Node (app.js, {@code resolveFrontendDist}), agora em Java, para o M8 trocar
 * o backend SEM mudar a topologia: um contentor, {@code /api} e o SPA na
 * mesma origem, sem CORS nem proxy.
 *
 * <p>Só a variável {@code FRONTEND_DIST} ({@code kixima.frontend-dist}) conta.
 * O Node ainda procura {@code frontend/dist} a subir pastas a partir do
 * ficheiro e do cwd, para sobreviver a um "Root Directory" mal configurado no
 * painel; aqui o Dockerfile fixa a variável na imagem, e uma procura
 * automática faria a suite de testes depender de haver ou não um build do
 * frontend na máquina de quem a corre. Sem a variável (ou com um caminho sem
 * {@code index.html}) fica só a API, com o mesmo aviso que o Node dá.
 */
@Component
public class FrontendDist {

    private static final Logger log = LoggerFactory.getLogger(FrontendDist.class);

    public static final String INDEX = "index.html";

    private final Path dir;

    public FrontendDist(@Value("${kixima.frontend-dist:}") String configurado, Environment env) {
        this.dir = resolver(configurado);
        boolean teste = env.acceptsProfiles(Profiles.of("test"));
        if (teste) return; // como `!config.isTest` no app.js: os testes não poluem o log com isto
        if (dir != null) {
            log.info("[kixima] A servir o frontend (SPA) a partir de: {}", dir);
        } else {
            log.warn("[kixima] Frontend compilado não encontrado — apenas a API responde.\n"
                            + "[kixima] user.dir = {}\n"
                            + "[kixima] FRONTEND_DIST = {}",
                    System.getProperty("user.dir"),
                    configurado == null || configurado.isBlank() ? "(não definido)" : configurado + " (sem " + INDEX + ")");
        }
    }

    /** A pasta real (sem symlinks) quando tem um {@code index.html}; null caso contrário. */
    static Path resolver(String configurado) {
        if (configurado == null || configurado.isBlank()) return null;
        try {
            Path p = Path.of(configurado.trim()).toAbsolutePath().normalize();
            if (!Files.isRegularFile(p.resolve(INDEX))) return null;
            return p.toRealPath();
        } catch (IOException | InvalidPathException e) {
            return null;
        }
    }

    public boolean disponivel() {
        return dir != null;
    }

    /** A pasta do frontend compilado; só faz sentido quando {@link #disponivel()}. */
    public Path dir() {
        return dir;
    }

    /**
     * O ficheiro regular que corresponde a um caminho relativo já descodificado
     * (sem "/" inicial), ou null quando não existe, é uma pasta, sai da pasta do
     * frontend ou tem um segmento escondido — {@code dotfiles: 'ignore'}, a
     * omissão do {@code express.static}. Quem chama trata null como "não há
     * ficheiro estático" e cai no {@code index.html}.
     */
    public Path ficheiro(String relativo) {
        if (dir == null || relativo == null || relativo.isEmpty() || relativo.indexOf('\0') >= 0) return null;
        for (String segmento : relativo.split("/")) {
            if (segmento.startsWith(".")) return null;
        }
        try {
            Path alvo = dir.resolve(relativo).normalize();
            if (!alvo.startsWith(dir) || !Files.isRegularFile(alvo)) return null;
            return alvo;
        } catch (InvalidPathException e) {
            return null;
        }
    }
}
