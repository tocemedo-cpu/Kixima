package ao.kixima.user;

import ao.kixima.common.error.UnauthorizedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Espelha backend/src/services/loginAttemptService.js — bloqueio
 * progressivo de conta por tentativas de entrada falhadas, persistido no
 * próprio utilizador (não em memória — sobrevive a um reinício do
 * processo, tal como o Node).
 *
 * TODO (M5, quando notificationService for portado): avisarTitular() hoje
 * só regista em log — o Node envia um email a avisar o titular. O bloqueio
 * em si (a parte crítica de segurança) já está completo; falta a cortesia
 * do aviso.
 */
@Service
public class LoginAttemptService {

    private static final Logger log = LoggerFactory.getLogger(LoginAttemptService.class);

    /** Falhas toleradas antes do primeiro bloqueio. */
    public static final int LIMIAR = 5;

    /** A escada, em minutos. */
    public static final List<Integer> ESCADA_MINUTOS = List.of(1, 2, 5, 15, 30, 60);

    /** Sem falhas durante este tempo, o contador volta a zero. */
    public static final int JANELA_DE_ESQUECIMENTO_MIN = 30;

    private static final int INTERVALO_DO_AVISO_MIN = 60;

    public int minutosDeBloqueio(int falhas) {
        int passo = falhas - LIMIAR;
        if (passo < 0) return 0;
        return ESCADA_MINUTOS.get(Math.min(passo, ESCADA_MINUTOS.size() - 1));
    }

    private boolean esqueceu(User user, Instant agora) {
        if (user.getUltimaFalhaEm() == null) return true;
        return Duration.between(user.getUltimaFalhaEm(), agora).toMinutes() > JANELA_DE_ESQUECIMENTO_MIN;
    }

    /**
     * Recusa a entrada se a conta estiver bloqueada. Corre ANTES da
     * comparação da senha (bcrypt é caro de propósito).
     */
    public void assertNaoBloqueado(User user, Instant agora) {
        if (user.getBloqueadoAte() == null) return;
        if (!user.getBloqueadoAte().isAfter(agora)) return;
        long faltamMs = Duration.between(agora, user.getBloqueadoAte()).toMillis();
        long faltamMin = (long) Math.ceil(faltamMs / 60_000.0);
        throw new UnauthorizedException(
                "Demasiadas tentativas falhadas. Esta conta está bloqueada durante " + faltamMin + " minuto(s). "
                        + "Se não foi você a tentar entrar, mude a senha assim que conseguir aceder.");
    }

    public void assertNaoBloqueado(User user) {
        assertNaoBloqueado(user, Instant.now());
    }

    /**
     * Regista uma senha errada. Muta o `user` gerido pelo JPA (a
     * transação da chamada persiste as alterações) — mesmo padrão do
     * Node, que faz um único UPDATE com o novo estado.
     */
    public void registarFalha(User user, Instant agora) {
        int base = esqueceu(user, agora) ? 0 : user.getFalhasSeguidas();
        int falhas = base + 1;
        int minutos = minutosDeBloqueio(falhas);
        Instant bloqueadoAte = minutos > 0 ? agora.plus(Duration.ofMinutes(minutos)) : null;

        user.setFalhasSeguidas(falhas);
        user.setUltimaFalhaEm(agora);
        user.setBloqueadoAte(bloqueadoAte);

        if (bloqueadoAte != null) {
            log.warn("Conta bloqueada por tentativas falhadas: {} ({} falhas, {} min)", user.getEmail(), falhas, minutos);
            avisarTitular(user, falhas, minutos, agora);
        }
    }

    public void registarFalha(User user) {
        registarFalha(user, Instant.now());
    }

    private void avisarTitular(User user, int falhas, int minutos, Instant agora) {
        Instant ultimo = user.getAvisoBloqueioEm();
        if (ultimo != null && Duration.between(ultimo, agora).toMinutes() < INTERVALO_DO_AVISO_MIN) return;
        user.setAvisoBloqueioEm(agora);
        // TODO (M5): notificationService.enviarEmailDireto — ver javadoc da classe.
        log.info("(pendente M5) avisaria {} por email: {} tentativas falhadas, bloqueado {} min", user.getEmail(), falhas, minutos);
    }

    /** Entrada bem sucedida: apaga o rasto. */
    public void limpar(User user) {
        if (user.getFalhasSeguidas() == 0 && user.getBloqueadoAte() == null) return;
        user.setFalhasSeguidas(0);
        user.setBloqueadoAte(null);
        user.setUltimaFalhaEm(null);
    }
}
