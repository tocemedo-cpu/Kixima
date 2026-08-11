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
      // Exceções deliberadas (ficam em PT): documentos jurídicos e documentos
      // oficiais A4 (PO/fatura/extrato, já bilingues PT/EN por desenho), e o
      // navConfig.js (ficheiro legado não usado pela navegação).
      if (/Legal\.jsx|PrintableDocument\.jsx|FeeStatement\.jsx|navConfig\.js$/.test(p)) continue;
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
  !/^\d/.test(s) && !s.includes('=>');

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
  /(?:title|subtitle|label|sub|header|emptyTitle|emptyBody|placeholder|unit)\s*[:=]\s*\{?\s*'((?:[^'\\]|\\.)+)'/g,
  /(?:title|subtitle|label|sub|header|emptyTitle|emptyBody|placeholder|unit)\s*[:=]\s*\{?\s*"((?:[^"\\]|\\.)+)"/g,
];
const CHILDREN = /<(?:Pill|Badge|EmptyRow)\b[^>]*>\s*([^<{][^<{]*?)\s*</g;   // filhos literais
const TRAIL = /trail=\{\[([^\]]+)\]\}/g;                            // Crumbs trail

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const re of PATTERNS) {
    for (const m of src.matchAll(re)) addKey(m[1].replaceAll("\\'", "'"), f);
  }
  for (const m of src.matchAll(CHILDREN)) addKey(m[1].trim(), f);
  for (const m of src.matchAll(TRAIL)) {
    for (const part of m[1].matchAll(/'((?:[^'\\]|\\.)+)'/g)) addKey(part[1], f);
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
for (const file of ['index.jsx', 'content.js', 'content2.js', 'content3.js', 'content4.js']) {
  const k = dictKeys(file);
  k.en.forEach((x) => en.add(x));
  k.fr.forEach((x) => fr.add(x));
}

// --- 4. Relatório ------------------------------------------------------------
const usedKeys = [...used.keys()].sort((a, b) => a.localeCompare(b));
const missingEn = usedKeys.filter((k) => !en.has(k));
const missingFr = usedKeys.filter((k) => !fr.has(k));
const unusedEn = [...en].filter((k) => !used.has(k)).sort();

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
