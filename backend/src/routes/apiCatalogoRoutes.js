// src/routes/apiCatalogoRoutes.js
// API pública de catálogo (plano Pro) — /api/v1/catalogo.
//
// Autenticada por CHAVE, não por sessão. Isso significa que contorna o login e a
// verificação em dois passos, e a resposta a isso não é confiar na chave: é
// limitar o que ela alcança.
//
// O QUE ESTAS ROTAS FAZEM, e NADA MAIS: ler e atualizar o catálogo da própria
// empresa. Não há aqui ordens, pagamentos, faturas, utilizadores nem documentos,
// e não deve passar a haver — se um dia alguém precisar disso por API, é uma
// decisão nova, com o seu próprio desenho de segurança, e não uma rota
// acrescentada a este ficheiro.
//
// Versionada em /v1 desde o primeiro dia: quem integra um sistema com isto não
// pode acordar um dia com os campos mudados.
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const apiKeyService = require('../services/apiKeyService');
const auditService = require('../services/auditService');
const prisma = require('../config/database');

const router = express.Router();

// Limite por chave, não por IP: um sistema integrado sai sempre do mesmo IP, e
// limitar por IP castigaria quem está a usar isto como deve ser.
const limitador = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  // O limitador corre DEPOIS da autenticação, por isso a chave está sempre lá.
  // O recurso ao IP usa o helper da biblioteca — um fallback ingénuo deixaria
  // um endereço IPv6 contornar o limite mudando o último bloco.
  keyGenerator: (req) => req.apiKey?.prefixo || ipKeyGenerator(req.ip),
  message: {
    error: {
      code: 'RATE_LIMIT',
      message: 'Demasiados pedidos. O limite é de 120 por minuto por chave.',
    },
  },
});

// --- Autenticação por chave --------------------------------------------------
async function autenticarChave(req, res, next) {
  const header = req.headers.authorization || '';
  const apresentada = header.startsWith('Bearer ')
    ? header.slice(7).trim()
    : String(req.headers['x-api-key'] || '').trim();

  if (!apresentada) {
    return res.status(401).json({
      error: {
        code: 'SEM_CHAVE',
        message: 'Envie a chave em "Authorization: Bearer kxm_....". '
          + 'As chaves criam-se em Catálogo → API, no plano Pro.',
      },
    });
  }

  const sessao = await apiKeyService.autenticar(apresentada);
  if (!sessao) {
    // Uma só mensagem para chave inexistente, revogada, de empresa suspensa ou
    // de empresa que desceu de plano: dizer QUAL das quatro ajudaria quem está a
    // tentar adivinhar uma chave.
    return res.status(401).json({
      error: { code: 'CHAVE_INVALIDA', message: 'Chave inválida, revogada ou sem acesso à API.' },
    });
  }
  req.apiKey = sessao;
  req.empresa = sessao.empresa;
  return next();
}

router.use(autenticarChave, limitador);

// Forma pública de um item. Estável de propósito: é um contrato com sistemas
// que ninguém controla, e acrescentar campos é fácil — mudar os que já existem
// parte integrações silenciosamente.
function item(p) {
  return {
    sku: p.sku,
    nome: p.name,
    descricao: p.description,
    categoria: p.category,
    unspsc: p.unspscCode,
    preco: Number(p.unitPrice),
    precoPromocional: p.promoPrice != null ? Number(p.promoPrice) : null,
    moeda: p.currency,
    stock: p.stockQuantity,
    disponibilidade: p.availability,
    prazoEntregaDias: p.leadTimeDays,
    paisDeOrigem: p.countryOfOrigin,
    ativo: p.active,
    atualizadoEm: p.updatedAt,
  };
}

// GET /api/v1/catalogo — o catálogo da própria empresa, paginado.
router.get('/', async (req, res) => {
  const limite = Math.min(200, Math.max(1, Number(req.query.limite) || 50));
  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const where = { supplierId: req.empresa.id };
  if (req.query.ativo === 'true') where.active = true;
  if (req.query.ativo === 'false') where.active = false;

  const [total, itens] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where, orderBy: { updatedAt: 'desc' },
      skip: (pagina - 1) * limite, take: limite,
    }),
  ]);
  res.json({ total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)), itens: itens.map(item) });
});

// GET /api/v1/catalogo/:sku
router.get('/:sku', async (req, res) => {
  const p = await prisma.product.findFirst({ where: { supplierId: req.empresa.id, sku: req.params.sku } });
  if (!p) return res.status(404).json({ error: { code: 'NAO_ENCONTRADO', message: `Não existe nenhum item com o SKU "${req.params.sku}" nesta empresa.` } });
  return res.json(item(p));
});

// PATCH /api/v1/catalogo/:sku — preço, stock e disponibilidade.
//
// É esta a rota que justifica a API existir: preço e stock são o que muda todos
// os dias, e o que fica desatualizado quando se atualiza à mão.
router.patch('/:sku', async (req, res) => {
  const existente = await prisma.product.findFirst({
    where: { supplierId: req.empresa.id, sku: req.params.sku },
  });
  if (!existente) {
    return res.status(404).json({ error: { code: 'NAO_ENCONTRADO', message: `Não existe nenhum item com o SKU "${req.params.sku}" nesta empresa.` } });
  }

  const dados = {};
  const erros = [];
  const { preco, precoPromocional, stock, disponibilidade, prazoEntregaDias, ativo } = req.body || {};

  if (preco !== undefined) {
    if (!(Number(preco) > 0)) erros.push('preco tem de ser um número maior do que zero');
    else dados.unitPrice = Number(preco);
  }
  if (precoPromocional !== undefined) {
    if (precoPromocional === null) dados.promoPrice = null;
    else if (!(Number(precoPromocional) > 0)) erros.push('precoPromocional tem de ser um número maior do que zero, ou null');
    else dados.promoPrice = Number(precoPromocional);
  }
  if (stock !== undefined) {
    if (!Number.isInteger(Number(stock)) || Number(stock) < 0) erros.push('stock tem de ser um inteiro igual ou maior do que zero');
    else dados.stockQuantity = Number(stock);
  }
  if (disponibilidade !== undefined) dados.availability = String(disponibilidade);
  if (prazoEntregaDias !== undefined) dados.leadTimeDays = Number(prazoEntregaDias);
  if (ativo !== undefined) dados.active = Boolean(ativo);

  if (erros.length) {
    return res.status(422).json({ error: { code: 'DADOS_INVALIDOS', message: erros.join('; ') } });
  }
  if (!Object.keys(dados).length) {
    return res.status(422).json({
      error: { code: 'NADA_A_ALTERAR', message: 'Envie pelo menos um de: preco, precoPromocional, stock, disponibilidade, prazoEntregaDias, ativo.' },
    });
  }

  const atualizado = await prisma.product.update({ where: { id: existente.id }, data: dados });

  // Uma alteração de preço feita por máquina tem de deixar rasto igual à feita
  // por pessoa — e com a chave identificada, para se saber QUAL sistema a fez.
  await auditService.recordSafe({
    actor: { actorId: null, actorName: `API (${req.apiKey.prefixo})`, actorRole: null, companyId: req.empresa.id, ip: req.ip },
    action: 'CATALOGO_ATUALIZADO_POR_API',
    entityType: 'Product',
    entityId: existente.id,
    entityRef: existente.sku || existente.name,
    detail: { campos: Object.keys(dados), chave: req.apiKey.prefixo },
  });

  return res.json(item(atualizado));
});

module.exports = router;
