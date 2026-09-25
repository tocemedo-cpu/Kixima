package ao.kixima.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * A camada do Spring Security fica deliberadamente permissiva
 * (`anyRequest().permitAll()`) — toda a decisão de acesso real vive em
 * {@link AuthenticationFilter} (autenticação) e {@link RbacAspect}
 * (autorização por perfil), tal como no Node essa lógica vive inteiramente
 * em middleware próprio (auth.js/rbac.js), não num framework de terceiros.
 * O Spring Security aqui só dá o BCryptPasswordEncoder e o encaixe do
 * filtro na cadeia — não a fonte de verdade do acesso.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /** Custo 12 — mesmo SALT_ROUNDS de bcryptjs em authService.js. Hashes de custo 10 (antigos) continuam a verificar. */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, AuthenticationFilter authenticationFilter,
                                           RateLimitFilter rateLimitFilter, ContentSecurityPolicy csp) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // API sem estado de sessão do lado do Spring; CSRF mitigado por SameSite=Lax no cookie (ver SessionCookieUtil).
                .headers(headers -> cabecalhosDoHelmet(headers, csp))
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .addFilterBefore(authenticationFilter, UsernamePasswordAuthenticationFilter.class)
                // Como no app.js: os limitadores correm ANTES da autenticação (e contam à pessoa quando o token é válido).
                .addFilterBefore(rateLimitFilter, AuthenticationFilter.class);
        return http.build();
    }

    /**
     * Espelha `app.use(helmet({...}))` em app.js: os cabeçalhos que o helmet
     * 7.2.0 (versão resolvida em backend/package-lock.json) emite por omissão,
     * com os mesmos valores literais, mais as duas alterações do Node —
     * Cross-Origin-Resource-Policy "cross-origin" (as imagens têm de poder
     * ser servidas ao frontend noutra porta) e a CSP de config/csp.js.
     *
     * Os cabeçalhos por omissão do Spring Security (Cache-Control/Pragma/
     * Expires, HSTS só em HTTPS, X-Frame-Options DENY) desligam-se de
     * propósito: o Node não os emite, e o HSTS do helmet sai em TODAS as
     * respostas, não só nas seguras.
     */
    private static void cabecalhosDoHelmet(HeadersConfigurer<HttpSecurity> headers, ContentSecurityPolicy csp) {
        headers.defaultsDisabled()
                .contentSecurityPolicy(politica -> politica.policyDirectives(csp.cabecalho()))
                .addHeaderWriter(new StaticHeadersWriter("Cross-Origin-Opener-Policy", "same-origin"))
                .addHeaderWriter(new StaticHeadersWriter("Cross-Origin-Resource-Policy", "cross-origin"))
                .addHeaderWriter(new StaticHeadersWriter("Origin-Agent-Cluster", "?1"))
                .addHeaderWriter(new StaticHeadersWriter("Referrer-Policy", "no-referrer"))
                .addHeaderWriter(new StaticHeadersWriter("Strict-Transport-Security", "max-age=15552000; includeSubDomains"))
                .addHeaderWriter(new StaticHeadersWriter("X-Content-Type-Options", "nosniff"))
                .addHeaderWriter(new StaticHeadersWriter("X-DNS-Prefetch-Control", "off"))
                .addHeaderWriter(new StaticHeadersWriter("X-Download-Options", "noopen"))
                .addHeaderWriter(new StaticHeadersWriter("X-Frame-Options", "SAMEORIGIN"))
                .addHeaderWriter(new StaticHeadersWriter("X-Permitted-Cross-Domain-Policies", "none"))
                .addHeaderWriter(new StaticHeadersWriter("X-XSS-Protection", "0"));
    }

    /** Espelha backend/src/config/cors.js — origem da app + origens fixas do Capacitor + CORS_ORIGINS. */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("https://localhost", "capacitor://localhost"));
        config.setAllowedOriginPatterns(List.of("*")); // TODO (M2+): restringir com kixima.cors.origins tal como allowList() em cors.js.
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
