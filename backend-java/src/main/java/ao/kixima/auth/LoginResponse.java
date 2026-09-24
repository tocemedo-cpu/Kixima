package ao.kixima.auth;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;

/**
 * Espelha as duas formas devolvidas por authService.login()/verify2fa():
 * um desafio de 2FA ({@code requires2fa=true}) ou uma sessão completa
 * ({@code token} + {@code user}). Campos ausentes não saem no JSON
 * (`@JsonInclude(NON_NULL)`), tal como os dois objectos JS distintos que o
 * Node devolve.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LoginResponse(
        Boolean requires2fa, String metodo, String challenge, Boolean sent,
        String token, Boolean mfaPendente, Boolean mfaRestrita, Instant mfaPrazo,
        UserSessionDto user
) {
    public static LoginResponse desafio(String metodo, String challenge) {
        return new LoginResponse(true, metodo, challenge, null, null, null, null, null, null);
    }

    public static LoginResponse desafioComEnvio(String metodo, String challenge, boolean sent) {
        return new LoginResponse(true, metodo, challenge, sent, null, null, null, null, null);
    }

    public static LoginResponse sessao(String token, boolean mfaPendente, boolean mfaRestrita,
                                        Instant mfaPrazo, UserSessionDto user) {
        return new LoginResponse(null, null, null, null, token, mfaPendente, mfaRestrita, mfaPrazo, user);
    }
}
