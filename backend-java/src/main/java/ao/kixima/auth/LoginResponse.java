package ao.kixima.auth;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Optional;

/**
 * Espelha as duas formas devolvidas por authService.login()/verify2fa():
 * um desafio de 2FA ({@code requires2fa=true}) ou uma sessão completa
 * ({@code token} + {@code user}). Os campos da outra forma não saem no JSON
 * (Java {@code null} → chave ausente), tal como os dois objectos JS distintos
 * que o Node devolve. {@code mfaPrazo} é a excepção: na sessão sai SEMPRE,
 * a {@code null} quando MFA_ENFORCE_FROM não está definido
 * ({@code mfa.prazo} = {@code config.auth.mfaEnforceFrom} = null) — daí o
 * {@link Optional}: {@code Optional.empty()} → {@code "mfaPrazo": null}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LoginResponse(
        Boolean requires2fa, String metodo, String challenge, Boolean sent,
        String token, Boolean mfaPendente, Boolean mfaRestrita, Optional<Instant> mfaPrazo,
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
        return new LoginResponse(null, null, null, null, token, mfaPendente, mfaRestrita, Optional.ofNullable(mfaPrazo), user);
    }
}
