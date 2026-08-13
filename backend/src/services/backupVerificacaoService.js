// src/services/backupVerificacaoService.js
// A última cópia de segurança ainda se LÊ?
//
// A escrita não responde a esta pergunta. Um upload que devolve 200 e um objeto
// truncado, corrompido, ou apagado por uma política de retenção do bucket são
// indistinguíveis até alguém tentar lê-lo — e a altura em que se tenta é sempre
// a pior possível.
//
// O QUE ISTO NÃO É: um ensaio de restauro. Restaurar exige criar uma base
// descartável e repor o dump lá dentro, o que não se faz de dentro da aplicação
// (o Supabase não deixa criar bases a partir da API, e o plano gratuito do
// Render não dá shell). O ensaio completo continua a ser
// `npm run backup:restore-test`, corrido localmente contra o DIRECT_URL.
//
// O que isto É, e vale: confirma que o ficheiro existe no bucket privado, que
// descomprime, que é um dump de PostgreSQL, e que traz todas as tabelas e dados
// que a base tem hoje. Apanha o objeto truncado, o gzip corrompido, o bucket
// esvaziado e o dump que saiu vazio — que são as formas por que isto falha na
// prática.
const zlib = require('zlib');
const { promisify } = require('util');
const prisma = require('../config/database');
const config = require('../config/env');
const storage = require('./storageService');
const { BusinessRuleError } = require('../utils/errors');

const gunzip = promisify(zlib.gunzip);

// Quantas tabelas a base tem agora. É a referência contra a qual se mede o dump:
// um dump com menos tabelas do que a base é um dump incompleto.
async function tabelasNaBase() {
  const r = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
  return r?.[0]?.total ?? null;
}

async function ultimaCopia() {
  const r = await prisma.auditLog.findFirst({
    where: { action: 'COPIA_SEGURANCA_CONCLUIDA' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, detail: true },
  });
  if (!r) return null;
  return {
    quando: r.createdAt,
    chave: r.detail?.chave || null,
    bucket: r.detail?.bucket || config.storage.backupBucket,
    megabytes: r.detail?.megabytes ?? null,
  };
}

/**
 * Vai buscar a última cópia ao bucket e confirma que está inteira.
 * Devolve o que encontrou — nunca um simples "ok", porque os números é que
 * dizem se a cópia serve.
 */
async function verificar() {
  const ultima = await ultimaCopia();
  if (!ultima) {
    throw new BusinessRuleError(
      'Ainda não há nenhuma cópia registada. Faça uma primeiro, com "Fazer cópia agora".',
    );
  }
  if (!ultima.chave) {
    throw new BusinessRuleError(
      'A última cópia foi feita antes de a chave do ficheiro passar a ser registada, '
      + 'por isso não há como a ir buscar. Faça uma cópia nova e verifique essa.',
    );
  }

  const inicio = Date.now();
  const comprimido = await storage.lerFicheiro(ultima.chave, ultima.bucket);

  let sql;
  try {
    sql = (await gunzip(comprimido)).toString('utf8');
  } catch (err) {
    // Um gzip que não abre é uma cópia que não existe, por muito que o ficheiro
    // esteja lá e tenha o tamanho certo.
    throw new BusinessRuleError(
      `A cópia de ${ultima.quando.toISOString().slice(0, 16).replace('T', ' ')} está CORROMPIDA — `
      + `não descomprime (${err.message}). Faça uma cópia nova e verifique a origem do problema `
      + 'antes de confiar nas anteriores.',
    );
  }

  const eDump = /PostgreSQL database dump/i.test(sql);
  const tabelas = (sql.match(/^CREATE TABLE /gm) || []).length;
  const blocosDeDados = (sql.match(/^COPY .* FROM stdin;/gm) || []).length;
  const naBase = await tabelasNaBase();

  const problemas = [];
  if (!eDump) problemas.push('o ficheiro não parece um dump de PostgreSQL');
  if (!tabelas) problemas.push('não contém nenhuma tabela');
  if (naBase && tabelas < naBase) {
    problemas.push(`contém ${tabelas} tabelas mas a base tem ${naBase} — está incompleto`);
  }
  if (!blocosDeDados) problemas.push('não contém dados, só a estrutura');

  if (problemas.length) {
    throw new BusinessRuleError(
      `A cópia de ${ultima.quando.toISOString().slice(0, 16).replace('T', ' ')} NÃO serve: `
      + `${problemas.join('; ')}.`,
    );
  }

  return {
    quando: ultima.quando,
    bucket: ultima.bucket,
    megabytes: ultima.megabytes,
    tabelasNoDump: tabelas,
    tabelasNaBase: naBase,
    blocosDeDados,
    linhasDeSql: sql.split('\n').length,
    segundos: Number(((Date.now() - inicio) / 1000).toFixed(1)),
    // Dito por extenso para não ser confundido com o que não é.
    nota: 'A cópia foi lida do bucket, descomprimiu e está completa. Isto NÃO é um ensaio de '
      + 'restauro: repor o dump numa base e comparar linha a linha faz-se com '
      + '`npm run backup:restore-test`, fora da plataforma.',
  };
}

module.exports = { verificar, ultimaCopia };
