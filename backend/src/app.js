// src/app.js
// Monta a aplicação Express. Não chama .listen() aqui — isso é feito em server.js
// para que os testes possam importar `app` sem abrir uma porta real.

require('express-async-errors');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const poRoutes = require('./routes/poRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const policyRoutes = require('./routes/policyRoutes');
const contractRoutes = require('./routes/contractRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const kitRoutes = require('./routes/kitRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const buyerRoutes = require('./routes/buyerRoutes');
const userRoutes = require('./routes/userRoutes');
const supportRoutes = require('./routes/supportRoutes');
const companyAdminRoutes = require('./routes/companyAdminRoutes');
const financeiroRoutes = require('./routes/financeiroRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// crossOriginResourcePolicy: cross-origin para as imagens carregadas poderem
// ser servidas ao frontend (dev noutra porta) sem bloqueio do helmet.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json());

// Imagens de produtos no modo de armazenamento 'local' (em S3 são servidas
// diretamente pelo URL público do bucket).
const { uploadsDir } = require('./services/storageService');
app.use('/api/uploads', express.static(uploadsDir));
if (!config.isTest) {
  app.use(morgan(config.isDevelopment ? 'dev' : 'combined'));
}

app.get('/health', (req, res) => res.json({ status: 'ok', env: config.env }));

app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/purchase-orders', poRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportsRoutes);
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
