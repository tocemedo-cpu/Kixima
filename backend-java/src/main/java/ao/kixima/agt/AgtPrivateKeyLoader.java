package ao.kixima.agt;

import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

/**
 * Espelha o essencial de {@code lerChavePrivadaAgt()}/
 * {@code diagnosticoChavePrivadaAgt()} em backend/src/config/env.js: chave
 * primeiro de {@code AGT_JWS_PRIVATE_KEY_BASE64} (painel de variáveis de
 * ambiente em produção), depois os "Secret Files" do Render
 * ({@link #CAMINHOS_SECRET_FILE_RENDER} — o caminho RECOMENDADO em produção:
 * o painel de variáveis corta valores do tamanho de um PEM sem avisar), e por
 * fim um ficheiro local de desenvolvimento (nunca comitado). A mesma ordem e
 * as mesmas fontes do Node, para o cutover não mudar onde a chave vive.
 *
 * Aceita PEM em PKCS#8 ("-----BEGIN PRIVATE KEY-----", o que o
 * {@code openssl genpkey}/Java produzem) e em PKCS#1
 * ("-----BEGIN RSA PRIVATE KEY-----", o formato mais comum de chaves RSA
 * geradas por {@code openssl genrsa}/muitas autoridades) — envolve o DER
 * PKCS#1 no cabeçalho PKCS#8 fixo antes de o entregar ao
 * {@link KeyFactory}, já que a API padrão do Java só lê PKCS#8
 * directamente.
 */
final class AgtPrivateKeyLoader {

    private AgtPrivateKeyLoader() {
    }

    record Resultado(PrivateKey chave, String fonte) {
    }

    /**
     * Os dois nomes que o Node aceita (CAMINHOS_SECRET_FILE_RENDER em env.js):
     * "chavePrivada.pem" (o recomendado) e "AGT_JWS_PRIVATE_KEY_BASE64" (caso
     * real: dar ao Secret File o nome da variável é um erro fácil no painel).
     */
    static final java.util.List<Path> CAMINHOS_SECRET_FILE_RENDER = java.util.List.of(
            Path.of("/etc/secrets/chavePrivada.pem"),
            Path.of("/etc/secrets/AGT_JWS_PRIVATE_KEY_BASE64"));

    static Resultado carregar(String base64Env, String caminhoFicheiroLocal) {
        return carregar(base64Env, CAMINHOS_SECRET_FILE_RENDER, caminhoFicheiroLocal);
    }

    /** A mesma ordem de lerChavePrivadaAgt(): variável → Secret Files → ficheiro local. */
    static Resultado carregar(String base64Env, java.util.List<Path> secretFiles, String caminhoFicheiroLocal) {
        String base64 = base64Env == null ? "" : base64Env.trim();
        if (!base64.isEmpty()) {
            PrivateKey chave = null;
            try {
                chave = tentarInterpretar(new String(Base64.getDecoder().decode(base64), java.nio.charset.StandardCharsets.UTF_8));
            } catch (IllegalArgumentException ignorado) {
                // não é Base64 — cortado ou corrompido pelo painel; cai para as fontes seguintes, como o Node.
            }
            if (chave != null) return new Resultado(chave, "variável de ambiente (AGT_JWS_PRIVATE_KEY_BASE64)");
        }
        for (Path caminho : secretFiles) {
            PrivateKey chave = lerFicheiro(caminho);
            if (chave != null) return new Resultado(chave, "Secret File (" + caminho + ")");
        }
        if (caminhoFicheiroLocal != null && !caminhoFicheiroLocal.isBlank()) {
            PrivateKey chave = lerFicheiro(Path.of(caminhoFicheiroLocal));
            if (chave != null) return new Resultado(chave, "ficheiro local (" + caminhoFicheiroLocal + ")");
        }
        return new Resultado(null, null);
    }

