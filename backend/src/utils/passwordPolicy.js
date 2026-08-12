// src/utils/passwordPolicy.js
// Política de senhas. Ponto único: o mínimo, a lista de senhas proibidas e a
// regra dos perfis com poder vivem aqui, e não espalhados pelos schemas.
//
// Porquê: a plataforma guarda dinheiro de terceiros. Uma conta de COMPANY_ADMIN
// aprova ordens de compra e uma de FINANCEIRO autoriza pagamentos — 8 caracteres
// não chegam para isso. O mínimo geral também subiu: 8 é o que se pedia há dez
// anos, e hoje quebra-se por força bruta em minutos.
//
// A política aplica-se a quem DEFINE ou MUDA uma senha. Nunca ao login: quem já
// tem uma senha curta continua a entrar, e é convidado a trocá-la — bloquear o
// acesso a utilizadores existentes seria trocar um risco por uma avaria.

// Perfis que movem dinheiro ou credenciam empresas.
const PERFIS_SENSIVEIS = ['COMPANY_ADMIN', 'FINANCEIRO', 'ADMIN_SISTEMA'];

const MINIMO = 10;
const MINIMO_SENSIVEL = 12;

// As senhas mais usadas do mundo e as variantes óbvias com o nome da plataforma.
// Uma lista curta apanha a esmagadora maioria das escolhas más sem precisar de
// serviço externo nem de base de dados de fugas.
const PROIBIDAS = new Set([
  '12345678', '123456789', '1234567890', '123456789010', '12345678910',
  'password', 'password1', 'password123', 'passw0rd', 'senha123', 'senha1234',
  'qwerty123', 'qwertyuiop', 'abc123456', 'admin123', 'administrador',
  'iloveyou', 'welcome123', 'letmein123', 'sunshine1', 'football1',
  'kixima', 'kixima123', 'kixima2026', 'kixima@123', 'kiximakixima',
  'angola123', 'luanda123', 'petroleo123',
]);

function minimoPara(role) {
  return PERFIS_SENSIVEIS.includes(role) ? MINIMO_SENSIVEL : MINIMO;
}

// Sequências e repetições: "aaaaaaaaaa" ou "1234567890" têm o comprimento todo
// e nenhuma resistência.
function ePobre(senha) {
  const s = String(senha);
  if (/^(.)\1+$/.test(s)) return true;                       // um só carácter repetido
  const seq = '0123456789abcdefghijklmnopqrstuvwxyz';
  const min = s.toLowerCase();
  return seq.includes(min) || [...seq].reverse().join('').includes(min);
}

/**
 * Valida uma senha. Devolve null se serve, ou a razão pela qual não serve —
 * sempre a dizer o que fazer, não só o que está mal.
 * @param senha  a senha escolhida
 * @param role   perfil a que a conta se destina (opcional)
 * @param email  email da conta, para recusar a senha igual ao próprio email
 */
function validar(senha, { role, email } = {}) {
  const s = String(senha || '');
  const min = minimoPara(role);

  if (s.length < min) {
    return PERFIS_SENSIVEIS.includes(role)
      ? `Esta conta aprova operações com dinheiro, por isso a senha precisa de pelo menos ${min} caracteres.`
      : `A senha deve ter pelo menos ${min} caracteres.`;
  }
  if (PROIBIDAS.has(s.toLowerCase())) {
    return 'Esta senha é das mais usadas no mundo e é testada em primeiro lugar num ataque. Escolha outra.';
  }
  if (ePobre(s)) {
    return 'A senha não pode ser uma sequência nem um carácter repetido.';
  }
  if (email) {
    const local = String(email).split('@')[0].toLowerCase();
    if (local.length >= 4 && s.toLowerCase().includes(local)) {
      return 'A senha não pode conter o seu email.';
    }
  }
  return null;
}

module.exports = { validar, minimoPara, MINIMO, MINIMO_SENSIVEL, PERFIS_SENSIVEIS };
