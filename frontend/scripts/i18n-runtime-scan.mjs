// scripts/i18n-runtime-scan.mjs
// Varredura de i18n EM EXECUÇÃO.
//
// A auditoria estática (i18n-audit.mjs) compara o código com os dicionários e já
// dá zero — mas continuava a haver português no ecrã. Falta-lhe o que só se vê a
// correr: texto vindo do servidor, listas montadas em runtime, rótulos que
// chegam por props calculadas, páginas que nenhum ficheiro declara.
//
// Este varredor abre a aplicação com o idioma em inglês, percorre as páginas de
// cada persona e assinala o texto visível que continua em português.
//
//   node scripts/i18n-runtime-scan.mjs            (usa http://127.0.0.1:5200)
//   node scripts/i18n-runtime-scan.mjs --lang fr
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.SCAN_BASE || 'http://127.0.0.1:5200';
const LANG = (process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : 'en');
const SENHA = process.env.SCAN_PASSWORD || 'Kixima@123';

const PERSONAS = [
  { nome: 'comprador', email: 'comprador@petroangola.co.ao', rotas: [
    '/comprador', '/comprador/catalogo', '/comprador/servicos', '/comprador/cesta',
    '/comprador/checkout', '/comprador/ordens', '/comprador/pagamentos', '/comprador/entregas',
    '/comprador/recepcao', '/comprador/fornecedores', '/comprador/atividades', '/comprador/cotacoes', '/perfil',
  ] },
  { nome: 'company-admin', email: 'admin@petroangola.co.ao', rotas: [
    '/empresa', '/empresa/utilizadores', '/empresa/permissoes', '/empresa/organizacao',
    '/empresa/documentos', '/empresa/aprovacoes', '/empresa/contratos', '/empresa/relatorios',
    '/empresa/atividades', '/empresa/configuracoes',
  ] },
  { nome: 'fornecedor', email: 'fornecedor@kianda.co.ao', rotas: [
    '/fornecedor', '/fornecedor/catalogo', '/fornecedor/catalogo/importar', '/fornecedor/inventario/stock',
    '/fornecedor/ordens', '/fornecedor/faturas', '/fornecedor/pagamentos', '/fornecedor/pedidos/cotacoes',
  ] },
  { nome: 'financeiro', email: 'financeiro@petroangola.co.ao', rotas: [
    '/financeiro', '/financeiro/faturas', '/financeiro/historico',
  ] },
  { nome: 'admin-sistema', email: 'admin@kixima.co.ao', rotas: [
    '/sistema', '/sistema/due-diligence', '/sistema/apolices', '/sistema/contratos',
    '/sistema/empresas', '/sistema/planos', '/sistema/supplier-development', '/sistema/taxa-kixima',
  ] },
];

const PUBLICAS = ['/login', '/cadastro', '/planos', '/supplier-development', '/parcerias', '/termos', '/privacidade'];

// Marcas INEQUÍVOCAS de português: palavras que nem o inglês nem o francês
// usam. Nada de "de", "do", "total" ou "entre" — existem nos outros idiomas e
// enchiam o relatório de falsos positivos.
const PT = new RegExp(
  '\\b(' + [
    'não', 'são', 'está', 'estão', 'você', 'sua', 'seu', 'pela', 'pelo', 'uma',
    'já', 'ainda', 'todas', 'todos', 'este', 'esta', 'isso', 'quando', 'onde',
    'empresa', 'fornecedor', 'comprador', 'pagamento', 'fatura', 'entrega',
    'utilizador', 'senha', 'palavra-passe', 'guardar', 'pesquisar', 'voltar',
    'aprovar', 'rejeitar', 'nenhum', 'nenhuma', 'aguarda', 'carregar',
    'selecione', 'preencha', 'obrigatório', 'sucesso', 'erro ', 'falhou',
  ].join('|') + ')\\b', 'i',
);

