package ao.kixima.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Espelha o essencial de backend/src/services/storageService.js —
 * armazenamento plugável de ficheiros carregados. Recebe o buffer do
 * upload e devolve o URL a guardar no registo correspondente.
 *
 * NÃO PORTADO (M5): o provider 's3' (AWS S3 / Supabase Storage / R2 /
 * MinIO) — precisaria do SDK da AWS, uma dependência nova no pom.xml.
 * Tal como o Node quando 's3' está mal configurado, aqui QUALQUER pedido
 * de 's3' cai para o disco local com um aviso ALTO no log — nunca
 * silencioso — porque o disco do contentor é apagado a cada reinício.
 */
@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);
    private static final Pattern EXT = Pattern.compile("\\.[a-z0-9]+$");
    private static final Pattern NOME_INVALIDO = Pattern.compile("[^a-z0-9-]", Pattern.CASE_INSENSITIVE);

    private final String provider;
    private final Path uploadsDir;
    private final String bucket;
    private final String accessKey;
    private final String secretKey;

    public StorageService(@Value("${kixima.storage.provider:local}") String provider,
                           @Value("${kixima.storage.local-dir:uploads}") String localDir,
                           @Value("${kixima.storage.bucket:}") String bucket,
                           @Value("${kixima.storage.access-key:}") String accessKey,
                           @Value("${kixima.storage.secret-key:}") String secretKey) {
        this.provider = provider;
        this.uploadsDir = Paths.get(localDir).toAbsolutePath().normalize();
        this.bucket = bucket == null ? "" : bucket.trim();
        this.accessKey = accessKey == null ? "" : accessKey.trim();
        this.secretKey = secretKey == null ? "" : secretKey.trim();
        if ("s3".equals(provider)) {
            log.error("STORAGE_PROVIDER=s3 pedido mas o provider S3 ainda não está portado para Java (M5+) — "
                    + "TODOS os ficheiros vão para o disco local ({}), que é efémero em produção. "
                    + "Isto não é uma falha silenciosa: cada upload volta a avisar aqui.", uploadsDir);
        }
    }

    private static String extDe(String originalname) {
        if (originalname == null) return ".jpg";
        Matcher m = EXT.matcher(originalname.toLowerCase());
        return m.find() ? m.group() : ".jpg";
    }

    private static String buildFilename(String keyHint) {
        String id = NOME_INVALIDO.matcher(keyHint == null ? "img" : keyHint).replaceAll("");
        if (id.isBlank()) id = "img";
        return id;
    }

    /** Devolve o URL a guardar (ex.: {@code /api/uploads/produto-1699999999999.jpg}). */
    public String saveFile(byte[] buffer, String originalname, String mimetype, String keyHint) {
        FileSignature.verificar(buffer, mimetype, originalname);
        String filename = buildFilename(keyHint) + "-" + Instant.now().toEpochMilli() + extDe(originalname);
        try {
            Files.createDirectories(uploadsDir);
            Files.write(uploadsDir.resolve(filename), buffer);
        } catch (IOException e) {
            throw new IllegalStateException("Não foi possível guardar o ficheiro no disco local.", e);
        }
        return "/api/uploads/" + filename;
    }

    /** Espelha `comChave: true` — quem guarda cópias de segurança precisa da CHAVE para as voltar a ler. */
    public record Guardado(String url, String key) {
    }

    /**
     * Espelha `saveFile({ ..., folder, bucket, comChave: true })`. No provider
     * local a chave é o próprio nome do ficheiro ({@code folder}/{@code bucket}
     * só têm significado no S3, ainda não portado — ver Javadoc da classe).
     */
    public Guardado saveFileComChave(byte[] buffer, String originalname, String mimetype, String keyHint,
                                     String folder, String bucket) {
        String url = saveFile(buffer, originalname, mimetype, keyHint);
        return new Guardado(url, url.substring(url.lastIndexOf('/') + 1));
    }

    /** Lê um objeto de volta do armazenamento — no provider local, pelo nome (nunca um caminho). */
    public byte[] lerFicheiro(String key, String bucket) throws IOException {
        return readFile(key);
    }

    /** Lê um ficheiro já guardado — {@code filename}, nunca um caminho completo (só nome+extensão). */
    public byte[] readFile(String filename) throws IOException {
        return Files.readAllBytes(uploadsDir.resolve(Paths.get(filename).getFileName()));
    }

    public String providerAtivo() {
        return "local"; // 's3' cai sempre para 'local' neste marco — ver Javadoc da classe.
    }

    String getProvider() {
        return provider;
    }

    /** O provider PEDIDO no ambiente (STORAGE_PROVIDER) — distinto de {@link #providerAtivo()}, que é o que este processo consegue mesmo usar. */
    public String providerConfigurado() {
        return provider;
    }

    public String bucket() {
        return bucket;
    }

    /**
     * Espelha `config.storage.missing` — NOMES das variáveis obrigatórias em falta
     * quando o armazenamento é S3 (uma string vazia conta como ausente). Nunca valores.
     */
    public List<String> emFalta() {
        if (!"s3".equals(provider)) return List.of();
        List<String> falta = new ArrayList<>();
        if (bucket.isBlank()) falta.add("STORAGE_BUCKET");
        if (accessKey.isBlank()) falta.add("STORAGE_ACCESS_KEY");
        if (secretKey.isBlank()) falta.add("STORAGE_SECRET_KEY");
        return falta;
    }
}
