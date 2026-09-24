package ao.kixima.notification;

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
