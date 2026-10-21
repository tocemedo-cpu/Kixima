package ao.kixima.frontend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicReference;

/**
 * O MODO DE LANÇAMENTO do lado do servidor (espelha backend/src/middleware/frontend.js).
 *
 * <p>Enquanto {@code <frontend/dist>/launch.json} (origem: {@code frontend/public/launch.json})
 * tiver {@code { "enabled": true }}, o {@link SpaHandlerMapping} devolve {@code launch.html}
 * — a página "Estamos a chegar… Brevemente!" estática, sem React — para QUALQUER pedido
 * de página, em vez da aplicação. A API, as sondas e o actuator nunca chegam aqui (são
 * caminhos reservados). Com {@code "enabled": false}, sem o ficheiro, com JSON inválido ou com
 * qualquer valor que não seja exactamente {@code true}, nada disto actua.
 *
 * <p>O ficheiro é relido quando muda (data de modificação + tamanho), sem reiniciar o processo.
 */
public final class ModoLancamento {

    private static final Logger log = LoggerFactory.getLogger(ModoLancamento.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    public static final String FICHEIRO_ESTADO = "launch.json";
    public static final String PAGINA = "launch.html";

    private record Leitura(String chave, boolean ligado) { }

    private final Path estado;
    private final Path pagina;
    private final AtomicReference<Leitura> cache = new AtomicReference<>(new Leitura(null, false));
    private volatile boolean avisou;

    public ModoLancamento(Path dist) {
        this.estado = dist.resolve(FICHEIRO_ESTADO);
        this.pagina = dist.resolve(PAGINA);
    }

    /** O interruptor: true só quando o ficheiro diz {@code "enabled": true} (booleano, não texto nem número). */
    public boolean ligado() {
        String chave;
        try {
            chave = Files.getLastModifiedTime(estado).toMillis() + ":" + Files.size(estado);
        } catch (IOException e) {
            cache.set(new Leitura(null, false));
            return false;
        }
        Leitura atual = cache.get();
        if (chave.equals(atual.chave())) return atual.ligado();
        boolean on = false;
        try {
            JsonNode no = JSON.readTree(Files.readAllBytes(estado));
            on = no != null && no.has("enabled") && no.get("enabled").isBoolean() && no.get("enabled").asBoolean();
        } catch (IOException | RuntimeException e) {
            on = false;
        }
        cache.set(new Leitura(chave, on));
        return on;
    }

    /**
     * Deve esta resposta ser a página de lançamento? Ligado E com launch.html no dist. Ligado
     * mas sem a página: avisa uma vez e devolve false (segue a app, e a guarda do SPA mostra a página).
     */
    public boolean aplicar() {
        if (!ligado()) return false;
        if (Files.isRegularFile(pagina)) return true;
        if (!avisou) {
            avisou = true;
            log.warn("[kixima] Modo de lançamento LIGADO mas falta launch.html no frontend/dist — a servir a app (a página de lançamento aparece pela guarda do SPA).");
        }
        return false;
    }

    /**
     * "Página" = o que o browser abre ao navegar: sem extensão ({@code /}, {@code /login},
     * {@code /sistema/auditoria}) ou {@code .html} ({@code /index.html}). Ficheiros com outra extensão
     * são recursos estáticos e seguem como sempre.
     */
    public static boolean ePagina(String caminho) {
        int barra = caminho.lastIndexOf('/');
        String ultimo = caminho.substring(barra + 1);
        int ponto = ultimo.lastIndexOf('.');
        if (ponto < 0 || ponto == ultimo.length() - 1) return true;
        String ext = ultimo.substring(ponto + 1);
        return ext.equalsIgnoreCase("html") || ext.equalsIgnoreCase("htm");
    }
}
