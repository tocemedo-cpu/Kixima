#!/usr/bin/env node
// Teste de carga INDICATIVO (plano, M7): N clientes concorrentes a repetir uma
// mistura de leituras autenticadas durante D segundos, contra UM backend.
// Serve para comparar Node e Java na mesma máquina e na mesma base — não para
// dimensionar produção (isso é o teste contra a réplica de staging, ver
// docs/migracao-java/M7-PARIDADE.md).
//
//   node paridade/carga.mjs --alvo http://localhost:4001 --duracao 15 --concorrencia 20
import { performance } from 'node:perf_hooks';

function arg(nome, porOmissao) {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : porOmissao;
}

const alvo = arg('--alvo', 'http://localhost:4000').replace(/\/$/, '');
const duracao = Number(arg('--duracao', 15)) * 1000;
const concorrencia = Number(arg('--concorrencia', 20));
const PASSWORD = 'Kixima@123';

async function login(email) {
  const r = await fetch(`${alvo}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status}`);
  return (await r.json()).token;
}

const comprador = await login('comprador@petroangola.co.ao');
const fornecedor = await login('fornecedor@kianda.co.ao');
const admin = await login('admin@kixima.co.ao');

const PEDIDOS = [
  { nome: 'catálogo', token: comprador, caminho: '/api/catalog' },
  { nome: 'pesquisa', token: comprador, caminho: '/api/marketplace/search?limit=10' },
  { nome: 'facets', token: comprador, caminho: '/api/marketplace/facets' },
  { nome: 'dashboard', token: comprador, caminho: '/api/dashboard/comprador' },
  { nome: 'auth/me', token: comprador, caminho: '/api/auth/me' },
  { nome: 'POs', token: fornecedor, caminho: '/api/purchase-orders' },
  { nome: 'relatório', token: fornecedor, caminho: '/api/reports/fornecedor' },
  { nome: 'admin/activities', token: admin, caminho: '/api/admin/activities' },
  { nome: 'planos (público)', token: null, caminho: '/api/planos' },
];

const porPedido = new Map(PEDIDOS.map((p) => [p.nome, { n: 0, erros: 0, cinco: 0, tempos: [] }]));
const fim = performance.now() + duracao;
let total = 0;

async function cliente(i) {
  let k = i;
  while (performance.now() < fim) {
    const p = PEDIDOS[k++ % PEDIDOS.length];
    const s = porPedido.get(p.nome);
    const t0 = performance.now();
    try {
      const r = await fetch(alvo + p.caminho, { headers: p.token ? { authorization: `Bearer ${p.token}` } : {} });
      await r.arrayBuffer();
      if (r.status >= 500) s.cinco++;
      else if (r.status >= 400) s.erros++;
    } catch {
      s.erros++;
    }
    s.tempos.push(performance.now() - t0);
    s.n++;
    total++;
  }
}

const inicio = performance.now();
await Promise.all(Array.from({ length: concorrencia }, (_, i) => cliente(i)));
const segundos = (performance.now() - inicio) / 1000;

function pct(arr, q) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

const todos = [...porPedido.values()].flatMap((s) => s.tempos);
console.log(`# Carga indicativa — ${alvo} · ${concorrencia} clientes · ${segundos.toFixed(1)}s\n`);
console.log(`| pedido | n | p50 ms | p95 ms | p99 ms | máx ms | 4xx | 5xx |`);
console.log(`|---|---:|---:|---:|---:|---:|---:|---:|`);
for (const [nome, s] of porPedido) {
  console.log(`| ${nome} | ${s.n} | ${pct(s.tempos, 0.5).toFixed(0)} | ${pct(s.tempos, 0.95).toFixed(0)} | ${pct(s.tempos, 0.99).toFixed(0)} | ${Math.max(...s.tempos).toFixed(0)} | ${s.erros} | ${s.cinco} |`);
}
const cinco = [...porPedido.values()].reduce((a, s) => a + s.cinco, 0);
const erros = [...porPedido.values()].reduce((a, s) => a + s.erros, 0);
console.log(`| **total** | ${total} | ${pct(todos, 0.5).toFixed(0)} | ${pct(todos, 0.95).toFixed(0)} | ${pct(todos, 0.99).toFixed(0)} | ${Math.max(...todos).toFixed(0)} | ${erros} | ${cinco} |`);
console.log(`\nDébito: ${(total / segundos).toFixed(1)} pedidos/s · 5xx: ${cinco}`);
process.exitCode = cinco ? 1 : 0;
