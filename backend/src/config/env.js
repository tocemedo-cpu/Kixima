// src/config/env.js
// Ponto único de leitura do ambiente. Todo o resto do código deve importar
// a config a partir daqui, nunca ler process.env diretamente noutro sítio.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NODE_ENV = process.env.NODE_ENV || 'development';

// Chave privada RSA (PEM) da AGT — lida de um ficheiro local em vez de uma
// variável de ambiente em Base64, quando esse ficheiro existe. src/chave/ está
// no .gitignore (nunca é comitado); o ficheiro em si tem sempre de ser posto
// aqui manualmente, nunca gerado nem inventado por código.
const CAMINHO_CHAVE_PRIVADA_AGT = path.join(__dirname, '../chave/chavePrivada.pem');

// Render "Secret Files" monta o ficheiro em /etc/secrets/<nome> — o caminho
// RECOMENDADO em produção. AGT_JWS_PRIVATE_KEY_BASE64 tem ~2300 caracteres, e
// já se confirmou na prática (erro OpenSSL "DECODER routines::unsupported",
// que é exatamente o que dá com um PEM cortado a meio) que pelo menos um
// painel de variáveis corta valores desse tamanho sem avisar. Um Secret File
// não tem esse limite — o PEM vai tal e qual, sem Base64 nenhum.
//
// Dois nomes aceites: "chavePrivada.pem" (o RECOMENDADO, documentado no
// .env.example/render.yaml) e "AGT_JWS_PRIVATE_KEY_BASE64" (caso real
// confirmado: dar ao Secret File o mesmo nome da variável de ambiente é um
// erro fácil de cometer — o painel do Render não distingue os dois conceitos
// visualmente). Comprido de propósito para o segundo nome não confundir com
// a própria variável de ambiente (lida à parte, antes disto).
const CAMINHOS_SECRET_FILE_RENDER = [
  '/etc/secrets/chavePrivada.pem',
  '/etc/secrets/AGT_JWS_PRIVATE_KEY_BASE64',
];

function lerFicheiroChave(caminho) {
  try {
    return fs.readFileSync(caminho, 'utf8');
  } catch {
    return '';
  }
}

// Um PEM válido tem sempre uma linha de abertura E uma linha de fecho
// completas (as 5 marcações "-----" nos dois lados) — verificar isto é o
// mínimo para distinguir "chave real" de "valor cortado/corrompido". Um
// truncamento que corta só os últimos bytes deixa o "-----END" a aparecer
// (é `includes('-----END')` sozinho que falha em apanhar isto — o texto
// "-----END PRI" já contém esse substring, sem ser um PEM válido); exigir
// o fecho completo "-----END ...-----" apanha esse caso. Não confirma que a
// chave é criptograficamente válida (só o crypto.sign faz isso), só que não
// é lixo óbvio de um Base64 truncado.
function pareceUmPem(texto) {
  return /-----BEGIN [A-Z ]+-----/.test(texto) && /-----END [A-Z ]+-----/.test(texto);
}

// crypto.createPrivateKey confirma a ESTRUTURA da chave (não só as marcações
// -----BEGIN/END-----, que pareceUmPem já verifica) — apanha corrupção NO
// MEIO do PEM (fences intactas, conteúdo Base64 interno danificado) que a
// regex sozinha deixa passar. Nunca assina nada, só valida; nunca lança —
// devolve true/false, para quem chama decidir o que fazer.
function chaveDecodificaComoRSA(pem) {
  try {
    crypto.createPrivateKey(pem);
    return true;
  } catch {
    return false;
  }
}

// Um candidato só serve se tiver as marcações E decodificar como chave a
// sério — aplicado a todas as fontes por igual (variável, cada Secret File,
// ficheiro local), para nenhuma delas passar conteúdo corrompido ao
// crypto.sign em silêncio.
function candidatoValido(texto) {
  return Boolean(texto) && pareceUmPem(texto) && chaveDecodificaComoRSA(texto);
}

