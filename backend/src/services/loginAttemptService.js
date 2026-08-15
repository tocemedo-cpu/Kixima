// src/services/loginAttemptService.js
// Bloqueio progressivo de conta por tentativas de entrada falhadas.
//
// PORQUE É QUE O LIMITE POR IP NÃO CHEGAVA. O rate limiter conta pedidos por
// ENDEREÇO: 20 falhas por 15 minutos. Contra uma conta concreta isso não é
// barreira nenhuma — quem rode endereços (e rodar endereços é barato) tenta
// senhas sem tecto contra um email que conhece. Pior: o contador do limiter
// vive em memória, por isso reinicia sempre que o processo arranca, e no plano
// gratuito o contentor reinicia sozinho.
//
// AS TRÊS DECISÕES QUE MOLDAM ISTO:
//
//   1. O BLOQUEIO É SEMPRE TEMPORÁRIO. Um bloqueio permanente seria uma arma:
//      bastava errar a senha de alguém vezes suficientes para o pôr fora do
//      sistema, e num marketplace onde há concorrentes na mesma plataforma isso
//      não é hipótese teórica. O tempo cresce, mas a porta volta sempre a abrir.
//
//   2. O CONTADOR ESQUECE. Sem esquecimento, cinco enganos espalhados por três
//      meses acabavam por bloquear alguém que nunca fez nada de errado. Passada
//      a janela sem falhas, começa do zero.
//
//   3. O TITULAR É AVISADO. É a única parte disto que apanha um ataque que
//      ACERTA: se alguém está a martelar a conta de uma pessoa, essa pessoa é
//      quem consegue reconhecer que não é ela, e quem pode trocar a senha.
const prisma = require('../config/database');
const logger = require('../config/logger');
const { UnauthorizedError } = require('../utils/errors');

// Falhas toleradas antes do primeiro bloqueio. Cinco dá margem à pessoa que
// tem duas senhas na cabeça e engana-se a alternar entre elas.
const LIMIAR = 5;

// A escada, em minutos. Cresce depressa para tornar a força bruta inútil, e
// para no fim: uma hora já não é uma barreira, é uma porta fechada, e a
// diferença entre uma hora e um dia só penaliza o utilizador legítimo.
const ESCADA_MINUTOS = [1, 2, 5, 15, 30, 60];

// Sem falhas durante este tempo, o contador volta a zero.
const JANELA_DE_ESQUECIMENTO_MIN = 30;

// Não se avisa o titular mais do que uma vez por hora, aconteça o que acontecer.
const INTERVALO_DO_AVISO_MIN = 60;

const MIN_MS = 60 * 1000;

function minutosDeBloqueio(falhas) {
  const passo = falhas - LIMIAR;
  if (passo < 0) return 0;
  return ESCADA_MINUTOS[Math.min(passo, ESCADA_MINUTOS.length - 1)];
}

function esqueceu(user, agora) {
  if (!user.ultimaFalhaEm) return true;
  return agora - new Date(user.ultimaFalhaEm).getTime() > JANELA_DE_ESQUECIMENTO_MIN * MIN_MS;
}

/**
 * Recusa a entrada se a conta estiver bloqueada.
 *
 * Corre ANTES da comparação da senha, e isso é deliberado por dois motivos: o
 * bcrypt é caro de propósito (uma conta sob ataque consumiria o processador do
 * contentor a comparar senhas que se sabe de antemão que não vão ser aceites),
 * e um bloqueio que só se aplica depois de acertar na senha não bloqueia nada.
 *
 * A mensagem diz que a conta está bloqueada e por quanto tempo. É uma escolha:
 * revela que a conta existe. Mas este endpoint já o revela — quem tem conta por
 * aprovar recebe "a sua conta aguarda aprovação" e quem não tem recebe
 * "credenciais inválidas". E o custo de esconder seria pago pela pessoa certa:
 * quem está mesmo bloqueado continuaria a tentar, a agravar o bloqueio, sem
 * perceber porquê.
 */
