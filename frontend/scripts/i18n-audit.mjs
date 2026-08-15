#!/usr/bin/env node
// scripts/i18n-audit.mjs
// Auditoria automática de i18n: extrai as chaves de tradução usadas no código
// (t('…'), props traduzidas pelos componentes partilhados, rótulos de domínio)
// e compara com os dicionários EN/FR. Reporta:
//   - chaves usadas SEM tradução (por idioma);
//   - chaves nos dicionários que já NÃO são usadas.
// Uso: node scripts/i18n-audit.mjs [--strict]   (--strict: exit 1 se faltar)
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC = new URL('../src', import.meta.url).pathname;
const strict = process.argv.includes('--strict');

// --- 1. Recolha de ficheiros -------------------------------------------------
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'i18n' || name === 'node_modules') continue;
      walk(p, out);
    } else if (['.jsx', '.js'].includes(extname(p)) && !p.includes('.test.')) {
      // Exceção deliberada (fica em PT): legalContent.js reúne os documentos
      // jurídicos completos por idioma e não passa por t().
      if (/legalContent\.js$/.test(p)) continue;
      out.push(p);
    }
  }
  return out;
}
const files = walk(SRC);

// --- 2. Extração das chaves usadas ------------------------------------------
// Uma chave é "visível" se tem letras e não é claramente técnica.
const looksLikeText = (s) =>
  /[A-Za-zÀ-ÿ]/.test(s) && s.length > 1 &&
  !s.startsWith('/') && !s.startsWith('#') && !s.startsWith('http') &&
  !/^[a-z0-9_.:-]+$/.test(s) &&              // identificadores/técnicos (minúsculas)
  !/^[A-Z0-9_]+$/.test(s) &&                  // enums técnicos
  !/^\d/.test(s) && !s.includes('=>') &&
  !s.startsWith('url(') &&                    // valores CSS (url(#gradiente))
  // Fragmentos de JSX apanhados por engano. Os marcadores de interpolação
  // ({n}, {ref}, …) são RETIRADOS antes desta prova: são chaves legítimas e
  // precisam de tradução tanto como as outras. Enquanto contavam como JSX, uma
  // frase interpolada nova entrava em produção por traduzir e a auditoria
  // continuava a dizer "0 em falta" — o pior resultado possível para uma
  // verificação: passar por estar a olhar para o lado.
  !/[<>{}]|className=|\\n/.test(s.replace(/\{[a-zA-Z][a-zA-Z0-9]*\}/g, ''));

const used = new Map(); // chave -> [ficheiros]
function addKey(key, file) {
  if (!looksLikeText(key)) return;
  if (!used.has(key)) used.set(key, new Set());
  used.get(key).add(file.replace(SRC + '/', ''));
}

const PATTERNS = [
  /\bt\(\s*'((?:[^'\\]|\\.)+)'/g,                       // t('…')
  /\bt\(\s*"((?:[^"\\]|\\.)+)"/g,                       // t("…")
  /\btr\(\s*'((?:[^'\\]|\\.)+)'\s*\)/g,                 // tr('…')
  // Props/objetos traduzidos pelos componentes partilhados:
  /(?:title|subtitle|label|sub|header|emptyTitle|emptyBody|placeholder|unit|body|text|desc|description|forWho|price|l|name)\s*[:=]\s*\{?\s*'((?:[^'\\]|\\.)+)'/g,
  /(?:title|subtitle|label|sub|header|emptyTitle|emptyBody|placeholder|unit|body|text|desc|description|forWho|price|l|name)\s*[:=]\s*\{?\s*"((?:[^"\\]|\\.)+)"/g,
];
const CHILDREN = /<(?:Pill|Badge|EmptyRow)\b[^>]*>\s*([^<{][^<{]*?)\s*</g;   // filhos literais
const TRAIL = /trail=\{\[([^\]]+)\]\}/g;                            // Crumbs trail
// Arrays de strings usados como conteúdo traduzido em lote (features: [...]).
const STR_ARRAY = /(?:features|items|options|bullets|steps)\s*:\s*\[([\s\S]*?)\]/g;

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const re of PATTERNS) {
    for (const m of src.matchAll(re)) addKey(m[1].replaceAll("\\'", "'"), f);
  }
  for (const m of src.matchAll(CHILDREN)) addKey(m[1].trim(), f);
  for (const m of src.matchAll(TRAIL)) {
    for (const part of m[1].matchAll(/'((?:[^'\\]|\\.)+)'/g)) addKey(part[1], f);
  }
  for (const m of src.matchAll(STR_ARRAY)) {
    for (const part of m[1].matchAll(/'((?:[^'\\]|\\.)+)'/g)) addKey(part[1].replaceAll("\\'", "'"), f);
  }
}

