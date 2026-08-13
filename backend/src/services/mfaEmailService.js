// src/services/mfaEmailService.js
// Verificação em dois passos por EMAIL: um código de 6 dígitos enviado para o
// endereço da pessoa.
//
// Porquê existir, ao lado do TOTP: a app de autenticação é mais segura (o
// código nasce no telemóvel, sem rede, e não passa por lado nenhum), mas obriga
// a instalar e configurar uma aplicação — e isso, na prática, faz com que a 2FA
// não seja ativada de todo. Um segundo fator que ninguém usa protege zero
// contas. O código por email é mais fraco do que o TOTP e continua a ser um
// segundo fator a sério: quem roubar a senha não entra sem aceder também à
// caixa de correio.
//
// O que NÃO é: uma segunda palavra-passe. Essa seria a mesma categoria de
// segredo que a primeira — algo que a pessoa sabe — e quem obtivesse uma pela
// via habitual (fuga, reutilização, phishing) obteria a outra do mesmo modo.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const config = require('../config/env');
const notificationService = require('./notificationService');
const emailI18n = require('../i18n/emails');
const { BusinessRuleError } = require('../utils/errors');

const VALIDADE_MINUTOS = 10;
const TENTATIVAS_MAX = 5;
const INTERVALO_REENVIO_SEGUNDOS = 60;

// 6 dígitos com aleatoriedade criptográfica. Math.random() é previsível e isto
// é uma credencial de acesso.
function gerarCodigo() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// b***o@gmail.com — confirma à pessoa para onde foi sem expor o endereço inteiro
// a quem esteja a olhar para o ecrã.
function mascarar(email) {
  const [nome, dominio] = String(email || '').split('@');
  if (!dominio) return '';
  const visivel = nome.length <= 2 ? nome[0] || '' : `${nome[0]}${'*'.repeat(Math.min(nome.length - 2, 4))}${nome[nome.length - 1]}`;
  return `${visivel}@${dominio}`;
}

/**
 * O envio de email está mesmo a funcionar?
 *
 * Esta pergunta tem de ser feita ANTES de deixar alguém ativar a 2FA por email.
 * Com EMAIL_PROVIDER=console o envio é engolido pelo log: a pessoa ativaria a
 * 2FA, sairia da sessão, e nunca mais entraria — sem erro nenhum a explicar
 * porquê. É a forma mais fácil de trancar toda a gente fora da plataforma.
 */
function porqueNaoPodeUsarEmail() {
  if (config.email.apenasLog) {
    return 'O envio de email não está configurado neste servidor (EMAIL_PROVIDER=console), '
      + 'por isso o código nunca chegaria e a conta ficaria inacessível. '
      + 'Configure o email antes de ativar a verificação por email.';
  }
  if (config.email.missing.length) {
    return `O envio de email está incompleto — faltam: ${config.email.missing.join(', ')}. `
      + 'O código não chegaria e a conta ficaria inacessível.';
  }
  return null;
}

/**
 * Gera um código, guarda-o em hash e envia-o.
 *
 * O erro do envio NÃO é engolido, ao contrário do resto da plataforma. Noutros
 * sítios faz sentido: um convite não deve deixar de ser criado porque o
 * servidor de email não respondeu. Aqui é o oposto — se o email não sai, a
 * pessoa fica à espera de um código que não existe, e tem de o saber já.
 */