// O conteúdo de um FICHEIRO (Secret File ou local) pode legitimamente ser o
// PEM tal e qual (o caminho pretendido) OU o mesmo texto em Base64 (caso
// real confirmado: um Secret File chamado "AGT_JWS_PRIVATE_KEY_BASE64" que
// continha o valor Base64 como conteúdo, não o PEM diretamente — o nome do
// ficheiro sugere que quem o criou copiou o valor pensando ainda estar a
// preencher a variável de ambiente). Tenta as duas leituras, devolve a que
// for válida.
function interpretarConteudoFicheiro(conteudo) {
  if (candidatoValido(conteudo)) return conteudo;
  const decodificado = Buffer.from(conteudo, 'base64').toString('utf8');
  if (candidatoValido(decodificado)) return decodificado;
  return '';
}

function lerChavePrivadaAgt() {
  const base64 = String(process.env.AGT_JWS_PRIVATE_KEY_BASE64 || '').trim();
  if (base64) {
    const decodificado = Buffer.from(base64, 'base64').toString('utf8');
    if (candidatoValido(decodificado)) return decodificado;
    // Presente mas não é uma chave privada válida — o painel de variáveis
    // cortou o valor (caso confirmado) ou o conteúdo está corrompido. Nunca
    // passar isto ao crypto.sign (produz um erro OpenSSL sem contexto
    // nenhum) — cai para as próximas fontes, em vez de usar um valor já
    // confirmado como inválido.
  }
  for (const caminho of CAMINHOS_SECRET_FILE_RENDER) {
    const conteudo = lerFicheiroChave(caminho);
    if (conteudo) {
      const valido = interpretarConteudoFicheiro(conteudo);
      if (valido) return valido;
    }
  }
  const doFicheiroLocal = lerFicheiroChave(CAMINHO_CHAVE_PRIVADA_AGT);
  if (doFicheiroLocal) {
    const valido = interpretarConteudoFicheiro(doFicheiroLocal);
    if (valido) return valido;
  }
  return '';
}

// Mesma lógica de lerChavePrivadaAgt(), mas devolve DE ONDE veio (ou porque
// nenhuma fonte serviu) em vez do conteúdo — para se poder ver isto no painel
// de Prontidão (visível a qualquer Admin do Sistema, sem precisar de Shell no
// hosting, que em planos gratuitos nem sequer existe). Nunca inclui a chave.
function diagnosticoChavePrivadaAgt() {
  const base64 = String(process.env.AGT_JWS_PRIVATE_KEY_BASE64 || '').trim();
  if (base64) {
    const decodificado = Buffer.from(base64, 'base64').toString('utf8');
    if (candidatoValido(decodificado)) {
      return { fonte: 'variável de ambiente (AGT_JWS_PRIVATE_KEY_BASE64)', tamanhoBase64: base64.length };
    }
    const motivo = !pareceUmPem(decodificado)
      ? 'não decodifica para um PEM (faltam as linhas -----BEGIN/END-----; provável corte pelo painel de variáveis)'
      : 'tem as linhas -----BEGIN/END----- mas o conteúdo não é uma chave privada válida (corrupção a meio do valor)';
    return {
      fonte: `AGT_JWS_PRIVATE_KEY_BASE64 está definida (${base64.length} caracteres) MAS INVÁLIDA — ${motivo}`,
      tamanhoBase64: base64.length,
      invalida: true,
    };
  }
  for (const caminho of CAMINHOS_SECRET_FILE_RENDER) {
    const conteudo = lerFicheiroChave(caminho);
    if (conteudo) {
      return interpretarConteudoFicheiro(conteudo)
        ? { fonte: `Secret File (${caminho})` }
        : { fonte: `Secret File (${caminho}) existe MAS não é uma chave privada válida (nem como PEM, nem como Base64)`, invalida: true };
    }
  }
  const doFicheiroLocal = lerFicheiroChave(CAMINHO_CHAVE_PRIVADA_AGT);
  if (doFicheiroLocal) {
    return interpretarConteudoFicheiro(doFicheiroLocal)
      ? { fonte: `ficheiro local (${CAMINHO_CHAVE_PRIVADA_AGT})` }
      : { fonte: `ficheiro local (${CAMINHO_CHAVE_PRIVADA_AGT}) existe MAS não é uma chave privada válida`, invalida: true };
  }
  return { fonte: 'nenhuma (nem variável, nem Secret File, nem ficheiro local)' };
}

