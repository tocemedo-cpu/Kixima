-- Três planos: ENTRADA · CORE · PRO.
--
-- Antes havia dois: BASICO e PRO. A escada nova acrescenta um degrau em baixo
-- (ENTRADA) e renomeia o do meio (CORE).
--
-- PARA ONDE VÃO AS EMPRESAS QUE ESTÃO EM BASICO — e porquê:
-- vão para CORE, não para ENTRADA. O nome sugeriria o contrário (BASICO parece
-- o plano de base), mas o que interessa não é o nome: é o que a empresa TINHA.
-- Uma empresa em BASICO tinha kits, comparação de fornecedores e 5 lugares.
-- Passá-la para ENTRADA tirar-lhe-ia os kits e três lugares — uma redução de
-- serviço, feita em silêncio, a quem já estava a pagar. Isso não se faz.
--
-- O ENTRADA é um degrau NOVO: aplica-se a quem se inscrever a partir de agora.
--
-- BASICO fica no enum de propósito. Removê-lo obrigaria a recriar o tipo em
-- Postgres, com o risco de apanhar uma linha pelo caminho; e o código trata-o
-- como sinónimo de CORE, para que uma linha esquecida não tire funcionalidades
-- a ninguém.
ALTER TYPE "CompanyPlan" ADD VALUE IF NOT EXISTS 'ENTRADA';
ALTER TYPE "CompanyPlan" ADD VALUE IF NOT EXISTS 'CORE';
