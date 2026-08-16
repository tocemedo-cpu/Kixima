-- Áreas de um Admin do Sistema.
--
-- ADMIN_SISTEMA era um papel só: quem o tinha, tinha tudo — cadastro de
-- empresas, financeiro, faturação AGT, apólices, suporte, operação. Vazio
-- continua a significar Super Admin sem restrição, que é por que o valor por
-- omissão fica assim: ninguém que já tem o papel perde acesso a nada só por
-- esta coluna passar a existir.
--
-- Idempotente: pode ser corrido mais do que uma vez sem erro.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_areas" TEXT[] NOT NULL DEFAULT '{}';