// CONTEÚDO, não interface: nomes de produtos, serviços, empresas e pessoas vêm
// da base de dados e ficam em português de propósito — traduzi-los seria
// traduzir o catálogo do fornecedor, não a aplicação.
// Termos iguais nos três idiomas, siglas e números.
const IGNORAR = /^(KIXIMA|Oil & Gas|Angola|USD|AOA|Kz|IVA|NIF|SAP|Oracle|Ariba|Maximo|AS400|ANPG|AGT|PO|SKU|UNSPSC|—|-|·|\d[\d\s.,%/:-]*)$/i;

const DADOS = /^(Ana |Duarte |Carla |Rui |Joana |João |Metal|Válvula|Mangueira|Tubos|Ensaios|Engenharia|Transporte|Serviço|Formação|Inspeção|Fornecedora|Petro|Catálogo KIXIMA|Kianda)/i;
const EMAIL = /@/;

function normalizar(t) {
  return t.replace(/\s+/g, ' ').trim();
}

async function textosVisiveis(page) {
  return page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = (n.textContent || '').trim();
      if (!t || t.length < 3) continue;
      const el = n.parentElement;
      if (!el) continue;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      out.push({ texto: t, tag: el.tagName.toLowerCase(), classe: el.className?.toString?.().slice(0, 40) || '' });
    }
    // Textos de acessibilidade e placeholders também são visíveis ao utilizador.
    for (const el of document.querySelectorAll('[placeholder],[aria-label],[title]')) {
      for (const attr of ['placeholder', 'aria-label', 'title']) {
        const v = el.getAttribute(attr);
        if (v && v.trim().length >= 3) out.push({ texto: v.trim(), tag: `${el.tagName.toLowerCase()}[${attr}]`, classe: '' });
      }
    }
    return out;
  });
}

async function entrar(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.evaluate((l) => localStorage.setItem('kixima_lang', l), LANG);
  await page.reload({ waitUntil: 'networkidle' });
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', SENHA);
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  return !page.url().includes('/login');
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const achados = new Map(); // texto -> Set(rotas)
let paginas = 0;

async function varrer(page, rota) {
  await page.goto(BASE + rota, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(900);
  paginas++;
  for (const { texto, tag } of await textosVisiveis(page)) {
    const t = normalizar(texto);
    if (IGNORAR.test(t) || DADOS.test(t) || EMAIL.test(t) || !PT.test(t)) continue;
    if (!achados.has(t)) achados.set(t, new Set());
    achados.get(t).add(`${rota} <${tag}>`);
  }
}

// Páginas públicas (sem sessão).
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.evaluate((l) => localStorage.setItem('kixima_lang', l), LANG);
  for (const r of PUBLICAS) await varrer(page, r);
  await page.close();
}

// Páginas por persona.
for (const p of PERSONAS) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  if (!(await entrar(page, p.email))) {
    // Falhar aqui é obrigatorio: sem sessao a varredura nao ve as paginas dessa
    // persona e reportaria "zero" por nao ter olhado — o pior resultado possivel.
    console.error(`\n✗ Login falhou para ${p.nome} (${p.email}).`);
    console.error('  A varredura nao pode continuar: sem sessao nao ha paginas para ver.');
    await browser.close();
    process.exit(2);
  }
  for (const r of p.rotas) await varrer(page, r);
  await page.close();
}

await browser.close();

console.log(`Idioma: ${LANG.toUpperCase()} · páginas varridas: ${paginas}`);
console.log(`Textos em português no ecrã: ${achados.size}\n`);
const ordenados = [...achados.entries()].sort((a, b) => b[1].size - a[1].size);
for (const [texto, rotas] of ordenados) {
  console.log(`  ${JSON.stringify(texto.slice(0, 110))}`);
  console.log(`      ${[...rotas].slice(0, 3).join(' | ')}`);
}
process.exit(achados.size ? 1 : 0);
