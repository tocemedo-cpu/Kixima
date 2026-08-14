-- Passa as empresas de BASICO para CORE.
--
-- Em ficheiro separado de propósito: o Postgres não deixa usar um valor de enum
-- acrescentado na MESMA transação em que foi criado. Juntar as duas coisas dá
-- "unsafe use of new value of enum type" e a migração falha a meio — com o
-- plano novo criado e nenhuma empresa migrada.
UPDATE "companies" SET "plan" = 'CORE' WHERE "plan" = 'BASICO';
