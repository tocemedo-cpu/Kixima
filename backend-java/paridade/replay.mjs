#!/usr/bin/env node
// Replay de contrato (plano, secção 4.2): executa o MESMO cenário contra um
// backend (Node ou Java) apontado à MESMA cópia da base, grava estado + corpo
// de cada resposta, e compara duas gravações estruturalmente, ignorando só o
// que é genuinamente não-determinístico (ids gerados, carimbos, tokens).
//
//   node paridade/replay.mjs gravar --alvo http://localhost:4000 --saida paridade/gravacoes/node.json
//   node paridade/replay.mjs comparar paridade/gravacoes/node.json paridade/gravacoes/java.json
//
// Sem dependências: só o fetch do Node 18+.
import fs from 'node:fs';
import path from 'node:path';

const AQUI = path.dirname(new URL(import.meta.url).pathname);
const PASSWORD = 'Kixima@123';
const UTILIZADORES = {
  comprador: 'comprador@petroangola.co.ao',
  companyAdmin: 'admin@petroangola.co.ao',
  financeiro: 'financeiro@petroangola.co.ao',
  fornecedor: 'fornecedor@kianda.co.ao',
  adminSistema: 'admin@kixima.co.ao',
};

function arg(nome, porOmissao) {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : porOmissao;
}

// --- Resolução de valores capturados: $.a.b[0].c e $[chave=valor].id ------------
function extrair(obj, caminho) {
  let atual = obj;
  const partes = caminho.replace(/^\$/, '').match(/\.[^.[\]]+|\[[^\]]+\]/g) || [];
  for (const parte of partes) {
    if (atual == null) return undefined;
    if (parte.startsWith('.')) atual = atual[parte.slice(1)];
    else {
      const dentro = parte.slice(1, -1);
      if (/^\d+$/.test(dentro)) atual = atual[Number(dentro)];
      else {
        const [k, ...resto] = dentro.split('=');
        const v = resto.join('=');
        atual = Array.isArray(atual) ? atual.find((e) => String(e?.[k]) === v) : undefined;
      }
    }
  }
  return atual;
}

function substituir(texto, vars) {
  return String(texto).replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`variável {{${k}}} não capturada antes de ser usada`);
    return vars[k];
  });
}

function substituirFundo(valor, vars) {
  if (typeof valor === 'string') return substituir(valor, vars);
  if (Array.isArray(valor)) return valor.map((v) => substituirFundo(v, vars));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, substituirFundo(v, vars)]));
  return valor;
}

