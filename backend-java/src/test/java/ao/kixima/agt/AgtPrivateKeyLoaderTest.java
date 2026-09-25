package ao.kixima.agt;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPairGenerator;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * lerChavePrivadaAgt()/diagnosticoChavePrivadaAgt() em env.js: a chave vem da
 * variável, senão de um Secret File do Render, senão do ficheiro local — e um
 * valor cortado pelo painel nunca é usado, cai para a fonte seguinte.
 */
class AgtPrivateKeyLoaderTest {

    private static String pemDeTeste() throws Exception {
        KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
        g.initialize(2048);
        String der = Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(g.generateKeyPair().getPrivate().getEncoded());
        return "-----BEGIN PRIVATE KEY-----\n" + der + "\n-----END PRIVATE KEY-----\n";
    }

    @Test
    void secretFileDoRenderEUsadoQuandoAVariavelNaoEstaDefinida(@TempDir Path dir) throws Exception {
        Path secreto = dir.resolve("chavePrivada.pem");
        Files.writeString(secreto, pemDeTeste());
        AgtPrivateKeyLoader.Resultado r = AgtPrivateKeyLoader.carregar("", List.of(dir.resolve("nao-existe"), secreto), null);
        assertThat(r.chave()).isNotNull();
        assertThat(r.fonte()).isEqualTo("Secret File (" + secreto + ")");
    }

    @Test
    void variavelCortadaPeloPainelCaiParaOSecretFile(@TempDir Path dir) throws Exception {
        Path secreto = dir.resolve("AGT_JWS_PRIVATE_KEY_BASE64");
        Files.writeString(secreto, Base64.getEncoder().encodeToString(pemDeTeste().getBytes())); // o ficheiro pode trazer o Base64
        String cortada = Base64.getEncoder().encodeToString(pemDeTeste().getBytes()).substring(0, 400);
        AgtPrivateKeyLoader.Resultado r = AgtPrivateKeyLoader.carregar(cortada, List.of(secreto), null);
        assertThat(r.chave()).isNotNull();
        assertThat(r.fonte()).startsWith("Secret File (");
    }

    @Test
    void aVariavelTemPrecedenciaEOFicheiroLocalEOUltimoRecurso(@TempDir Path dir) throws Exception {
        String base64 = Base64.getEncoder().encodeToString(pemDeTeste().getBytes());
        assertThat(AgtPrivateKeyLoader.carregar(base64, List.of(), null).fonte())
                .isEqualTo("variável de ambiente (AGT_JWS_PRIVATE_KEY_BASE64)");
        Path local = dir.resolve("local.pem");
        Files.writeString(local, pemDeTeste());
        assertThat(AgtPrivateKeyLoader.carregar("", List.of(dir.resolve("x")), local.toString()).fonte())
                .isEqualTo("ficheiro local (" + local + ")");
        assertThat(AgtPrivateKeyLoader.carregar("", List.of(), dir.resolve("nada").toString()).chave()).isNull();
    }
}
