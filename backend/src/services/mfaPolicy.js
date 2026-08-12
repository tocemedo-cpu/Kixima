// src/services/mfaPolicy.js
// Quem é obrigado a ter 2FA, e a partir de quando.
//
// O TOTP já existia e funcionava, mas era opcional para toda a gente —
// incluindo a conta que credencia empresas, gere apólices e vê os dados de
// todas as empresas da plataforma. Uma senha comprometida nessa conta chegava
// para tudo.
//
// O desenho tem um cuidado que não é óbvio: NÃO se pode simplesmente barrar o
// login de quem ainda não configurou a 2FA — configurá-la exige estar dentro da
// aplicação. Quem faz isso tranca os próprios administradores fora, e a única
// saída é mexer na base à mão. Por isso a sessão é emitida na mesma, mas fica
// RESTRITA: só dá acesso ao que é preciso para ativar a 2FA, e nada mais.
const config = require('../config/env');

// Caminhos que uma sessão restrita pode usar — o mínimo para ativar a 2FA e
// perceber porque é que o resto está bloqueado.
const PERMITIDOS = [
  /^\/api\/auth\/(me|logout|2fa\/.*)$/,
  /^\/api\/users\/profile$/,
  /^\/api\/notifications(\/|$)/,
];

function exigeMfa(role) {
  return config.auth.mfaRequiredRoles.includes(String(role || '').toUpperCase());
}

// Já passou o prazo para configurar?
function prazoEsgotado(agora = new Date()) {
  const limite = config.auth.mfaEnforceFrom;
  return Boolean(limite) && agora >= limite;
}

/**
 * Estado da 2FA para um utilizador.
 *   pendente  → devia ter 2FA e não tem (mostra-se o aviso na interface)
 *   restrita  → pendente E o prazo esgotou: a sessão só serve para ativar a 2FA
 */
function estadoPara(user, agora = new Date()) {
  const pendente = exigeMfa(user?.role) && !user?.totpEnabledAt;
  return {
    pendente,
    restrita: pendente && prazoEsgotado(agora),
    prazo: config.auth.mfaEnforceFrom,
  };
}

function caminhoPermitido(caminho) {
  return PERMITIDOS.some((p) => p.test(caminho));
}

module.exports = { exigeMfa, prazoEsgotado, estadoPara, caminhoPermitido, PERMITIDOS };
