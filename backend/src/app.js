// src/app.js
// Monta a aplicação Express. Não chama .listen() aqui — isso é feito em server.js
// para que os testes possam importar `app` sem abrir uma porta real.

require('express-async-errors');
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

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
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

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
