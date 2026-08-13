// src/services/mfaLembreteService.js
// Quem ainda não ativou a verificação em dois passos, e como lhes chegar.
//
// Porquê existir: a página de Prontidão dizia "8 contas de perfil ADMIN_SISTEMA
// ou COMPANY_ADMIN". Um número não se persegue. Para tirar aquele 8 até zero é
// preciso saber QUEM são, se ainda entram na plataforma, e ter forma de lhes
// pedir — sem isso, a data de entrada em vigor chega e essas oito pessoas
// descobrem-no ao serem barradas.
//
// O que este serviço NÃO faz, e não deve fazer: ativar a 2FA por outra pessoa.
// O segundo fator só vale enquanto for a própria a configurá-lo; um
// administrador que o fizesse por ela ficaria com o controlo dos dois fatores,
// e deixava de haver dois.
const prisma = require('../config/database');
const config = require('../config/env');
const notificationService = require('./notificationService');
const mfaEmail = require('./mfaEmailService');
const emailI18n = require('../i18n/emails');
const { BusinessRuleError } = require('../utils/errors');

// Não se insiste com a mesma pessoa todos os dias: isso ensina-a a ignorar.
const INTERVALO_LEMBRETE_HORAS = 24;

const ACOES_LOGIN = ['LOGIN_SUCESSO', 'LOGIN_2FA_PEDIDO'];
const ACAO_LEMBRETE = 'MFA_LEMBRETE_ENVIADO';

// Último registo de cada ator, para um conjunto de ações. Uma consulta só —
// não uma por pessoa.
async function ultimoPorAtor(actorIds, acoes) {
  if (!actorIds.length) return new Map();
  const linhas = await prisma.auditLog.groupBy({
    by: ['actorId'],
    where: { actorId: { in: actorIds }, action: { in: acoes } },
    _max: { createdAt: true },
  });
  return new Map(linhas.map((l) => [l.actorId, l._max.createdAt]));
}

/**
 * As contas com poder que ainda não têm 2FA.
 *
 * Traz o último login porque muda o que se faz a seguir: quem entra todas as
 * semanas só precisa de um empurrão; quem não entra há meses pode ser uma conta
 * que já ninguém usa — e essa desativa-se, em vez de se andar atrás dela.
 */
async function pendentes() {
  const users = await prisma.user.findMany({
    where: {
      role: { in: config.auth.mfaRequiredRoles },
      active: true,
      totpEnabledAt: null,
    },
    select: {
      id: true, name: true, email: true, role: true, locale: true, createdAt: true,
      company: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });

  const ids = users.map((u) => u.id);
  const [logins, lembretes] = await Promise.all([
    ultimoPorAtor(ids, ACOES_LOGIN),
    ultimoPorAtor(ids, [ACAO_LEMBRETE]),
  ]);

  return users.map((u) => ({
    id: u.id,
    nome: u.name,
    email: u.email,
    perfil: u.role,
    empresa: u.company?.name || null,
    criadaEm: u.createdAt,
    ultimoLogin: logins.get(u.id) || null,
    ultimoLembrete: lembretes.get(u.id) || null,
  }));
}

function podeSerLembrado(ultimoLembrete) {
  if (!ultimoLembrete) return true;
  return (Date.now() - new Date(ultimoLembrete).getTime()) / 36e5 >= INTERVALO_LEMBRETE_HORAS;
}

// Texto do lembrete. O prazo entra na mensagem quando existe: "é obrigatório"
// sem data é um pedido; com data é uma consequência.
function corpoDoLembrete(locale) {
  const prazo = config.auth.mfaEnforceFrom;
  const base = emailI18n.t(
    'A sua conta KIXIMA aprova operações com dinheiro, por isso a senha deixou de bastar. '
    + 'Falta ativar a verificação em dois passos.',
    locale,
  );
  const como = emailI18n.t(
    'Entre na plataforma e vá a Configurações → Segurança. Demora menos de um minuto: '
    + 'enviamos-lhe um código por email e é só confirmá-lo.',
    locale,
  );
  if (!prazo) return `${base}\n\n${como}`;

  const data = new Date(prazo).toISOString().slice(0, 10);
  const consequencia = emailI18n.t(
    'A partir de {data}, sem isto configurado a sua conta só dá acesso ao ecrã de ativação — '
    + 'não conseguirá aprovar ordens nem consultar o resto da plataforma.',
    locale,
    { data },
  );
  return `${base}\n\n${consequencia}\n\n${como}`;
}

/**
 * Envia o lembrete às contas indicadas (ou a todas as pendentes).
 *
 * Devolve o que aconteceu a cada uma, em vez de um "ok" — quem carrega no botão
 * precisa de saber a quem chegou e a quem não chegou, e porquê.
 */
async function enviarLembretes({ userIds = null, actor } = {}) {
  const impedimento = mfaEmail.porqueNaoPodeUsarEmail();
  if (impedimento) throw new BusinessRuleError(impedimento);

  const todas = await pendentes();
  const alvo = userIds ? todas.filter((u) => userIds.includes(u.id)) : todas;
  if (!alvo.length) {
    return { enviados: [], ignorados: [], falhas: [], total: 0 };
  }

  const enviados = [];
  const ignorados = [];
  const falhas = [];

  for (const u of alvo) {
    if (!podeSerLembrado(u.ultimoLembrete)) {
      ignorados.push({ email: u.email, motivo: 'Já foi lembrado nas últimas 24 horas.' });
      continue;
    }
    try {
      await notificationService.enviarEmailDireto(
        u.email,
        emailI18n.t('Falta ativar a verificação em dois passos', u.locale),
        corpoDoLembrete(u.locale),
      );
      // O envio fica no trilho: é o que permite saber quando cada pessoa foi
      // avisada, e não insistir com ela no dia seguinte.
      await prisma.auditLog.create({
        data: {
          action: ACAO_LEMBRETE,
          entityType: 'User',
          entityId: u.id,
          entityRef: u.email,
          actorId: u.id,           // o registo é SOBRE esta conta
          actorName: actor?.actorName || 'Sistema',
          detail: { pedidoPor: actor?.actorId || null },
        },
      });
      enviados.push({ email: u.email, nome: u.nome });
    } catch (err) {
      // Um lembrete que não sai tem de se ver. Continuar para os restantes é o
      // certo — um endereço inválido não pode impedir os outros sete.
      falhas.push({ email: u.email, erro: String(err.message).slice(0, 200) });
    }
  }

  return { enviados, ignorados, falhas, total: alvo.length };
}

module.exports = { pendentes, enviarLembretes, INTERVALO_LEMBRETE_HORAS };
