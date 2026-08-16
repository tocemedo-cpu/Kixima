// src/services/alertaOperacionalService.js
// Avisa quem tem de saber quando um trabalho automático falha.
//
// O QUE ESTAVA ERRADO. Os trabalhos agendados — cópia de segurança, retenção de
// dados, expiração de apólices — já tratavam os seus erros: escreviam no
// registo e deixavam rasto na auditoria. O que nenhum fazia era AVISAR alguém.
//
// A diferença não é académica. O painel de Prontidão marca FALHA quando a
// última cópia tem mais de 48 horas, por isso o sinal existe — mas é um sinal
// PENDURADO, à espera de que alguém passe por lá. Entre a cópia parar e alguém
// abrir o painel podem passar semanas, e é exatamente nesse intervalo que uma
// cópia faz falta. Um alerta que é preciso ir buscar não é um alerta.
//
// O ARREFECIMENTO VIVE NA BASE, e não em memória. A verificação de atraso da
// cópia corre de trinta em trinta minutos: uma falha persistente daria 48
// emails por dia, e quarenta e oito emails iguais leem-se como zero. Guardar o
// último aviso numa variável do processo não serve — o contentor reinicia
// sozinho no plano gratuito, e o contador reiniciava com ele, o que devolvia
// precisamente a enxurrada que se queria evitar. É o mesmo raciocínio que já
// está no bloqueio de contas por tentativas falhadas.
//
// FALHAR A AVISAR NÃO PODE PARTIR O QUE SE ESTAVA A FAZER. Se o email não sair,
// regista-se e segue-se: o trabalho que falhou já falhou, e rebentar aqui só
// acrescentaria um segundo problema por cima do primeiro.

const prisma = require('../config/database');
const config = require('./../config/env');
const logger = require('../config/logger');
const notificationService = require('./notificationService');
const auditService = require('./auditService');

// Uma hora entre avisos do MESMO assunto. Uma falha que persiste não precisa de
// ser repetida a cada meia hora; precisa de ser resolvida.
const INTERVALO_MIN = Number(process.env.ALERTA_INTERVALO_MIN) || 60;
const MIN_MS = 60 * 1000;

const ACAO = 'ALERTA_OPERACIONAL_ENVIADO';

/**
 * Já se avisou sobre este assunto há pouco tempo?
 *
 * A pergunta é feita à auditoria, que é onde o registo sobrevive a reinícios.
 */
async function avisadoRecentemente(assunto, agora) {
  const ultimo = await prisma.auditLog.findFirst({
    where: { action: ACAO, entityRef: assunto },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  }).catch(() => null);
  if (!ultimo) return false;
  return agora.getTime() - new Date(ultimo.createdAt).getTime() < INTERVALO_MIN * MIN_MS;
}

/** Os administradores do sistema, que são quem pode agir sobre isto. */
async function destinatarios() {
  const users = await prisma.user.findMany({
    where: { role: 'ADMIN_SISTEMA', active: true },
    select: { email: true },
    take: 20,
  });
  return users.map((u) => u.email).filter(Boolean);
}

/**
 * Avisa que um trabalho automático falhou.
 *
 * @param assunto  identificador estável do alerta (ex.: 'COPIA_SEGURANCA').
 *                 É por ele que o arrefecimento é contado — dois assuntos
 *                 diferentes não se silenciam um ao outro.
 * @param titulo   uma linha, legível por quem recebe.
 * @param detalhe  o que correu mal e o que fazer a seguir.
 */
async function avisarFalha(assunto, titulo, detalhe) {
  const agora = new Date();
  try {
    if (await avisadoRecentemente(assunto, agora)) return { enviado: false, motivo: 'avisado há pouco' };

    // Sem email configurado não há nada a fazer aqui — e é o próprio painel de
    // Prontidão que assinala essa configuração em falta, com muito mais
    // contexto do que este registo conseguiria dar.
    if (config.email.apenasLog || config.email.missing.length) {
      return { enviado: false, motivo: 'email não configurado' };
    }

    const para = await destinatarios();
    if (!para.length) return { enviado: false, motivo: 'nenhum Admin do Sistema ativo' };

    const corpo = [
      titulo,
      '',
      detalhe,
      '',
      `Ambiente: ${config.env}`,
      `Momento: ${agora.toISOString()} UTC`,
      '',
      'Este aviso é enviado no máximo uma vez por hora para o mesmo assunto.',
      'Veja Configurações e Suporte → Prontidão para produção.',
    ].join('\n');

    for (const email of para) {
      await notificationService.enviarEmailDireto(email, `KIXIMA — ${titulo}`, corpo);
    }

    // Registado DEPOIS de sair, e não antes: gravar primeiro faria o
    // arrefecimento começar a contar por um aviso que ninguém recebeu.
    await auditService.recordSafe({
      actor: { actorId: null, actorName: 'Sistema', actorRole: null, companyId: null, ip: null },
      action: ACAO,
      entityType: 'Alerta',
      entityRef: assunto,
      detail: { titulo, destinatarios: para.length },
    });

    return { enviado: true, destinatarios: para.length };
  } catch (err) {
    // O trabalho que falhou já falhou. Rebentar aqui só acrescentaria um
    // segundo problema por cima do primeiro, e apagaria o registo do primeiro.
    logger.error('Não foi possível avisar do problema operacional', {
      assunto, erro: err.message,
    });
    return { enviado: false, motivo: err.message };
  }
}

module.exports = { avisarFalha, INTERVALO_MIN, ACAO };