// --- Gravar ----------------------------------------------------------------------
async function login(alvo, email) {
  const r = await fetch(`${alvo}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const corpo = await r.json();
  if (r.status !== 200) throw new Error(`login falhou para ${email}: ${r.status} ${JSON.stringify(corpo)}`);
  return corpo.token;
}

async function gravar() {
  const alvo = arg('--alvo', 'http://localhost:4000').replace(/\/$/, '');
  const cenario = JSON.parse(fs.readFileSync(arg('--cenario', path.join(AQUI, 'cenario.json')), 'utf8'));
  const saida = arg('--saida', path.join(AQUI, 'gravacoes', 'gravacao.json'));
  const tokens = {};
  const vars = {};
  const gravacao = [];
  for (const passo of cenario) {
    let token = null;
    if (passo.como) {
      if (!tokens[passo.como]) tokens[passo.como] = await login(alvo, UTILIZADORES[passo.como]);
      token = tokens[passo.como];
    }
    const caminho = substituir(passo.caminho, vars);
    const headers = {};
    if (token) headers.authorization = `Bearer ${token}`;
    let body;
    if (passo.multipart) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(passo.multipart.campos || {})) fd.append(k, substituir(v, vars));
      for (const [k, f] of Object.entries(passo.multipart.ficheiros || {})) {
        fd.append(k, new Blob([f.conteudo], { type: f.tipo }), f.nome);
      }
      body = fd;
    } else if (passo.corpo !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(substituirFundo(passo.corpo, vars));
    }
    const inicio = Date.now();
    const r = await fetch(alvo + caminho, { method: passo.metodo || 'GET', headers, body });
    const ms = Date.now() - inicio;
    const tipo = r.headers.get('content-type') || '';
    let corpo;
    const texto = await r.text();
    if (tipo.includes('json')) {
      try { corpo = JSON.parse(texto); } catch { corpo = texto; }
    } else {
      corpo = { _texto: texto.slice(0, 400), _bytes: texto.length };
    }
    for (const [nome, caminhoJson] of Object.entries(passo.guardar || {})) {
      const v = extrair(corpo, caminhoJson);
      if (v === undefined) console.warn(`  aviso: ${passo.nome} não devolveu ${caminhoJson}`);
      vars[nome] = v;
    }
    gravacao.push({ nome: passo.nome, como: passo.como || null, metodo: passo.metodo || 'GET', caminho: passo.caminho,
      status: r.status, contentType: tipo.split(';')[0], ms, corpo });
    console.log(`${String(r.status).padStart(3)} ${String(ms).padStart(5)}ms  ${passo.metodo || 'GET'} ${caminho}`);
  }
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, JSON.stringify({ alvo, gravadoEm: new Date().toISOString(), passos: gravacao }, null, 2));
  console.log(`gravação: ${saida} (${gravacao.length} passos)`);
}

// --- Comparar --------------------------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const JWT = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;
// Referências geradas com bytes aleatórios (PAY-1AF199F2, NC-…): diferentes por construção.
const REF_ALEATORIA = /^[A-Z]{2,4}-[0-9A-F]{8}$/;

function normalizarTexto(s) {
  // Nomes de ficheiro com carimbo (produto-1699999999999.jpg) e números longos.
  return s.replace(/\d{10,}/g, '#');
}

function equivalentes(a, b, opcoes) {
  if (typeof a === 'string' && typeof b === 'string') {
    if (a === b) return true;
    if (UUID.test(a) && UUID.test(b)) return true;
    if (DATA_ISO.test(a) && DATA_ISO.test(b)) return true;
    if (JWT.test(a) && JWT.test(b)) return true;
    if (REF_ALEATORIA.test(a) && REF_ALEATORIA.test(b)) return true;
    return normalizarTexto(a) === normalizarTexto(b);
  }
  if (opcoes.tolerarDecimais) {
    const na = typeof a === 'string' && a.trim() !== '' ? Number(a) : a;
    const nb = typeof b === 'string' && b.trim() !== '' ? Number(b) : b;
    if (typeof na === 'number' && typeof nb === 'number' && Number.isFinite(na) && Number.isFinite(nb)) {
      if (Math.abs(na - nb) < 1e-9) {
        if (typeof a !== typeof b) {
          opcoes.decimaisTolerados++;
          const chave = typeof a === 'string' ? 'stringNoPrimeiro' : 'stringNoSegundo';
          opcoes[chave] = (opcoes[chave] || 0) + 1;
        }
        return true;
      }
    }
  }
  return a === b;
}

function diff(a, b, caminho, ignorar, opcoes, saida) {
  const ultimaChave = caminho.split('.').pop().replace(/\[\d+\]$/, '');
  if (ignorar.has(ultimaChave)) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { saida.push(`${caminho}: ${a.length} vs ${b.length} elementos`); return; }
    a.forEach((v, i) => diff(v, b[i], `${caminho}[${i}]`, ignorar, opcoes, saida));
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of chaves) {
      if (ignorar.has(k)) continue;
      if (!(k in a)) { if (b[k] !== null && b[k] !== undefined) saida.push(`${caminho}.${k}: só no segundo`); continue; }
      if (!(k in b)) { if (a[k] !== null && a[k] !== undefined) saida.push(`${caminho}.${k}: só no primeiro`); continue; }
      diff(a[k], b[k], `${caminho}.${k}`, ignorar, opcoes, saida);
    }
    return;
  }
  if (!equivalentes(a, b, opcoes)) {
    const mostrar = (v) => (typeof v === 'string' ? JSON.stringify(v.slice(0, 60)) : JSON.stringify(v));
    saida.push(`${caminho}: ${mostrar(a)} (${typeof a}) vs ${mostrar(b)} (${typeof b})`);
  }
}

function comparar() {
  const [, , , fA, fB] = process.argv;
  const A = JSON.parse(fs.readFileSync(fA, 'utf8'));
  const B = JSON.parse(fs.readFileSync(fB, 'utf8'));
  const regras = JSON.parse(fs.readFileSync(arg('--ignorar', path.join(AQUI, 'ignorar.json')), 'utf8'));
  const opcoes = { tolerarDecimais: process.argv.includes('--tolerar-decimais'), decimaisTolerados: 0 };
  let iguais = 0;
  const relatorio = [];
  for (let i = 0; i < Math.max(A.passos.length, B.passos.length); i++) {
    const a = A.passos[i];
    const b = B.passos[i];
    if (!a || !b) { relatorio.push({ passo: (a || b).nome, problemas: ['passo ausente numa das gravações'] }); continue; }
    const problemas = [];
    if (a.status !== b.status) problemas.push(`estado: ${a.status} vs ${b.status}`);
    if (a.contentType !== b.contentType) problemas.push(`content-type: ${a.contentType} vs ${b.contentType}`);
    const ignorar = new Set([...(regras.global || []), ...((regras.porPasso || {})[a.nome] || [])]);
    if (a.corpo && typeof a.corpo === 'object' && a.corpo._texto !== undefined) {
      // Corpo não-JSON (XML, PDF): compara só o tamanho aproximado e o início.
      if (Math.abs(a.corpo._bytes - b.corpo._bytes) > Math.max(64, a.corpo._bytes * 0.2)) problemas.push(`tamanho: ${a.corpo._bytes} vs ${b.corpo._bytes} bytes`);
    } else {
      diff(a.corpo, b.corpo, '$', ignorar, opcoes, problemas);
    }
    if (problemas.length) relatorio.push({ passo: a.nome, pedido: `${a.metodo} ${a.caminho}`, problemas });
    else iguais++;
  }
  const total = Math.max(A.passos.length, B.passos.length);
  console.log(`# Replay de contrato — ${path.basename(fA)} × ${path.basename(fB)}\n`);
  console.log(`Passos: ${total} · iguais: ${iguais} · com diferenças: ${relatorio.length}`
    + (opcoes.tolerarDecimais ? ` · decimais string↔número tolerados: ${opcoes.decimaisTolerados} (string só no primeiro: ${opcoes.stringNoPrimeiro || 0}, só no segundo: ${opcoes.stringNoSegundo || 0})` : '') + '\n');
  for (const r of relatorio) {
    console.log(`## ${r.passo} — ${r.pedido || ''}`);
    for (const p of r.problemas.slice(0, 40)) console.log(`- ${p}`);
    if (r.problemas.length > 40) console.log(`- … mais ${r.problemas.length - 40}`);
    console.log('');
  }
  process.exitCode = relatorio.length ? 1 : 0;
}

const modo = process.argv[2];
if (modo === 'gravar') gravar().catch((e) => { console.error(e); process.exit(2); });
else if (modo === 'comparar') comparar();
else { console.error('uso: replay.mjs gravar --alvo URL --saida FICHEIRO | comparar A.json B.json [--tolerar-decimais]'); process.exit(2); }
