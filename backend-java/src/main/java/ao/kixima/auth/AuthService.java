package ao.kixima.auth;

import ao.kixima.common.error.ConflictException;
import ao.kixima.common.error.ForbiddenException;
import ao.kixima.common.error.ServiceUnavailableException;
import ao.kixima.common.error.UnauthorizedException;
import ao.kixima.common.error.ValidationException;
import ao.kixima.company.Company;
import ao.kixima.company.CompanyStatus;
import ao.kixima.security.JwtService;
import ao.kixima.security.MfaPolicyService;
import ao.kixima.security.TotpService;
import ao.kixima.user.LoginAttemptService;
import ao.kixima.user.PasswordPolicy;
import ao.kixima.user.User;
import ao.kixima.user.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Espelha backend/src/services/authService.js. O que NÃO está aqui ainda
 * (pendente M5, quando mfaEmailService/notificationService forem portados):
 * envio real de código por EMAIL (ativação, login 2FA por email, reenvio) e
 * envio do email de recuperação de senha — esses pontos lançam
 * {@link ServiceUnavailableException} em vez de fingir sucesso, mesmo
 * princípio "recusa-se a fingir" já usado no Node para o Multicaixa/AGT. O
 * método TOTP (app de autenticação) está completo de ponta a ponta.
 */
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final LoginAttemptService loginAttemptService;
    private final MfaPolicyService mfaPolicyService;
    private final PasswordPolicy passwordPolicy;
    private final TotpService totpService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
                        LoginAttemptService loginAttemptService, MfaPolicyService mfaPolicyService,
                        PasswordPolicy passwordPolicy, TotpService totpService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.loginAttemptService = loginAttemptService;
        this.mfaPolicyService = mfaPolicyService;
        this.passwordPolicy = passwordPolicy;
        this.totpService = totpService;
    }

    @Transactional
    public LoginResponse login(String email, String password) {
        User user = userRepository.findByEmailWithCompany(email).orElse(null);
        if (user == null) {
            throw new UnauthorizedException("Credenciais inválidas.");
        }

        // Verificado ANTES da comparação de senha — o bcrypt é caro de propósito.
        loginAttemptService.assertNaoBloqueado(user);

        if (!user.isActive()) {
            throw new ForbiddenException("A sua conta ainda aguarda aprovação do administrador da empresa.");
        }
        Company company = user.getCompany();
        if (company != null && company.getStatus() != CompanyStatus.APROVADA) {
            throw new ForbiddenException("A empresa ainda não foi aprovada no cadastro (due diligence).");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            loginAttemptService.registarFalha(user);
            throw new UnauthorizedException("Credenciais inválidas.");
        }
        loginAttemptService.limpar(user);

        if (user.getTotpEnabledAt() != null) {
            String challenge = jwtService.sign2faChallenge(user.getId(), user.getTokenVersion());
            String metodo = user.getMfaMethod() != null ? user.getMfaMethod() : "TOTP";
            if (!"EMAIL".equals(metodo)) {
                return LoginResponse.desafio(metodo, challenge);
            }
            throw new ServiceUnavailableException(
                    "Este backend ainda não envia códigos de 2FA por email (pendente M5). "
                            + "Use a app de autenticação ou entre pelo backend actual.");
        }

        return buildSession(user);
    }

    private LoginResponse buildSession(User user) {
        MfaPolicyService.Estado mfa = mfaPolicyService.estadoPara(user);
        String token = jwtService.signAccessToken(user.getId(), user.getRole(), user.getCompanyId(), user.getTokenVersion());
        Company company = user.getCompany();
        UserSessionDto dto = new UserSessionDto(
                user.getId(), user.getName(), user.getEmail(), user.getRole(), user.getAdminAreas(),
                user.getCompanyId(), company == null ? null : company.getName(),
                company == null ? null : company.getType(), user.getAvatarUrl());
        return LoginResponse.sessao(token, mfa.pendente(), mfa.restrita(), mfa.prazo(), dto);
    }

    @Transactional
    public void changePassword(String userId, String currentPassword, String newPassword) {
        User user = userRepository.findById(userId).orElseThrow(() -> new UnauthorizedException("Sessão inválida."));
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new UnauthorizedException("A senha atual está incorreta.");
        }
        String erro = passwordPolicy.validar(newPassword, user.getRole(), user.getEmail());
        if (erro != null) throw new ValidationException(erro);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setTokenVersion(user.getTokenVersion() + 1);
    }

    /** Logout global — revoga todas as sessões activas (incrementa tokenVersion). */
    @Transactional
    public void revokeSessions(String userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new UnauthorizedException("Sessão inválida."));
        user.setTokenVersion(user.getTokenVersion() + 1);
    }

    public record ResetRequested(boolean sent) {
    }

    /**
     * NUNCA revela se o email existe — devolve `sent=false` tanto se a
     * conta não existe como, por agora, sempre que existir (o envio real
     * de email ainda não foi portado, M5). O controller (ver
     * AuthController.forgotPassword) já ignora este valor e devolve
     * sempre a mesma resposta anti-enumeração ao cliente, tal como o Node.
     */
    @Transactional(readOnly = true)
    public ResetRequested requestPasswordReset(String email) {
        User user = userRepository.findByEmail(email == null ? "" : email.trim().toLowerCase()).orElse(null);
        if (user == null || !user.isActive()) return new ResetRequested(false);
        String token = jwtService.signPasswordReset(user.getId(), user.getTokenVersion());
        // TODO (M5): notificationService.sendEmail — ver javadoc da classe.
        org.slf4j.LoggerFactory.getLogger(AuthService.class)
                .info("(pendente M5) enviaria email de recuperação a {} com token de reset", user.getEmail());
        return new ResetRequested(false);
    }

    public record ResetResult(String userId, String email) {
    }

    @Transactional
    public ResetResult resetPassword(String token, String newPassword) {
        User user = verifyPasswordReset(token);
        String erro = passwordPolicy.validar(newPassword, user.getRole(), user.getEmail());
        if (erro != null) throw new ValidationException(erro);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setTokenVersion(user.getTokenVersion() + 1);
        return new ResetResult(user.getId(), user.getEmail());
    }

    private User verifyPasswordReset(String token) {
        Claims claims;
        try {
            claims = jwtService.verifyRaw(token);
        } catch (JwtException | IllegalArgumentException e) {
            throw new UnauthorizedException("Link de recuperação inválido ou expirado. Peça um novo.");
        }
        if (!"pwreset".equals(claims.get("t")) || claims.getSubject() == null) {
            throw new UnauthorizedException("Link de recuperação inválido.");
        }
        User user = userRepository.findById(claims.getSubject()).orElse(null);
        Integer tv = claims.get("tv", Integer.class);
        if (user == null || user.getTokenVersion() != (tv == null ? 0 : tv)) {
            throw new UnauthorizedException("Este link de recuperação já foi utilizado ou expirou. Peça um novo.");
        }
        return user;
    }

    // --- 2FA (TOTP) ----------------------------------------------------

    public record TotpStatus(boolean enabled, Instant enabledAt, String metodo, String emailIndisponivel, String email) {
    }

    @Transactional(readOnly = true)
    public TotpStatus totpStatus(String userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new UnauthorizedException("Sessão inválida."));
        boolean enabled = user.getTotpEnabledAt() != null;
        return new TotpStatus(enabled, user.getTotpEnabledAt(), enabled ? (user.getMfaMethod() != null ? user.getMfaMethod() : "TOTP") : null,
                "Autenticação por código de email ainda não foi portada para este backend (pendente M5).",
                mascarar(user.getEmail()));
    }

    private String mascarar(String email) {
        if (email == null) return null;
        String[] parts = email.split("@", 2);
        if (parts.length != 2) return "";
        String nome = parts[0];
        String visivel = nome.length() <= 2
                ? (nome.isEmpty() ? "" : nome.substring(0, 1))
                : nome.charAt(0) + "*".repeat(Math.min(nome.length() - 2, 4)) + nome.charAt(nome.length() - 1);
        return visivel + "@" + parts[1];
    }

    public record TotpSetup(String secret, String otpauthUrl) {
    }

    @Transactional
    public TotpSetup setupTotp(String userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new UnauthorizedException("Sessão inválida."));
        if (user.getTotpEnabledAt() != null) throw new ConflictException("A verificação em dois passos já está ativa.");
        String secret = totpService.generateSecret();
        user.setTotpSecret(secret);
        user.setTotpEnabledAt(null);
        return new TotpSetup(secret, totpService.otpauthUrl(secret, user.getEmail()));
    }

    public record TotpEnableResult(boolean enabled, Instant enabledAt, String metodo) {
    }

    @Transactional
    public TotpEnableResult enableTotp(String userId, String code) {
        User user = userRepository.findById(userId).orElseThrow(() -> new UnauthorizedException("Sessão inválida."));
        if (user.getTotpEnabledAt() != null) throw new ConflictException("A verificação em dois passos já está ativa.");
        if (user.getMfaCodeHash() != null) {
            throw new ServiceUnavailableException("Ativação por código de email ainda não foi portada para este backend (pendente M5).");
        }
        if (user.getTotpSecret() == null) {
            throw new ConflictException("Inicie primeiro a ativação (pedir o código por email ou gerar o código QR).");
        }
        if (!totpService.verify(code, user.getTotpSecret())) {
            throw new UnauthorizedException(totpService.explicarFalha(code, user.getTotpSecret()));
        }
        Instant now = Instant.now();
        user.setTotpEnabledAt(now);
        user.setMfaMethod("TOTP");
        return new TotpEnableResult(true, now, "TOTP");
    }

    public record TotpDisableResult(boolean enabled) {
    }

    @Transactional
    public TotpDisableResult disableTotp(String userId, String code) {
        User user = userRepository.findById(userId).orElseThrow(() -> new UnauthorizedException("Sessão inválida."));
        if (user.getTotpEnabledAt() == null) throw new ConflictException("A verificação em dois passos não está ativa.");
        confirmarSegundoFator(user, code);
        user.setTotpSecret(null);
        user.setTotpEnabledAt(null);
        user.setMfaMethod(null);
        user.setMfaCodeHash(null);
        user.setMfaCodeExpiraEm(null);
        return new TotpDisableResult(false);
    }

    /** Espelha confirmarSegundoFator() — lança em vez de devolver a razão, os chamadores tratam por excepção. */
    private void confirmarSegundoFator(User user, String code) {
        String metodo = user.getMfaMethod() != null ? user.getMfaMethod() : "TOTP";
        if ("EMAIL".equals(metodo)) {
            throw new ServiceUnavailableException("Confirmação por código de email ainda não foi portada para este backend (pendente M5).");
        }
        if (!totpService.verify(code, user.getTotpSecret())) {
            throw new UnauthorizedException(totpService.explicarFalha(code, user.getTotpSecret()));
        }
    }

    @Transactional
    public LoginResponse verify2fa(String challenge, String code) {
        User user = utilizadorDoDesafio(challenge);
        if (user.getTotpEnabledAt() == null) {
            throw new UnauthorizedException("Esta conta não tem verificação em dois passos. Volte a iniciar sessão.");
        }
        confirmarSegundoFator(user, code);
        return buildSession(user);
    }

    private User utilizadorDoDesafio(String challenge) {
        Claims claims;
        try {
            claims = jwtService.verifyRaw(challenge);
        } catch (JwtException | IllegalArgumentException e) {
            throw new UnauthorizedException("Desafio expirado — volte a iniciar sessão.");
        }
        if (!"2fa".equals(claims.get("t")) || claims.getSubject() == null) {
            throw new UnauthorizedException("Desafio inválido — volte a iniciar sessão.");
        }
        User user = userRepository.findByIdWithCompany(claims.getSubject()).orElse(null);
        Integer tv = claims.get("tv", Integer.class);
        if (user == null || !user.isActive() || user.getTokenVersion() != (tv == null ? 0 : tv)) {
            throw new UnauthorizedException("Sessão inválida — volte a iniciar sessão.");
        }
        return user;
    }

    /** Espelha reenviarCodigoDoDesafio()/reenviarCodigo() — sempre pendente M5 (dependem do envio real de email). */
    @Transactional(readOnly = true)
    public void reenviarCodigoDoDesafio(String challenge) {
        User user = utilizadorDoDesafio(challenge);
        reenviarCodigo(user);
    }

    @Transactional(readOnly = true)
    public void reenviarCodigo(String userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new UnauthorizedException("Sessão inválida."));
        reenviarCodigo(user);
    }

    private void reenviarCodigo(User user) {
        String metodo = user.getMfaMethod() != null ? user.getMfaMethod() : "TOTP";
        if (!"EMAIL".equals(metodo)) {
            throw new ConflictException("Esta conta usa a app de autenticação — o código é gerado no telemóvel.");
        }
        throw new ServiceUnavailableException("Reenvio de código por email ainda não foi portado para este backend (pendente M5).");
    }

    @Transactional
    public void enviarCodigoAtivacao(String userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new UnauthorizedException("Sessão inválida."));
        if (user.getTotpEnabledAt() != null) throw new ConflictException("A verificação em dois passos já está ativa.");
        throw new ServiceUnavailableException("Ativação por código de email ainda não foi portada para este backend (pendente M5).");
    }
}