/**
 * Limpa um valor colado no painel do Render.
 *
 * O painel guarda o que lá for posto, LITERALMENTE, e a colagem traz lixo com
 * uma regularidade que já não é acidente: aspas agarradas ao exemplo
 * (`"2026-09-15T00:00:00Z"`), espaços à volta, e o próprio rótulo do formulário
 * copiado com o valor —
 *
 *     Value:
 *     2026-09-15T00:00:00Z
 *
 * Nenhum destes valores é uma data, um cron ou uma chave; todos parecem certos
 * a quem olha para o painel. Como nenhuma destas definições é multi-linha, fica
 * a última linha com conteúdo — que é sempre o valor de facto.
 */
function limpar(valor) {
  const linhas = String(valor ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const ultima = linhas.length ? linhas[linhas.length - 1] : '';
  return ultima.replace(/^["']|["']$/g, '').trim();
}

// O valor foi mesmo alterado pela limpeza? Serve para o assinalar em vez de o
// corrigir em silêncio — quem definiu a variável deve arrumá-la.
function precisouDeLimpeza(valor) {
  const cru = String(valor ?? '');
  return Boolean(cru) && cru !== limpar(cru);
}

// Data vinda do ambiente, ou null se não existir/não for uma data.
function dataDoAmbiente(valor) {
  const limpo = limpar(valor);
  if (!limpo) return null;
  const d = new Date(limpo);
  return Number.isNaN(d.getTime()) ? null : d;
}

// O valor original, quando existe mas não é uma data — para se poder dizer
// PORQUÊ, em vez de o ignorar em silêncio.
function dataInvalida(valor) {
  const limpo = limpar(valor);
  if (!limpo) return null;
  return Number.isNaN(new Date(limpo).getTime()) ? String(valor) : null;
}

const required = ['DATABASE_URL', 'JWT_SECRET'];

// Valores de exemplo que vivem em ficheiros VERSIONADOS (.env.example) —
// nunca segredos reais. 'CHANGE_ME' já era recusado; um deploy real já
// aconteceu a copiar o .env.example inteiro para produção e esquecer só de
// trocar ESTE valor, porque nenhuma das outras variáveis aí é tão fácil de
// deixar passar (as outras, sem valor, falham logo a ligar a algo). Se isso
// acontecer, a app arranca normalmente com um segredo público no
// repositório — dá para forjar um JWT de qualquer utilizador, incluindo
// Admin do Sistema, sem senha nem 2FA (ver middleware/auth.js).
const JWT_SECRET_PLACEHOLDERS = new Set(['change_me', 'troque-este-valor', 'changeme', 'change-me']);
const JWT_SECRET_MIN_LENGTH = 32; // ~256 bits em base64/hex — o mínimo razoável para HS256

function jwtSecretFraco(valor) {
  if (!valor) return null; // vazio já cai em `missing`, não se repete aqui
  if (JWT_SECRET_PLACEHOLDERS.has(valor.toLowerCase())) {
    return 'ainda tem o valor de exemplo do .env.example — troque por um segredo real';
  }
  if (valor.length < JWT_SECRET_MIN_LENGTH) {
    return `tem só ${valor.length} caracteres — use pelo menos ${JWT_SECRET_MIN_LENGTH}, gerados aleatoriamente`;
  }
  return null;
}

if (NODE_ENV === 'production') {
  const missing = required.filter((key) => !process.env[key] || process.env[key] === 'CHANGE_ME');
  const motivoFraco = !missing.includes('JWT_SECRET') ? jwtSecretFraco(process.env.JWT_SECRET) : null;
  if (missing.length || motivoFraco) {
    const motivos = [...missing];
    if (motivoFraco) motivos.push(`JWT_SECRET (${motivoFraco})`);
    throw new Error(
      `Configuração em falta ou insegura para produção: ${motivos.join(', ')}. Verifique .env.production.`
    );
  }
}

const config = {
  env: NODE_ENV,
  isProduction: NODE_ENV === 'production',
  isDevelopment: NODE_ENV === 'development',
  isTest: NODE_ENV === 'test',

  port: Number(process.env.PORT) || 4000,
  appUrl: process.env.APP_URL || 'http://localhost:4000',

  database: {
    url: process.env.DATABASE_URL,
    // Pooler de SESSÃO (porta 5432). As migrações e o pg_dump da cópia de
    // segurança precisam de uma sessão estável — nenhum dos dois funciona
    // através do pooler de transação.
    directUrl: process.env.DIRECT_URL,
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET,
    // Validade curta do access token (revogável via tokenVersion). 1 dia é um
    // compromisso entre segurança e não obrigar a login constante.
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',

    // --- 2FA obrigatória ------------------------------------------------------
    // Perfis para quem a senha não basta: aprovam ordens de compra, autorizam
    // pagamentos e credenciam empresas. Uma senha comprometida numa destas
    // contas chega para tudo.
    mfaRequiredRoles: (process.env.MFA_REQUIRED_ROLES || 'ADMIN_SISTEMA,COMPANY_ADMIN')
      .split(',').map((r) => r.trim().toUpperCase()).filter(Boolean),
    // A partir desta data a 2FA deixa de ser um aviso e passa a ser exigida.
    // Antes dela, quem ainda não a configurou entra na mesma e é avisado — dar
    // prazo é o que evita trancar administradores fora no dia do lançamento.
    // Sem a variável definida, fica só o aviso (nunca bloqueia).
    //
    // O valor é validado aqui, e não onde é usado, porque uma data inválida
    // falhava do PIOR modo possível: `new Date("lixo")` devolve um objeto que é
    // truthy, mas cuja comparação com qualquer data dá SEMPRE false. A 2FA
    // deixava de ser exigida sem nada o denunciar — e a variável, no painel,
    // parecia estar lá.
    mfaEnforceFrom: dataDoAmbiente(process.env.MFA_ENFORCE_FROM),
    // Guardado para o arranque e a página de Prontidão poderem dizer o que está
    // errado, em vez de a definição ser ignorada em silêncio.
    mfaEnforceFromInvalido: dataInvalida(process.env.MFA_ENFORCE_FROM),
  },

  // Regras de negócio — configuráveis por ambiente, nunca hardcoded no código.
  business: {
    paymentSlaDays: Number(process.env.PAYMENT_SLA_DAYS) || 7,
    policyExpiryAlertDays: Number(process.env.POLICY_EXPIRY_ALERT_DAYS) || 30,
    // Câmbio USD→AOA usado para aferir o limiar da Taxa KIXIMA (as taxas são
    // em dólares; as POs em Kwanzas). Configurável — o Kwanza flutua.
    usdAoaRate: Number(process.env.KIXIMA_USD_AOA_RATE) || 900,
  },

  email: {
    // 'console' (log), 'smtp' (nodemailer) ou 'brevo' (API HTTP do Brevo —
    // usa a porta 443, imune ao bloqueio de portas SMTP de saída no Render).
    provider: process.env.EMAIL_PROVIDER || 'console',
    from: process.env.EMAIL_FROM || 'notificacoes@kixima.co.ao',
    brevoApiKey: process.env.BREVO_API_KEY,
    smtp: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
    },
  },

  storage: {
    // 'local' (disco, por omissão) ou 's3' (AWS S3 / Supabase Storage / R2 / MinIO).
    provider: process.env.STORAGE_PROVIDER || 'local',
    bucket: process.env.STORAGE_BUCKET,
    region: process.env.STORAGE_REGION,
    accessKey: process.env.STORAGE_ACCESS_KEY,
    secretKey: process.env.STORAGE_SECRET_KEY,
    // Endpoint S3-compatível (ex.: Supabase Storage, R2, MinIO). Vazio = AWS S3.
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    // URL público base para servir as imagens (CDN / bucket público). Se vazio,
    // é construído a partir do endpoint/bucket ou do host AWS.
    publicUrl: process.env.STORAGE_PUBLIC_URL || undefined,
    // Bucket SEPARADO para as cópias de segurança. O bucket das imagens tem de
    // ser público (é dele que o marketplace serve as fotos do catálogo) — e um
    // dump da base guardado num bucket público fica descarregável por quem
    // souber o URL, com hashes de senha, dados de todas as empresas e o
    // histórico financeiro lá dentro. Sem esta variável a cópia automática
    // recusa-se a correr.
    backupBucket: process.env.STORAGE_BACKUP_BUCKET,
    // path-style é necessário para a maioria dos S3-compatíveis (Supabase/MinIO).
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE
      ? process.env.STORAGE_FORCE_PATH_STYLE === 'true'
      : Boolean(process.env.STORAGE_ENDPOINT),
  },

  logLevel: process.env.LOG_LEVEL || 'info',

  // Rastreio de erros (Sentry) — inativo se SENTRY_DSN não estiver definido.
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    // Amostragem de performance (0 = desligado). Erros são sempre capturados.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
  },

  // Faturação certificada (AGT).
  //
  // A série de faturação é POR EMPRESA FORNECEDORA (Company.serieFiscal), não
  // uma variável de ambiente global — cada fornecedor é o emitente fiscal das
  // suas próprias faturas (a KIXIMA nunca compra para revender, só garante o
  // pagamento). Sem essa série declarada na empresa, as faturas continuam a
  // ser emitidas como sempre foram — sem número nem hash — e distinguem-se por
  // `serie IS NULL`. Ver faturacaoService.serieFiscalDoFornecedor().
  //
  // O que fica aqui é só o que É da KIXIMA: a identidade de FABRICANTE do
  // software certificado (ProductCompanyTaxID/SoftwareCertificateNumber no
  // SAF-T) — distinta do CompanyID de cada documento, que é do fornecedor.
  faturacao: {
    nif: process.env.KIXIMA_NIF || '',
    // Atribuído pela AGT ao programa, no fim do processo de certificação.
    certificadoAgt: process.env.KIXIMA_CERTIFICADO_AGT || '',
  },

  // Payload de submissão AGT (e-Fatura, schema v1.2) — assinatura JWS/RS256.
  // Distinto de `faturacao` acima: aquele identifica a KIXIMA no SAF-T
  // (exportação manual); isto assina o payload JSON que provaria a origem do
  // documento perante a AGT. Sem a chave e o número de validação REAIS, o
  // agtSigningService recusa-se a assinar — ver a nota "RECUSA-SE A FINGIR"
  // em multicaixaService.js, o mesmo princípio aplicado aqui.
  agt: {
    // Ver lerChavePrivadaAgt() acima: AGT_JWS_PRIVATE_KEY_BASE64 (produção,
    // painéis de variáveis de ambiente) ou src/chave/chavePrivada.pem
    // (desenvolvimento local, ficheiro real, nunca comitado).
    jwsPrivateKeyPem: lerChavePrivadaAgt(),
    softwareId: process.env.AGT_SOFTWARE_ID || 'KIXIMA',
    softwareVersion: process.env.AGT_SOFTWARE_VERSION || process.env.npm_package_version || '1.0',
    // Atribuído pela AGT ao software, no fim da certificação (formato
    // "FE/NN/AAAA/AGT"). Sem ele não há payload assinado — nunca um valor
    // inventado num documento que se apresenta como fiscalmente válido.
    softwareValidationNumber: process.env.AGT_SOFTWARE_VALIDATION_NUMBER || '',
    // NIF do titular da conta de homologação/produção da AGT (a mesma
    // identidade fiscal de AGT_SANDBOX_USERNAME/PASSWORD abaixo) — usado em
    // "Solicitar Série" (agt-serie-payload), que pede uma série de numeração
    // para essa conta, não para uma empresa fornecedora à escolha. Nunca um
    // valor por omissão: sem ele, a rota recusa-se a gerar o pedido.
    taxRegistrationNumber: process.env.AGT_NIF || '',
    // Código do estabelecimento atribuído pelo contribuinte NA AGT — não um
    // valor arbitrário nem um índice inventado no código. Erro real já visto
    // com um valor fixo ("1") que nunca tinha sido confirmado junto da AGT:
    // "E99 — O estabelecimento com o código 1 não se encontra registado para
    // o contribuinte identificado pelo NIF ...". Fica vazio até alguém com
    // acesso ao portal da AGT confirmar o código correto para o NIF de
    // AGT_NIF acima — RECUSA-SE A FINGIR, nunca um valor adivinhado por
    // tentativa. Única fonte usada por TODAS as requisições AGT que
    // precisam dele (hoje só "Solicitar Série" — ver ESTABELECIMENTO em
    // faturacaoRoutes.js e scripts/agt-solicitar-serie.js).
    establishmentNumber: process.env.AGT_ESTABLISHMENT_NUMBER || '',

    // Ligação REST à Sandbox/homologação e produção da AGT
    // (agtSandboxClient.js) — autenticação por HTTP Basic (utilizador/senha),
    // sem OAuth2. Distinta do envelope schema v1.2 acima: são os 6 endpoints
    // de registo/consulta em tempo real, não a submissão em lote. Nunca um
    // valor por omissão aqui — sem os 2 preenchidos, o cliente recusa-se a
    // chamar a AGT. Os URLs em si (por ambiente hml/prd) vêm de
    // config/agt.js, escolhidos por AGT_ENV — não há aqui uma base
    // configurável por variável de ambiente.
    sandboxUsername: process.env.AGT_SANDBOX_USERNAME || '',
    sandboxPassword: process.env.AGT_SANDBOX_PASSWORD || '',
  },
  // Recomendação em linguagem natural do Category Management (economia de
  // escala) — chamada real à API da Claude. Sem chave, aiRecommendationService
  // devolve a análise numérica na mesma (thresholds/poupança continuam a
  // funcionar) mas a recomendação em texto vem null com o motivo explícito —
  // mesmo princípio "RECUSA-SE A FINGIR" do multicaixaService.js: nunca um
  // texto de IA fabricado.
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  },
  versao: process.env.npm_package_version || '1.0',
};