async function enviarCodigo(user, { motivo = 'login', automatico = false } = {}) {
  const impedimento = porqueNaoPodeUsarEmail();
  if (impedimento) throw new BusinessRuleError(impedimento);

  const pendente = Boolean(user.mfaCodeHash)
    && user.mfaCodeExpiraEm && new Date() < new Date(user.mfaCodeExpiraEm);

  // Envio AUTOMÁTICO (o do login): se já há um código válido à espera, reaproveita-o
  // em vez de mandar outro.
  //
  // Aqui não pode haver erro nenhum. A primeira versão aplicava o travão dos 60
  // segundos também neste caminho, e o resultado era grave: quem acabasse de
  // ativar a 2FA e voltasse a entrar no minuto seguinte via o LOGIN falhar com
  // "aguarde 47 segundos" — sem forma de entrar. O travão existe para conter
  // pedidos repetidos de propósito, não para barrar quem está a autenticar-se.
  if (automatico && pendente) {
    return {
      enviadoPara: mascarar(user.email),
      expiraEm: user.mfaCodeExpiraEm,
      validadeMinutos: VALIDADE_MINUTOS,
      reaproveitado: true,
    };
  }

  // Pedido EXPLÍCITO ("enviar outro código"): trava a repetição, para não se usar
  // a plataforma para inundar a caixa de correio de alguém. Só se aplica quando
  // há mesmo um código válido a substituir — sem isso, seria um bloqueio sem
  // razão a quem está à espera do primeiro.
  if (!automatico && pendente && user.mfaCodeEnviadoEm) {
    const segundos = (Date.now() - new Date(user.mfaCodeEnviadoEm).getTime()) / 1000;
    if (segundos < INTERVALO_REENVIO_SEGUNDOS) {
      throw new BusinessRuleError(
        `Já foi enviado um código há pouco. Aguarde ${Math.ceil(INTERVALO_REENVIO_SEGUNDOS - segundos)} segundos `
        + 'antes de pedir outro — verifique também a pasta de spam.',
      );
    }
  }

  const codigo = gerarCodigo();
  const expiraEm = new Date(Date.now() + VALIDADE_MINUTOS * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaCodeHash: await bcrypt.hash(codigo, 10),
      mfaCodeExpiraEm: expiraEm,
      mfaCodeTentativas: 0,
      mfaCodeEnviadoEm: new Date(),
    },
  });

  const assunto = motivo === 'ativacao'
    ? 'Código para ativar a verificação em dois passos'
    : 'Código de acesso KIXIMA';
  const corpo = emailI18n.t(
    'O seu código é {codigo}. É válido durante {minutos} minutos e só pode ser usado uma vez. '
    + 'Se não foi você a pedi-lo, alguém sabe a sua senha — mude-a assim que puder.',
    user.locale,
    { codigo, minutos: VALIDADE_MINUTOS },
  );

  try {
    await notificationService.enviarEmailDireto(user.email, emailI18n.t(assunto, user.locale), corpo);
  } catch (err) {
    // O erro cru do fornecedor de email ("Key not found", "Sender not valid",
    // um erro de TLS) chegava à interface como "Ocorreu um erro interno" — que
    // não diz nada a quem está a tentar ativar, nem a quem tem de o resolver.
    // Aqui é dito por extenso, e o código pendente é apagado: guardá-lo seria
    // deixar a conta a apontar para um código que ninguém recebeu.
    await limpar(user.id);
    throw new BusinessRuleError(
      `Não foi possível enviar o código para ${mascarar(user.email)}: ${err.message}. `
      + 'Enquanto isto não estiver resolvido, não ative a verificação por email — ficaria sem forma de entrar.',
    );
  }
  return { enviadoPara: mascarar(user.email), expiraEm, validadeMinutos: VALIDADE_MINUTOS };
}

/**
 * Confirma o código. Devolve null se serve, ou a razão pela qual não serve.
 *
 * O código é consumido em QUALQUER desfecho: acertar gasta-o (é de uso único) e
 * esgotar as tentativas mata-o. Sem isso, dez minutos de validade dariam para
 * percorrer boa parte do milhão de combinações possíveis.
 */
async function confirmarCodigo(user, codigo) {
  const c = String(codigo || '').replace(/\D/g, '');

  if (!user.mfaCodeHash || !user.mfaCodeExpiraEm) {
    return 'Não há nenhum código pendente. Peça um código novo.';
  }
  if (new Date() > new Date(user.mfaCodeExpiraEm)) {
    await limpar(user.id);
    return `O código expirou (é válido ${VALIDADE_MINUTOS} minutos). Peça um código novo.`;
  }
  if (user.mfaCodeTentativas >= TENTATIVAS_MAX) {
    await limpar(user.id);
    return 'Demasiadas tentativas com este código. Peça um código novo.';
  }

  if (!(await bcrypt.compare(c, user.mfaCodeHash))) {
    const tentativas = user.mfaCodeTentativas + 1;
    await prisma.user.update({ where: { id: user.id }, data: { mfaCodeTentativas: tentativas } });
    const restantes = TENTATIVAS_MAX - tentativas;
    if (restantes <= 0) {
      await limpar(user.id);
      return 'Código incorreto. Foram esgotadas as tentativas — peça um código novo.';
    }
    return `Código incorreto. ${restantes} tentativa(s) antes de o código ser anulado. `
      + 'Confirme que está a usar o email mais recente — os anteriores deixaram de servir.';
  }

  await limpar(user.id);
  return null;
}

// Apaga o código pendente. Não toca no estado da 2FA.
function limpar(userId) {
  return prisma.user.update({
    where: { id: userId },
    data: { mfaCodeHash: null, mfaCodeExpiraEm: null, mfaCodeTentativas: 0 },
  });
}

module.exports = {
  enviarCodigo,
  confirmarCodigo,
  porqueNaoPodeUsarEmail,
  mascarar,
  limpar,
  VALIDADE_MINUTOS,
  TENTATIVAS_MAX,
  INTERVALO_REENVIO_SEGUNDOS,
};
