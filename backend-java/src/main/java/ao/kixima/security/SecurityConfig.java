package ao.kixima.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
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
    public SecurityFilterChain filterChain(HttpSecurity http, AuthenticationFilter authenticationFilter) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // API sem estado de sessão do lado do Spring; CSRF mitigado por SameSite=Lax no cookie (ver SessionCookieUtil).
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .addFilterBefore(authenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
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
