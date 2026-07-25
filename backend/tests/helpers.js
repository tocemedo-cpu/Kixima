// tests/helpers.js
// Utilitários partilhados pelos testes de integração.

const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

const PASSWORD = 'Kixima@123';

const USERS = {
  comprador: 'comprador@petroangola.co.ao',
  companyAdmin: 'admin@petroangola.co.ao',
  financeiro: 'financeiro@petroangola.co.ao',
  fornecedor: 'fornecedor@kianda.co.ao',
  adminSistema: 'admin@kixima.co.ao',
};

async function login(email) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Login falhou para ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

// Devolve um mapa persona -> token, autenticando todas de uma vez.
async function loginAll() {
  const tokens = {};
  for (const [key, email] of Object.entries(USERS)) {
    tokens[key] = await login(email);
  }
  return tokens;
}

// Pequeno wrapper para anexar o Bearer token a um pedido supertest.
function auth(token) {
  return {
    get: (path) => request(app).get(path).set('Authorization', `Bearer ${token}`),
    post: (path) => request(app).post(path).set('Authorization', `Bearer ${token}`),
    patch: (path) => request(app).patch(path).set('Authorization', `Bearer ${token}`),
    put: (path) => request(app).put(path).set('Authorization', `Bearer ${token}`),
    del: (path) => request(app).delete(path).set('Authorization', `Bearer ${token}`),
  };
}

module.exports = { request, app, prisma, PASSWORD, USERS, login, loginAll, auth };