// Variáveis obrigatórias quando o armazenamento é S3-compatível. Uma string
// vazia conta como ausente: no painel do Render é fácil criar a variável e
// deixá-la por preencher, e o SDK só se queixa (mal) na hora do upload.
const STORAGE_REQUIRED = {
  STORAGE_BUCKET: config.storage.bucket,
  STORAGE_ACCESS_KEY: config.storage.accessKey,
  STORAGE_SECRET_KEY: config.storage.secretKey,
};
// Configuração de email em falta. Sem provider definido, TUDO o que é email
// fica só no log — convites, recuperação de senha, aviso de fatura pendente,
// confirmação de candidatura — e o utilizador não vê erro nenhum: simplesmente
// nunca recebe nada. É a falha mais silenciosa que a plataforma pode ter.
const EMAIL_REQUIRED = {
  brevo: { BREVO_API_KEY: config.email.brevoApiKey },
  'brevo-api': { BREVO_API_KEY: config.email.brevoApiKey },
  smtp: { SMTP_HOST: config.email.smtp.host, SMTP_USER: config.email.smtp.user, SMTP_PASSWORD: config.email.smtp.password },
};
config.email.missing = Object.entries(EMAIL_REQUIRED[config.email.provider] || {})
  .filter(([, v]) => !String(v || '').trim())
  .map(([k]) => k);