function assertNaoBloqueado(user, agora = Date.now()) {
  if (!user?.bloqueadoAte) return;
  const ate = new Date(user.bloqueadoAte).getTime();
  if (ate <= agora) return;

  const faltamMin = Math.ceil((ate - agora) / MIN_MS);
  throw new UnauthorizedError(
    `Demasiadas tentativas falhadas. Esta conta está bloqueada durante ${faltamMin} minuto(s). `
    + 'Se não foi você a tentar entrar, mude a senha assim que conseguir aceder.',
  );
}

/**
 * Regista uma senha errada e devolve o estado resultante.
 * Não lança: quem chama decide o que dizer a seguir.
 */
async function registarFalha(user, agora = new Date()) {
  const base = esqueceu(user, agora.getTime()) ? 0 : (user.falhasSeguidas || 0);
  const falhas = base + 1;
  const minutos = minutosDeBloqueio(falhas);
  const bloqueadoAte = minutos ? new Date(agora.getTime() + minutos * MIN_MS) : null;

  await prisma.user.update({
    where: { id: user.id },
    data: { falhasSeguidas: falhas, ultimaFalhaEm: agora, bloqueadoAte },
  });

  if (bloqueadoAte) {
    // Fica no registo com o email: quem investiga um incidente precisa de saber
    // QUE conta estava a ser martelada, e isso não é um segredo — é o alvo.
    logger.warn(
      `Conta bloqueada por tentativas falhadas: ${user.email} (${falhas} falhas, ${minutos} min)`,
    );
    await avisarTitular(user, falhas, minutos, agora);
  }

  return { falhas, bloqueadoAte, minutos };
}

/**
 * Avisa a pessoa de que alguém anda a tentar entrar na conta dela.
 *
 * Falhar o envio não pode desfazer o bloqueio — o bloqueio é a proteção, o
 * email é a cortesia. Por isso o erro é registado e engolido.
 */
async function avisarTitular(user, falhas, minutos, agora) {
  const ultimo = user.avisoBloqueioEm ? new Date(user.avisoBloqueioEm).getTime() : 0;
  if (agora.getTime() - ultimo < INTERVALO_DO_AVISO_MIN * MIN_MS) return;

  try {
    const notificationService = require('./notificationService'); // tardio: evita ciclo
    await prisma.user.update({ where: { id: user.id }, data: { avisoBloqueioEm: agora } });
    await notificationService.enviarEmailDireto(
      user.email,
      'Tentativas de entrada na sua conta KIXIMA',
      [
        `Olá ${user.name},`, '',
        `Houve ${falhas} tentativas seguidas de entrar na sua conta com a senha errada.`,
        `Por segurança, a conta ficou bloqueada durante ${minutos} minuto(s).`,
        '',
        'Se foi você e se enganou na senha, é só esperar e tentar de novo — ou usar',
        '"Esqueci-me da senha" para definir uma nova.',
        '',
        'SE NÃO FOI VOCÊ: alguém sabe o seu email e está a adivinhar a senha.',
        'Mude a senha assim que conseguir entrar e ative a verificação em dois passos',
        'em Configurações → Segurança, para que a senha deixe de ser suficiente.',
        '', 'Equipe Kixima.',
      ].join('\n'),
    );
  } catch (err) {
    logger.error(`Não foi possível avisar ${user.email} do bloqueio: ${err.message}`);
  }
}

/**
 * Entrada bem sucedida: apaga o rasto.
 * Só escreve quando há alguma coisa para limpar — a esmagadora maioria dos
 * logins não tem falhas nenhumas e não precisa de um UPDATE.
 */
async function limpar(user) {
  if (!user.falhasSeguidas && !user.bloqueadoAte) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { falhasSeguidas: 0, bloqueadoAte: null, ultimaFalhaEm: null },
  });
}

/** Contas bloqueadas neste momento — para o Admin do Sistema ver um ataque em curso. */
async function bloqueadasAgora() {
  return prisma.user.findMany({
    where: { bloqueadoAte: { gt: new Date() } },
    select: { id: true, name: true, email: true, role: true, falhasSeguidas: true, bloqueadoAte: true },
    orderBy: { bloqueadoAte: 'desc' },
    take: 50,
  });
}

module.exports = {
  assertNaoBloqueado, registarFalha, limpar, bloqueadasAgora,
  LIMIAR, ESCADA_MINUTOS, JANELA_DE_ESQUECIMENTO_MIN, minutosDeBloqueio,
};
