package ao.kixima.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.logging.DeferredLogs;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * A DATABASE_URL do Node (libpq) tem de chegar ao Spring como
 * spring.datasource.url/username/password sem ninguém a copiar segredos para
 * um segundo formato — e DATABASE_URL_JDBC, quando existe, continua a mandar.
 * Não levanta contexto: a tradução é uma função pura e o processador corre
 * sobre um MockEnvironment.
 */
class DatabaseUrlEnvironmentPostProcessorTest {

    private final DatabaseUrlEnvironmentPostProcessor processador = new DatabaseUrlEnvironmentPostProcessor(new DeferredLogs());

    @Test
    void urlLocalComPorta() {
        var d = DatabaseUrlEnvironmentPostProcessor.derivar("postgresql://kixima:kixima@localhost:5432/kixima_test");
        assertThat(d.jdbcUrl()).isEqualTo("jdbc:postgresql://localhost:5432/kixima_test");
        assertThat(d.username()).isEqualTo("kixima");
        assertThat(d.password()).isEqualTo("kixima");
        assertThat(d.avisos()).isEmpty();
    }

    @Test
    void semPortaEComEsquemaCurto() {
        var d = DatabaseUrlEnvironmentPostProcessor.derivar("postgres://app:segredo@db.interno/kixima");
        assertThat(d.jdbcUrl()).isEqualTo("jdbc:postgresql://db.interno/kixima");
        assertThat(d.username()).isEqualTo("app");
        assertThat(d.password()).isEqualTo("segredo");
    }

    @Test
    void senhaComCaracteresCodificadosEDescodificadaSemTrocarMaisPorEspaco() {
        var d = DatabaseUrlEnvironmentPostProcessor.derivar(
                "postgresql://postgres.abcdef:p%40ss%3Aw%2Frd%2B1+x%23@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require");
        assertThat(d.username()).isEqualTo("postgres.abcdef");
        assertThat(d.password()).isEqualTo("p@ss:w/rd+1+x#");
        assertThat(d.jdbcUrl()).isEqualTo("jdbc:postgresql://aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require");
    }

    @Test
    void parametrosDoPrismaSaoTraduzidosOuIgnoradosComAviso() {
        var d = DatabaseUrlEnvironmentPostProcessor.derivar(
                "postgresql://u:p@host:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1&pool_timeout=20&schema=public&connect_timeout=10");
        assertThat(d.jdbcUrl()).isEqualTo(
                "jdbc:postgresql://host:6543/postgres?sslmode=require&currentSchema=public&connectTimeout=10&prepareThreshold=0");
        assertThat(d.avisos()).anySatisfy(a -> assertThat(a).contains("connection_limit").contains("DB_POOL_MAX"));
        assertThat(d.avisos()).anySatisfy(a -> assertThat(a).contains("pool_timeout"));
        assertThat(d.avisos()).anySatisfy(a -> assertThat(a).contains("pgbouncer=true").contains("prepareThreshold=0"));
        assertThat(d.avisos()).anySatisfy(a -> assertThat(a).contains("schema").contains("currentSchema"));
    }

    @Test
    void semCredenciaisSemBaseEIpv6() {
        var semCredenciais = DatabaseUrlEnvironmentPostProcessor.derivar("postgresql://host:5432/base");
        assertThat(semCredenciais.username()).isNull();
        assertThat(semCredenciais.password()).isNull();
        var soUtilizador = DatabaseUrlEnvironmentPostProcessor.derivar("postgresql://app@host/base");
        assertThat(soUtilizador.username()).isEqualTo("app");
        assertThat(soUtilizador.password()).isEmpty();
        var ipv6 = DatabaseUrlEnvironmentPostProcessor.derivar("postgresql://u:p@[::1]:5433/base?sslmode=disable");
        assertThat(ipv6.jdbcUrl()).isEqualTo("jdbc:postgresql://[::1]:5433/base?sslmode=disable");
        var semBarra = DatabaseUrlEnvironmentPostProcessor.derivar("postgresql://u:p@host");
        assertThat(semBarra.jdbcUrl()).isEqualTo("jdbc:postgresql://host/");
    }

    @Test
    void urlInvalidaERecusada() {
        assertThatThrownBy(() -> DatabaseUrlEnvironmentPostProcessor.derivar("mysql://u:p@host/base"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("postgresql");
        assertThatThrownBy(() -> DatabaseUrlEnvironmentPostProcessor.derivar("jdbc:postgresql://host/base"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> DatabaseUrlEnvironmentPostProcessor.derivar("postgresql://u:p@host:abc/base"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("porta");
    }

    @Test
    void noAmbienteDerivaAsTresPropriedades() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("DATABASE_URL", "postgresql://kixima:se%40nha@pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true");
        processador.postProcessEnvironment(env, new SpringApplication());
        assertThat(env.getProperty("spring.datasource.url"))
                .isEqualTo("jdbc:postgresql://pooler.supabase.com:6543/postgres?sslmode=require&prepareThreshold=0");
        assertThat(env.getProperty("spring.datasource.username")).isEqualTo("kixima");
        assertThat(env.getProperty("spring.datasource.password")).isEqualTo("se@nha");
        assertThat(env.getPropertySources().contains(DatabaseUrlEnvironmentPostProcessor.NOME_DA_FONTE)).isTrue();
    }

    @Test
    void databaseUrlJdbcContinuaATerPrecedencia() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("DATABASE_URL_JDBC", "jdbc:postgresql://explicito:5432/base");
        env.setProperty("DATABASE_URL", "postgresql://u:p@derivado:5432/outra");
        processador.postProcessEnvironment(env, new SpringApplication());
        assertThat(env.getPropertySources().contains(DatabaseUrlEnvironmentPostProcessor.NOME_DA_FONTE)).isFalse();
        assertThat(env.getProperty("spring.datasource.url")).isNull();
    }

    @Test
    void semDatabaseUrlOuComUrlInvalidaNaoMexeNoAmbiente() {
        MockEnvironment vazio = new MockEnvironment();
        processador.postProcessEnvironment(vazio, new SpringApplication());
        assertThat(vazio.getPropertySources().contains(DatabaseUrlEnvironmentPostProcessor.NOME_DA_FONTE)).isFalse();

        MockEnvironment invalido = new MockEnvironment();
        invalido.setProperty("DATABASE_URL", "isto não é um url");
        processador.postProcessEnvironment(invalido, new SpringApplication()); // avisa, não rebenta o arranque
        assertThat(invalido.getProperty("spring.datasource.url")).isNull();
    }

    @Test
    void noPerfilDeTesteNuncaDeriva() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("test");
        env.setProperty("DATABASE_URL", "postgresql://u:p@producao.supabase.com:5432/postgres");
        processador.postProcessEnvironment(env, new SpringApplication());
        assertThat(env.getProperty("spring.datasource.url")).isNull();
    }
}