// 'console' não é um provider a sério: escreve no log e segue.
config.email.apenasLog = config.email.provider === 'console';

config.storage.missing =
  config.storage.provider === 's3'
    ? Object.entries(STORAGE_REQUIRED).filter(([, v]) => !String(v || '').trim()).map(([k]) => k)
    : [];

// Em modo 'local' (disco do contentor), os ficheiros carregados — documentos
// de credenciamento, comprovativos de pagamento, e até as CÓPIAS DE
// SEGURANÇA da própria base (ver backupJob.js) — desaparecem a cada
// reinício/deploy do Render, sem aviso a quem carregou. Isto já aconteceu em
// produção sem ninguém dar por isso, porque storageService.js só regista um
// erro e continua a servir do disco em vez de recusar o upload — falhar o
// ARRANQUE é a única forma de uma má configuração de storage não voltar a
// passar despercebida.
if (NODE_ENV === 'production' && (config.storage.provider !== 's3' || config.storage.missing.length)) {
  const motivo = config.storage.provider !== 's3'
    ? 'STORAGE_PROVIDER não está definido como "s3"'
    : `STORAGE_PROVIDER=s3 mas faltam credenciais: ${config.storage.missing.join(', ')}`;
  throw new Error(
    `Armazenamento inseguro para produção — ${motivo}. Configure o Supabase Storage (ou outro `
    + 'S3-compatível) e defina STORAGE_PROVIDER=s3, STORAGE_BUCKET, STORAGE_ACCESS_KEY, '
    + 'STORAGE_SECRET_KEY. Verifique em Admin do Sistema → Configurações e Suporte → Prontidão '
    + 'para produção.',
  );
}

// Exportado para as poucas definições lidas fora daqui (BACKUP_CRON é lida no
// momento do agendamento, não no arranque) poderem passar pela mesma limpeza.
config.limparValor = limpar;
config.precisouDeLimpeza = precisouDeLimpeza;
// Ver diagnosticoChavePrivadaAgt() acima — chamada sob pedido (não no
// arranque, porque decodifica Base64 e valida a chave a cada chamada; usada
// só pelo painel de Prontidão e por scripts/agt-diagnostico.js).
config.diagnosticoChavePrivadaAgt = diagnosticoChavePrivadaAgt;

module.exports = config;
