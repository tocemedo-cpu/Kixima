package ao.kixima.config;

import org.apache.commons.logging.Log;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.config.ConfigDataEnvironmentPostProcessor;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.boot.logging.DeferredLogFactory;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Aceita a {@code DATABASE_URL} do Node tal e qual — uma connection string
 * libpq ({@code postgresql://user:pass@host:porta/base?sslmode=require}) — e
 * deriva dela o que o Spring espera em três propriedades
 * ({@code spring.datasource.url/username/password}). É o que permite ao
 * serviço Java do M8 correr com o MESMO conjunto de variáveis que o serviço
 * Node no painel do Render (render.yaml), sem duplicar segredos em dois
 * formatos.
 *
 * <p>Precedência: {@code DATABASE_URL_JDBC} (com {@code DATABASE_USER}/
 * {@code DATABASE_PASSWORD}) continua a ganhar quando está definida — aí este
 * processador não faz nada. E no perfil {@code test} nunca deriva: a suite
 * corre sempre contra a base local de application-test.yml, tal como já
 * ignora a {@code DATABASE_URL_JDBC}; uma {@code DATABASE_URL} exportada na
 * shell de quem corre {@code mvn test} não pode apontar os testes à produção.
 *
 * <p>Os parâmetros da query passam para o JDBC tal e qual ({@code sslmode},
 * {@code options}, ...), excepto os que são do Prisma e não do PostgreSQL:
 * {@code pgbouncer=true} vira {@code prepareThreshold=0} (o pooler do Supabase
 * em modo transação não suporta prepared statements com nome — é o mesmo
 * efeito que o Prisma lhe dá); {@code schema} vira {@code currentSchema};
 * {@code connect_timeout}/{@code socket_timeout}/{@code application_name}
 * viram os nomes camelCase do pgjdbc; {@code connection_limit},
 * {@code pool_timeout} e {@code sslaccept} caem (o pool aqui é o Hikari, com
 * {@code DB_POOL_MAX}). Cada decisão fica no log de arranque.
 *
 * <p>Registado em META-INF/spring.factories. O log é adiado
 * ({@link DeferredLogFactory}) porque o sistema de logging ainda não existe
 * quando isto corre.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    static final String NOME_DA_FONTE = "kiximaDatabaseUrl";
    static final String VARIAVEL = "DATABASE_URL";
    static final String VARIAVEL_JDBC = "DATABASE_URL_JDBC";

    /** Parâmetros do Prisma sem equivalente útil no pgjdbc — caem, com aviso. */
    private static final List<String> IGNORADOS = List.of("connection_limit", "pool_timeout", "sslaccept");
    /** Parâmetros do Prisma com nome diferente no pgjdbc. */
    private static final Map<String, String> RENOMEADOS = Map.of(
            "schema", "currentSchema",
            "connect_timeout", "connectTimeout",
            "socket_timeout", "socketTimeout",
            "application_name", "ApplicationName");

    /** O resultado da tradução: o URL JDBC, as credenciais (já descodificadas) e o que se decidiu sobre a query. */
    public record Derivada(String jdbcUrl, String username, String password, List<String> avisos) {
    }

    private final Log log;

    public DatabaseUrlEnvironmentPostProcessor(DeferredLogFactory logFactory) {
        this.log = logFactory.getLog(DatabaseUrlEnvironmentPostProcessor.class);
    }

    @Override
    public int getOrder() {
        // Depois dos ficheiros application*.yml e dos perfis estarem carregados.
        return ConfigDataEnvironmentPostProcessor.ORDER + 1;
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (temValor(environment.getProperty(VARIAVEL_JDBC))) return; // a forma JDBC explícita ganha sempre
        String url = environment.getProperty(VARIAVEL);
        if (!temValor(url)) return;
        if (Arrays.asList(environment.getActiveProfiles()).contains("test")) {
            log.info(VARIAVEL + " ignorada no perfil test — a suite usa sempre a base local de application-test.yml.");
            return;
        }

        Derivada d;
        try {
            d = derivar(url);
        } catch (IllegalArgumentException e) {
            log.warn(VARIAVEL + " não é uma connection string PostgreSQL válida (" + e.getMessage()
                    + ") — fica ignorada; defina " + VARIAVEL_JDBC + " ou corrija-a.");
            return;
        }

        Map<String, Object> props = new LinkedHashMap<>();
        props.put("spring.datasource.url", d.jdbcUrl());
        if (d.username() != null) props.put("spring.datasource.username", d.username());
        if (d.password() != null) props.put("spring.datasource.password", d.password());

        // Acima dos application*.yml (para substituir o valor por omissão de lá) e abaixo das
        // variáveis de ambiente/propriedades de sistema (um SPRING_DATASOURCE_URL explícito ganha).
        MutablePropertySources fontes = environment.getPropertySources();
        MapPropertySource fonte = new MapPropertySource(NOME_DA_FONTE, props);
        if (fontes.contains(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME)) {
            fontes.addAfter(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME, fonte);
        } else {
            fontes.addFirst(fonte);
        }
        log.info(VARIAVEL + " → spring.datasource.url=" + d.jdbcUrl()
                + (d.username() != null ? " (utilizador " + d.username() + ")" : " (sem credenciais no URL)"));
        for (String aviso : d.avisos()) log.info(VARIAVEL + ": " + aviso);
    }

    private static boolean temValor(String v) {
        return v != null && !v.isBlank();
    }

    /**
     * {@code postgres[ql]://[user[:pass]@]host[:porta][/base][?query]} → JDBC.
     * Utilizador e senha são percent-descodificados (uma senha do Supabase
     * com {@code @} ou {@code /} vem codificada no URL); base e valores da
     * query ficam como estão porque o próprio pgjdbc os descodifica.
     *
     * @throws IllegalArgumentException quando não é um URL PostgreSQL utilizável
     */
    public static Derivada derivar(String databaseUrl) {
        String s = databaseUrl == null ? "" : databaseUrl.trim();
        int esquema = s.indexOf("://");
        if (esquema < 0) throw new IllegalArgumentException("sem esquema postgresql://");
        String scheme = s.substring(0, esquema).toLowerCase(Locale.ROOT);
        if (!scheme.equals("postgresql") && !scheme.equals("postgres")) {
            throw new IllegalArgumentException("esquema \"" + scheme + "\" não é postgresql");
        }
        String resto = s.substring(esquema + 3);

        String query = null;
        int q = resto.indexOf('?');
        if (q >= 0) {
            query = resto.substring(q + 1);
            resto = resto.substring(0, q);
        }
        String base = "";
        int barra = resto.indexOf('/');
        if (barra >= 0) {
            base = resto.substring(barra + 1);
            resto = resto.substring(0, barra);
        }
        String userinfo = null;
        int arroba = resto.lastIndexOf('@');
        if (arroba >= 0) {
            userinfo = resto.substring(0, arroba);
            resto = resto.substring(arroba + 1);
        }

        String host;
        String porta = null;
        if (resto.startsWith("[")) { // IPv6 literal
            int fim = resto.indexOf(']');
            if (fim < 0) throw new IllegalArgumentException("endereço IPv6 sem \"]\"");
            host = resto.substring(0, fim + 1);
            String depois = resto.substring(fim + 1);
            if (depois.startsWith(":")) porta = depois.substring(1);
        } else {
            int dp = resto.lastIndexOf(':');
            if (dp >= 0) {
                host = resto.substring(0, dp);
                porta = resto.substring(dp + 1);
            } else {
                host = resto;
            }
        }
        if (host.isEmpty()) throw new IllegalArgumentException("sem anfitrião");
        if (porta != null && (porta.isEmpty() || !porta.chars().allMatch(Character::isDigit))) {
            throw new IllegalArgumentException("porta \"" + porta + "\" inválida");
        }

        String username = null;
        String password = null;
        if (userinfo != null) {
            int dp = userinfo.indexOf(':');
            username = descodificar(dp >= 0 ? userinfo.substring(0, dp) : userinfo);
            password = dp >= 0 ? descodificar(userinfo.substring(dp + 1)) : "";
        }

        List<String> avisos = new ArrayList<>();
        List<String> parametros = traduzirQuery(query, avisos);

        StringBuilder jdbc = new StringBuilder("jdbc:postgresql://").append(host);
        if (porta != null) jdbc.append(':').append(porta);
        jdbc.append('/').append(base);
        if (!parametros.isEmpty()) jdbc.append('?').append(String.join("&", parametros));
        return new Derivada(jdbc.toString(), username, password, List.copyOf(avisos));
    }

    private static List<String> traduzirQuery(String query, List<String> avisos) {
        List<String> mantidos = new ArrayList<>();
        if (query == null || query.isEmpty()) return mantidos;
        boolean prepareThresholdExplicito = false;
        boolean pgbouncer = false;
        for (String par : query.split("&")) {
            if (par.isEmpty()) continue;
            String[] kv = par.split("=", 2);
            String chave = kv[0];
            String valor = kv.length == 2 ? kv[1] : "";
            String chaveMin = chave.toLowerCase(Locale.ROOT);
            if (chaveMin.equals("pgbouncer")) {
                if ("true".equalsIgnoreCase(descodificar(valor))) {
                    pgbouncer = true;
                } else {
                    avisos.add("pgbouncer=" + valor + " ignorado (só pgbouncer=true tem efeito).");
                }
            } else if (IGNORADOS.contains(chaveMin)) {
                avisos.add(chave + "=" + valor + " ignorado — é um parâmetro do Prisma que o pgjdbc não conhece"
                        + (chaveMin.equals("connection_limit") ? "; o tamanho do pool aqui é DB_POOL_MAX (Hikari)." : "."));
            } else if (RENOMEADOS.containsKey(chaveMin)) {
                String novo = RENOMEADOS.get(chaveMin);
                mantidos.add(novo + "=" + valor);
                avisos.add(chave + " → " + novo + " (nome do pgjdbc).");
            } else {
                if (chave.equals("prepareThreshold")) prepareThresholdExplicito = true;
                mantidos.add(par); // sslmode, options, ... — o pgjdbc aceita-os com este nome
            }
        }
        if (pgbouncer) {
            if (prepareThresholdExplicito) {
                avisos.add("pgbouncer=true ignorado porque prepareThreshold já vem no URL.");
            } else {
                mantidos.add("prepareThreshold=0");
                avisos.add("pgbouncer=true → prepareThreshold=0 (sem prepared statements com nome: o pooler em modo transação não os suporta).");
            }
        }
        return mantidos;
    }

    /** Só percent-decoding: um "+" numa senha é um "+", como no libpq e no `new URL()` do Node — nunca um espaço. */
    private static String descodificar(String v) {
        try {
            return UriUtils.decode(v, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("percent-encoding inválido em \"" + v + "\"");
        }
    }
}
