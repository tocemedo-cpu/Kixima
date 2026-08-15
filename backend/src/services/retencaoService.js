// src/services/retencaoService.js
// Quanto tempo é que cada coisa fica guardada — e a limpeza que o cumpre.
//
// PORQUE É QUE A POLÍTICA VIVE AQUI E NÃO SÓ NO TEXTO LEGAL. Uma política de
// privacidade que promete prazos que o sistema não cumpre é pior do que não
// prometer nada: fica escrita, é oponível, e ninguém a verifica. Aqui os prazos
// são a fonte única — a página pública lê-os desta lista, e a limpeza automática
// aplica-os. Para o texto divergir do comportamento, alguém teria de mudar este
// ficheiro, e nessa altura muda os dois.
//
// O QUE NÃO SE APAGA, E PORQUÊ. O trilho de auditoria e os registos financeiros
// (ordens, faturas, pagamentos) NÃO têm prazo de eliminação. São obrigação de
// conservação contabilística e são a prova do "pagamento garantido" — apagá-los
// ao fim de N anos por iniciativa da plataforma seria destruir a defesa da
// própria KIXIMA num litígio. O que o titular pode fazer sobre eles é remover a
// sua identificação (dadosPessoaisService.anonimizar), não fazê-los desaparecer.
//
// OS PRAZOS EXATOS DA PARTE FISCAL TÊM DE SER CONFIRMADOS POR CONTABILISTA em
// Angola. Os que estão aqui são os operacionais — os que dependem só de decisão
// de produto — e estão configuráveis por variável de ambiente para poderem ser
// ajustados sem tocar em código quando essa confirmação chegar.
const prisma = require('../config/database');
const logger = require('../config/logger');

const DIA_MS = 24 * 60 * 60 * 1000;
const dias = (env, omissao) => Number(process.env[env]) || omissao;

/**
 * A política, por extenso. Cada entrada diz o que é, quanto tempo fica e
 * PORQUÊ — o porquê é o que permite a alguém de fora avaliar se o prazo é
 * razoável, e é o que a página pública mostra.
 */
const POLITICA = [
  {
    id: 'notificacoes',
    o_que: 'Notificações já lidas',
    dias: dias('RETENCAO_NOTIFICACOES_DIAS', 180),
    porque: 'São avisos operacionais. Passado meio ano deixam de ter utilidade e só acumulam.',
  },
  {
    id: 'convites',
    o_que: 'Convites de funcionário expirados ou cancelados',
    dias: dias('RETENCAO_CONVITES_DIAS', 90),
    porque: 'Contêm o email de alguém que nunca chegou a ter conta. Não há motivo para os manter.',
  },
  {
    id: 'codigos2fa',
    o_que: 'Códigos de verificação em dois passos enviados por email',
    dias: dias('RETENCAO_CODIGOS_DIAS', 1),
    porque: 'Valem 10 minutos. O registo do que já expirou não serve para nada.',
  },
  {
    id: 'conta',
    o_que: 'Dados da sua conta (nome, email, foto, preferências)',
    dias: null,
    porque: 'Ficam enquanto a conta existir. Pode exportá-los ou eliminá-los a qualquer momento '
      + 'em Configurações → Segurança, sem pedir nada a ninguém.',
  },
  {
    id: 'financeiro',
    o_que: 'Ordens de compra, faturas, pagamentos e trilho de auditoria',
    dias: null,
    porque: 'Conservados por obrigação legal de conservação contabilística e porque são a prova '
      + 'das transações. Ao eliminar a sua conta, estes registos mantêm-se mas deixam de o '
      + 'identificar: o nome é substituído e a ligação à pessoa desaparece.',
  },
];

const prazoDe = (id) => POLITICA.find((p) => p.id === id)?.dias ?? null;
const limite = (id) => {
  const d = prazoDe(id);
  return d === null ? null : new Date(Date.now() - d * DIA_MS);
};

/**
 * Aplica a política. Devolve o que apagou, por categoria.
 *
 * Nada aqui apaga registos financeiros nem o trilho — as consultas abaixo são a
 * lista completa do que a limpeza toca, e é curta de propósito: é mais fácil
 * confirmar que uma lista curta está certa do que confiar numa longa.
 */
async function limpar() {
  const resultado = {};

  const ateNotificacoes = limite('notificacoes');
  if (ateNotificacoes) {
    const r = await prisma.notification.deleteMany({
      where: { readAt: { not: null, lt: ateNotificacoes } },
    });
    resultado.notificacoes = r.count;
  }

  const ateConvites = limite('convites');
  if (ateConvites) {
    const r = await prisma.employeeInvite.deleteMany({
      where: {
        status: { in: ['EXPIRADO', 'CANCELADO'] },
        // `updatedAt` e não `createdAt`: o que interessa é há quanto tempo o
        // convite MORREU, não há quanto tempo foi criado.
        updatedAt: { lt: ateConvites },
      },
    });
    resultado.convites = r.count;
  }

  const ateCodigos = limite('codigos2fa');
  if (ateCodigos) {
    const r = await prisma.user.updateMany({
      where: { mfaCodeExpiraEm: { not: null, lt: ateCodigos } },
      data: { mfaCodeHash: null, mfaCodeExpiraEm: null, mfaCodeTentativas: 0 },
    });
    resultado.codigos2fa = r.count;
  }

  const total = Object.values(resultado).reduce((a, b) => a + b, 0);
  if (total > 0) {
    logger.info(`Retenção: ${total} registo(s) eliminado(s)`, resultado);
  }
  return { ...resultado, total, corridoEm: new Date() };
}

/** A política para publicar. Sem nada de interno — é texto para quem a lê. */
function politica() {
  return POLITICA.map(({ id, o_que, dias: d, porque }) => ({
    id,
    o_que,
    // "1 dias" lê-se como um descuido, e num texto legal um descuido tira
    // credibilidade ao resto.
    prazo: d === null ? 'Enquanto a conta existir / conservação legal' : `${d} ${d === 1 ? 'dia' : 'dias'}`,
    dias: d,
    porque,
  }));
}

module.exports = { limpar, politica, POLITICA, prazoDe };