    /** interpretarConteudoFicheiro(): o ficheiro pode ter o PEM em texto ou o valor já em Base64. */
    private static PrivateKey lerFicheiro(Path caminho) {
        if (!Files.isReadable(caminho)) return null;
        try {
            String conteudo = Files.readString(caminho, java.nio.charset.StandardCharsets.UTF_8);
            PrivateKey chave = tentarInterpretar(conteudo);
            if (chave == null) {
                try {
                    chave = tentarInterpretar(new String(Base64.getDecoder().decode(conteudo.trim()),
                            java.nio.charset.StandardCharsets.UTF_8));
                } catch (IllegalArgumentException ignorado) {
                    // não era Base64 válido — já tentámos como PEM directo acima, fica por resolver.
                }
            }
            return chave;
        } catch (Exception ignorado) {
            return null; // ilegível/corrompido — cai para a fonte seguinte, mesmo princípio do Node.
        }
    }

    private static PrivateKey tentarInterpretar(String pemOuVazio) {
        if (pemOuVazio == null) return null;
        try {
            return parsePem(pemOuVazio);
        } catch (Exception e) {
            return null;
        }
    }

    private static PrivateKey parsePem(String pem) throws Exception {
        boolean pkcs1 = pem.contains("BEGIN RSA PRIVATE KEY");
        String limpo = pem
                .replace("-----BEGIN RSA PRIVATE KEY-----", "")
                .replace("-----END RSA PRIVATE KEY-----", "")
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s", "");
        if (limpo.isEmpty()) throw new IllegalArgumentException("PEM vazio.");
        byte[] der = Base64.getDecoder().decode(limpo);
        byte[] pkcs8Der = pkcs1 ? envolverPkcs1EmPkcs8(der) : der;
        KeyFactory kf = KeyFactory.getInstance("RSA");
        return kf.generatePrivate(new PKCS8EncodedKeySpec(pkcs8Der));
    }

    /**
     * Envolve um {@code RSAPrivateKey} PKCS#1 (ASN.1 bruto) no invólucro
     * PKCS#8 mínimo — {@code PrivateKeyInfo { version=0, algorithm=rsaEncryption, privateKey=OCTET STRING(pkcs1Der) }}.
     * Prefixo fixo e bem conhecido para RSA (OID 1.2.840.113549.1.1.1);
     * evita puxar uma dependência (ex. BouncyCastle) só para isto.
     */
    private static byte[] envolverPkcs1EmPkcs8(byte[] pkcs1Der) {
        // INTEGER version=0 + SEQUENCE AlgorithmIdentifier{OID rsaEncryption, NULL} —
        // prefixo fixo, sempre os mesmos bytes para qualquer chave RSA.
        byte[] octetLen = comprimentoAsn1(pkcs1Der.length);
        byte[] semTamanho = concat(
                new byte[]{0x02, 0x01, 0x00, 0x30, 0x0D, 0x06, 0x09, 0x2A, (byte) 0x86, 0x48, (byte) 0x86, (byte) 0xF7, 0x0D, 0x01, 0x01, 0x01, 0x05, 0x00},
                new byte[]{0x04}, octetLen, pkcs1Der);
        byte[] seqLen = comprimentoAsn1(semTamanho.length);
        return concat(new byte[]{0x30}, seqLen, semTamanho);
    }

    private static byte[] comprimentoAsn1(int tamanho) {
        if (tamanho < 0x80) return new byte[]{(byte) tamanho};
        if (tamanho <= 0xFF) return new byte[]{(byte) 0x81, (byte) tamanho};
        return new byte[]{(byte) 0x82, (byte) (tamanho >> 8), (byte) tamanho};
    }

    private static byte[] concat(byte[]... partes) {
        int total = 0;
        for (byte[] p : partes) total += p.length;
        byte[] out = new byte[total];
        int pos = 0;
        for (byte[] p : partes) {
            System.arraycopy(p, 0, out, pos, p.length);
            pos += p.length;
        }
        return out;
    }
}
