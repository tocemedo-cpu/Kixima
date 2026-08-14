// src/app.js
// Monta a aplicação Express. Não chama .listen() aqui — isso é feito em server.js
// para que os testes possam importar `app` sem abrir uma porta real.

require('express-async-errors');
// Inicializa o Sentry o mais cedo possível (no-op se SENTRY_DSN não estiver
// definido). Antes dos outros requires para instrumentar o máximo possível.
require('./config/sentry');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config/env');
const prisma = require('./config/database');
const logger = require('./config/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { apiLimiter, authLimiter, sensitiveLimiter } = require('./middleware/rateLimit');

const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const poRoutes = require('./routes/poRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const policyRoutes = require('./routes/policyRoutes');
const contractRoutes = require('./routes/contractRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const apiCatalogoRoutes = require('./routes/apiCatalogoRoutes');
const planosRoutes = require('./routes/planosRoutes');
const kitRoutes = require('./routes/kitRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const buyerRoutes = require('./routes/buyerRoutes');
const userRoutes = require('./routes/userRoutes');
const supportRoutes = require('./routes/supportRoutes');
const supplierDevRoutes = require('./routes/supplierDevRoutes');
const companyAdminRoutes = require('./routes/companyAdminRoutes');
const financeiroRoutes = require('./routes/financeiroRoutes');
const adminRoutes = require('./routes/adminRoutes');
const integrationRoutes = require('./routes/integrationRoutes');

const app = express();

// Atrás do proxy do Render (TLS terminado no edge): confia no 1.º hop para que
// req.ip reflita o cliente real (usado pelo rate limiting).
app.set('trust proxy', 1);

// crossOriginResourcePolicy: cross-origin para as imagens carregadas poderem
// ser servidas ao frontend (dev noutra porta) sem bloqueio do helmet.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: em produção o SPA é servido na mesma origem, por isso restringimos a
// uma allow-list (APP_URL + CORS_ORIGINS). Em desenvolvimento permitimos tudo
// para o servidor Vite (noutra porta) poder chamar a API.
const corsAllowList = [config.appUrl, ...String(process.env.CORS_ORIGINS || '').split(',')]
  .map((s) => (s || '').trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);            // same-origin, curl, apps móveis
    if (config.isDevelopment || config.isTest) return cb(null, true);
    if (corsAllowList.includes(origin)) return cb(null, true);
    // Origem não autorizada: não erra (não quebra pedidos same-origin que
    // enviam Origin em POST); apenas não devolve o cabeçalho ACAO, pelo que o
    // browser bloqueia a resposta cross-origin.
    return cb(null, false);
  },
  credentials: false,
}));
// Guarda o corpo bruto (rawBody) para verificação de assinatura HMAC dos
// callbacks de integração; não altera o comportamento normal do parser.
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

// Imagens de produtos no modo de armazenamento 'local' (em S3 são servidas
// diretamente pelo URL público do bucket).
const { uploadsDir } = require('./services/storageService');
app.use('/api/uploads', express.static(uploadsDir));
if (!config.isTest) {
  app.use(morgan(config.isDevelopment ? 'dev' : 'combined'));
}

// Liveness — o processo está de pé. Não toca na base: serve para o orquestrador
// saber se deve reiniciar o contentor, e uma base em baixo não se cura com isso.
app.get('/health', (req, res) => res.json({ status: 'ok', env: config.env }));

// Readiness — o serviço consegue mesmo servir pedidos. A falha mais provável não
// é o processo morrer, é a base ficar inacessível; sem esta verificação o Render
// continuava a encaminhar tráfego para uma aplicação que rebentava em tudo.
app.get('/ready', async (req, res) => {
  const inicio = Date.now();
  try {
    // Timeout curto: um health check que fica pendurado é tão mau como um que mente.
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ao contactar a base de dados')), 3000)),
    ]);
    res.json({ status: 'ok', database: 'ok', latencyMs: Date.now() - inicio, env: config.env });
  } catch (err) {
    logger.error('Readiness: base de dados inacessível', { erro: err.message });
    res.status(503).json({
      status: 'degradado',
      database: 'inacessivel',
      detail: err.message,
      latencyMs: Date.now() - inicio,
    });
  }
});

// Rate limiting: limite geral em toda a API + limites apertados nos endpoints
// sensíveis (login e fluxos públicos de registo/convite).
app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/companies/register', sensitiveLimiter);
app.use('/api/companies/invite', sensitiveLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/purchase-orders', poRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/supplier-development', supplierDevRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportsRoutes);

// API pública de catálogo (plano Pro), autenticada por CHAVE e não por sessão.
// Fica FORA do apiLimiter e do bloco autenticado por JWT de propósito: tem o seu
// próprio limite por chave e as suas próprias regras. Versionada em /v1 desde o
// primeiro dia — quem integra um sistema com isto não pode acordar com os
// campos mudados.
app.use('/api/v1/catalogo', apiCatalogoRoutes);

// Tabela de planos e preços — pública, para a página de preços não ter os
// números escritos à mão.
app.use('/api/planos', planosRoutes);
app.use('/api/kits', kitRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/buyer', buyerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/company-admin', companyAdminRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/integration', integrationRoutes);

// Servir o frontend compilado (deploy de serviço único). Em produção a app
// serve a API em /api e o SPA na mesma origem. O caminho pode vir de
// FRONTEND_DIST; se não estiver definido, tentamos localizar frontend/dist
// automaticamente (relativo a este ficheiro), para que o serviço funcione mesmo
// quando a variável não foi configurada no painel do Render.
const fs = require('fs');

function resolveFrontendDist() {
  const candidates = [];
  if (process.env.FRONTEND_DIST) candidates.push(path.resolve(process.env.FRONTEND_DIST));
  // Sobe alguns níveis a partir deste ficheiro e do cwd à procura de
  // frontend/dist — cobre qualquer layout de deploy (Root Directory, etc.).
  const roots = [__dirname, process.cwd()];
  for (const r of roots) {
    for (let up = 0; up <= 4; up++) {
      const base = path.resolve(r, '../'.repeat(up) || './');
      candidates.push(path.join(base, 'frontend', 'dist'));
      candidates.push(path.join(base, 'dist'));
    }
  }
  const checked = [];
  for (const dir of candidates) {
    const ok = dir && fs.existsSync(path.join(dir, 'index.html'));
    checked.push(`${ok ? '✓' : '✗'} ${dir}`);
    if (ok) return { dir, checked };
  }
  return { dir: null, checked };
}

const { dir: frontendDist, checked: distChecked } = resolveFrontendDist();
if (frontendDist) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    return res.sendFile(path.join(frontendDist, 'index.html'));
  });
  if (!config.isTest) console.log(`[kixima] A servir o frontend (SPA) a partir de: ${frontendDist}`);
} else if (!config.isTest) {
  console.warn(
    '[kixima] Frontend compilado não encontrado — apenas a API responde.\n' +
    `[kixima] __dirname = ${__dirname}\n` +
    `[kixima] process.cwd() = ${process.cwd()}\n` +
    `[kixima] FRONTEND_DIST = ${process.env.FRONTEND_DIST || '(não definido)'}\n` +
    '[kixima] Caminhos verificados:\n' + distChecked.map((c) => '           ' + c).join('\n'),
  );
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
