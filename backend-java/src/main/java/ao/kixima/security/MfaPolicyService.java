package ao.kixima.security;

import ao.kixima.user.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Espelha backend/src/services/mfaPolicy.js — quem é obrigado a ter 2FA e a
 * partir de quando. Não se pode barrar o login de quem ainda não a
 * configurou (configurá-la exige estar dentro); a sessão fica RESTRITA em
 * vez de recusada.
 */
@Service
public class MfaPolicyService {

    private static final List<Pattern> PERMITIDOS = List.of(
            Pattern.compile("^/api/auth/(me|logout|2fa/.*)$"),
            Pattern.compile("^/api/users/profile$"),
            Pattern.compile("^/api/notifications(/|$)")
    );

    private final List<String> mfaRequiredRoles;
    private final Instant mfaEnforceFrom;

    public MfaPolicyService(@Value("${kixima.auth.mfa-required-roles:ADMIN_SISTEMA,COMPANY_ADMIN}") String mfaRequiredRoles,
                             @Value("${kixima.auth.mfa-enforce-from:}") String mfaEnforceFrom) {
        this.mfaRequiredRoles = List.of(mfaRequiredRoles.toUpperCase().split("\\s*,\\s*"));
        Instant parsed;
        try {
            parsed = (mfaEnforceFrom == null || mfaEnforceFrom.isBlank()) ? null : Instant.parse(mfaEnforceFrom);
        } catch (Exception e) {
            parsed = null; // data mal escrita = nunca exige, tal como o Node (dataInvalida em env.js).
        }
        this.mfaEnforceFrom = parsed;
    }

    public boolean exigeMfa(PersonaRole role) {
        return role != null && mfaRequiredRoles.contains(role.name());
    }

    public boolean prazoEsgotado(Instant agora) {
        return mfaEnforceFrom != null && !agora.isBefore(mfaEnforceFrom);
    }

    public record Estado(boolean pendente, boolean restrita, Instant prazo) {
    }

    public Estado estadoPara(User user) {
        return estadoPara(user, Instant.now());
    }

    public Estado estadoPara(User user, Instant agora) {
        boolean pendente = exigeMfa(user.getRole()) && user.getTotpEnabledAt() == null;
        return new Estado(pendente, pendente && prazoEsgotado(agora), mfaEnforceFrom);
    }

    public boolean caminhoPermitido(String caminho) {
        return PERMITIDOS.stream().anyMatch(p -> p.matcher(caminho).find());
    }
}
