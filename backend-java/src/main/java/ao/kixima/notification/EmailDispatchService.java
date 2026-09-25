package ao.kixima.notification;

import ao.kixima.common.error.BadGatewayException;
import ao.kixima.common.error.ValidationException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Espelha o essencial de backend/src/services/notificationService.js
 * (dispatchEmail/sendViaBrevoApi) — envio de email plugável por
 * {@code EMAIL_PROVIDER}. 'console' só regista no log (comportamento por
 * omissão, sem nenhuma credencial). 'brevo'/'brevo-api' chama a API HTTP do
 * Brevo (porta 443). NÃO PORTADO: provider 'smtp' (precisaria de uma
 * dependência JavaMail nova no pom.xml) — cai no mesmo aviso "provider
 * desconhecido" que o Node dá para um provider não reconhecido, nunca
 * bloqueia quem chama (mesmo princípio de "uma falha de envio é registada
 * e o pedido segue").
 */
@Service
public class EmailDispatchService {

    private static final Logger log = LoggerFactory.getLogger(EmailDispatchService.class);
    private static final Pattern FROM_PATTERN = Pattern.compile("^\\s*(.*?)\\s*<\\s*([^>]+)\\s*>\\s*$");

    private final String provider;
    private final String from;
    private final String brevoApiKey;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();

    public EmailDispatchService(@Value("${kixima.email.provider:console}") String provider,
                                 @Value("${kixima.email.from:notificacoes@kixima.co.ao}") String from,
                                 @Value("${kixima.email.brevo-api-key:}") String brevoApiKey,
                                 ObjectMapper objectMapper) {
        this.provider = provider;
        this.from = from;
        this.brevoApiKey = brevoApiKey;
        this.objectMapper = objectMapper;
    }

    private record Remetente(String nome, String email) {
    }

    private Remetente parseFrom(String from) {
        Matcher m = FROM_PATTERN.matcher(from == null ? "" : from);
        if (m.matches()) {
            String nome = m.group(1);
            return new Remetente(nome == null || nome.isBlank() ? null : nome, m.group(2));
        }
        String limpo = from == null ? "" : from.trim();
        return new Remetente(null, limpo.isBlank() ? null : limpo);
    }

    private void enviarViaBrevoApi(String to, String subject, String body) throws IOException, InterruptedException {
        Remetente remetente = parseFrom(from);
        Map<String, Object> sender = new LinkedHashMap<>();
        if (remetente.nome() != null) sender.put("name", remetente.nome());
        sender.put("email", remetente.email());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sender", sender);
        payload.put("to", List.of(Map.of("email", to)));
        payload.put("subject", subject);
        payload.put("textContent", body);

        String corpo;
        try {
            corpo = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("Falha a serializar pedido Brevo.", e);
        }

        HttpRequest req = HttpRequest.newBuilder(URI.create("https://api.brevo.com/v3/smtp/email"))
                .timeout(Duration.ofSeconds(20))
                .header("api-key", brevoApiKey == null ? "" : brevoApiKey)
                .header("content-type", "application/json")
                .header("accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(corpo, StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            String detalhe = resp.body() == null ? "" : resp.body().substring(0, Math.min(200, resp.body().length()));
            throw new IllegalStateException("Brevo API " + resp.statusCode() + ": " + detalhe);
        }
    }

    /**
     * Espelha `!config.email.apenasLog && !config.email.missing.length` —
     * usado por alertaOperacionalService para não tentar um envio que se
     * sabe à partida que não vai a lado nenhum (provider 'console', ou um
     * provider real sem as credenciais que precisa).
     */
    public String provider() {
        return provider;
    }

    public String from() {
        return from;
    }

    /** Espelha `config.email.apenasLog` — 'console' não é um provider a sério: escreve no log e segue. */
    public boolean apenasLog() {
        return "console".equals(provider);
    }

    /** Espelha `config.email.missing` — nomes das variáveis em falta para o provider configurado (nunca valores). */
    public List<String> emFalta() {
        if ("brevo".equals(provider) || "brevo-api".equals(provider)) {
            return brevoApiKey == null || brevoApiKey.isBlank() ? List.of("BREVO_API_KEY") : List.of();
        }
        return List.of();
    }

    public record EnvioDireto(String provider, String para, String remetente) {
    }

    /**
     * Espelha notificationService.enviarEmailDireto — o ÚNICO caminho em que o
     * erro NÃO é engolido: quem está a configurar o email precisa de ver o que
     * correu mal, e a mensagem crua do Brevo é a que diz o que corrigir.
     */
    public EnvioDireto enviarDireto(String to, String assunto, String corpo) {
        if (apenasLog()) {
            throw new ValidationException("EMAIL_PROVIDER=console — nada é enviado. Defina EMAIL_PROVIDER=brevo e BREVO_API_KEY.");
        }
        List<String> falta = emFalta();
        if (!falta.isEmpty()) {
            throw new ValidationException("Faltam variáveis de email: " + String.join(", ", falta) + ".");
        }
        if ("brevo".equals(provider) || "brevo-api".equals(provider)) {
            try {
                enviarViaBrevoApi(to, assunto, corpo);
            } catch (Exception e) {
                throw new BadGatewayException(e.getMessage() == null ? "Falha no envio de email." : e.getMessage());
            }
            return new EnvioDireto("brevo", to, from);
        }
        // 'smtp' ainda não portado (ver javadoc da classe) — recusa-se a fingir que enviou.
        throw new ValidationException("EMAIL_PROVIDER \"" + provider + "\" não está suportado neste servidor. Use brevo.");
    }

    /** Email de teste da página de Prontidão — confirma a configuração de ponta a ponta. */
    public EnvioDireto enviarEmailDeTeste(String to) {
        return enviarDireto(to, "KIXIMA — teste de configuração de email",
                "Se está a ler isto, o envio de email da plataforma KIXIMA está a funcionar.\n\n"
                        + "Este email foi enviado a partir de Configurações e Suporte → Prontidão para produção.");
    }

    public boolean configurado() {
        if ("brevo".equals(provider) || "brevo-api".equals(provider)) return !brevoApiKey.isBlank();
        return false;
    }

    /** Nunca lança — uma falha de envio é registada e quem chama continua. */
    public void dispatch(String to, String subject, String body) {
        if ("console".equals(provider) || to == null || to.isBlank()) {
            log.info("Email (modo console) para={} assunto={}", to, subject);
            return;
        }
        if ("brevo".equals(provider) || "brevo-api".equals(provider)) {
            try {
                enviarViaBrevoApi(to, subject, body);
                log.info("Email enviado (Brevo API) para={} assunto={}", to, subject);
            } catch (Exception err) {
                log.error("Falha no envio de email (Brevo API) para={} assunto={}: {}", to, subject, err.getMessage());
            }
            return;
        }
        log.warn("Email não enviado — EMAIL_PROVIDER \"{}\" desconhecido/não portado para Java (M5+) para={} assunto={}",
                provider, to, subject);
    }
}
