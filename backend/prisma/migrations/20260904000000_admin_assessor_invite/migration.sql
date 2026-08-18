-- Convite de assessor (ADMIN_SISTEMA por área).
--
-- Reutiliza a tabela de convites de funcionário em vez de criar uma segunda:
-- o ciclo de vida (Pendente/Aceite/Expirado/Cancelado, reenvio, cancelamento)
-- já existe e é o mesmo, seja o convidado um funcionário de uma empresa ou um
-- assessor do próprio Kixima.
--
-- company_id passa a OPCIONAL: um assessor não pertence a nenhuma empresa —
-- a mesma razão de users.company_id já ser opcional para ADMIN_SISTEMA.
--
-- admin_areas só tem sentido quando role = ADMIN_SISTEMA. Vazio continua a
-- significar "sem restrição" (Super Admin) em toda a plataforma — mas um
-- convite nunca grava vazio: a validação do pedido de criação exige pelo
-- menos uma área, para nenhum convite promover alguém a Super Admin.
--
-- Idempotente: pode ser corrido mais do que uma vez sem erro.
ALTER TABLE "employee_invites" ALTER COLUMN "company_id" DROP NOT NULL;
ALTER TABLE "employee_invites" ADD COLUMN IF NOT EXISTS "admin_areas" TEXT[] NOT NULL DEFAULT '{}';