// --- 3. Chaves dos dicionários ----------------------------------------------
function dictKeys(file) {
  const src = readFileSync(join(SRC, 'i18n', file), 'utf8');
  const keys = { en: new Set(), fr: new Set() };
  let current = null;
  for (const line of src.split('\n')) {
    const start = line.match(/export const (EN|FR)\d* =/);
    if (start) current = start[1].toLowerCase();
    if (!current) continue;
    for (const m of line.matchAll(/'((?:[^'\\]|\\.)+)'\s*:/g)) keys[current].add(m[1].replaceAll("\\'", "'"));
    for (const m of line.matchAll(/"((?:[^"\\]|\\.)+)"\s*:/g)) keys[current].add(m[1]);
  }
  return keys;
}
const en = new Set(); const fr = new Set();
// Os ficheiros de dicionário são DESCOBERTOS na pasta, não listados à mão: uma
// lista fixa fica desatualizada em silêncio à primeira adição — foi o que
// aconteceu com o content8.js, cujas chaves o auditor não via.
const DICT_FILES = ['index.jsx', ...readdirSync(join(SRC, 'i18n')).filter((f) => /^content\d*\.js$/.test(f)).sort()];
for (const file of DICT_FILES) {
  const k = dictKeys(file);
  k.en.forEach((x) => en.add(x));
  k.fr.forEach((x) => fr.add(x));
}
// Texto de interface criado no SERVIDOR (content5.js: mensagens de erro;
// content8.js: cartões, tarefas e relatórios) — aplicado dinamicamente, não
// aparece como t('…') no código e por isso não conta como "não usado".
// As mensagens do SERVIDOR (content5.js) são aplicadas dinamicamente no cliente
// da API — não aparecem como t('…') no código, por isso não contam como "não
// usadas".
const dynamicKeys = new Set([...dictKeys('content5.js').en, ...dictKeys('content8.js').en]);

// --- 4. Relatório ------------------------------------------------------------
const usedKeys = [...used.keys()].sort((a, b) => a.localeCompare(b));
const missingEn = usedKeys.filter((k) => !en.has(k));
const missingFr = usedKeys.filter((k) => !fr.has(k));
const unusedEn = [...en].filter((k) => !used.has(k) && !dynamicKeys.has(k)).sort();

console.log(`Ficheiros analisados: ${files.length}`);
console.log(`Chaves visíveis em uso: ${usedKeys.length}`);
console.log(`Dicionário EN: ${en.size} · FR: ${fr.size}`);
console.log(`Em falta EN: ${missingEn.length} · FR: ${missingFr.length} · Não usadas: ${unusedEn.length}`);

if (process.argv.includes('--missing')) {
  console.log('\n--- EM FALTA (EN) ---');
  for (const k of missingEn) console.log(`  ${JSON.stringify(k)}  ← ${[...used.get(k)][0]}`);
}
if (process.argv.includes('--unused')) {
  console.log('\n--- NÃO USADAS ---');
  for (const k of unusedEn) console.log(`  ${JSON.stringify(k)}`);
}

if (strict && (missingEn.length || missingFr.length)) {
  console.error('\n✗ Existem chaves sem tradução. Corre com --missing para as listar.');
  process.exit(1);
}

// --- 5. Deteção de TEXTO PT NÃO TRADUZIDO (hardcoded) ------------------------
// O bloco acima acusa chaves passadas a t() sem tradução. Este acusa o problema
// inverso e mais insidioso: texto português escrito diretamente no JSX que
// NUNCA passou por t() — não gera "chave em falta" nenhuma e por isso escapa
// silenciosamente, aparecendo em português mesmo com outro idioma escolhido.
if (process.argv.includes('--hardcoded') || process.argv.includes('--strict')) {
  // Marcas de português: acentos/cedilha ou palavras funcionais comuns.
  const PT_HINT = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]|\b(de|da|do|das|dos|para|com|sem|não|são|está|estão|você|sua|seu|pela|pelo|uma|nos|nas|ao|aos|à|às)\b/i;
  const AUTO_TRANSLATED = /<(PageHead|PageHeader|Toolbar|EmptyRow|DataTable|StatCard|KpiRow|Pill|Badge|Crumbs|Pagination|Tabs|PermissionsPanel)\b/;
  const findings = [];

  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const rel = f.replace(SRC + '/', '');
    const lines = src.split('\n');

    // Os componentes auto-traduzidos abrem muitas vezes em várias linhas
    // (<PageHead\n  title="…"\n/>); enquanto o elemento não fecha, as suas
    // props são chaves e não erros.
    let insideAuto = false;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (insideAuto) {
        if (/\/>|>\s*$/.test(line)) insideAuto = false;
        return;
      }
      // Ignora comentários e importações.
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('import ')) return;

      // Componentes partilhados que JÁ traduzem o que recebem — o literal em
      // PT neles é a CHAVE, não um erro. Ignora a linha onde são usados.
      if (AUTO_TRANSLATED.test(line)) {
        // Abre sem fechar na mesma linha → as próximas linhas são props dele.
        if (!/\/>/.test(line)) insideAuto = true;
        return;
      }

      // (a) Nós de texto JSX: >Texto<  (sem { } pelo meio)
      for (const m of line.matchAll(/>\s*([^<>{}\n]{3,})\s*</g)) {
        const txt = m[1].trim();
        if (!PT_HINT.test(txt) || !/[A-Za-zÀ-ÿ]{3,}/.test(txt)) continue;
        findings.push({ rel, line: idx + 1, kind: 'texto JSX', txt });
      }

      // (b) Atributos visíveis com literal: placeholder="…" title="…" alt="…" aria-label="…"
      for (const m of line.matchAll(/\b(placeholder|title|alt|aria-label)\s*=\s*"([^"]{3,})"/g)) {
        const txt = m[2].trim();
        if (!PT_HINT.test(txt)) continue;
        findings.push({ rel, line: idx + 1, kind: `atributo ${m[1]}`, txt });
      }
    });
  }

  console.log(`\n--- TEXTO PT HARDCODED (fora do i18n): ${findings.length} ---`);
  for (const x of findings) {
    console.log(`  ${x.rel}:${x.line}  [${x.kind}]  ${JSON.stringify(x.txt.slice(0, 90))}`);
  }
  if (findings.length && process.argv.includes('--strict')) {
    console.error('\n✗ Existe texto por traduzir fora do sistema i18n.');
    process.exit(1);
  }
}
