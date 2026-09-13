-- Corrige a auditoria N4: CompanyAddon não tinha nenhum campo de validade —
-- uma empresa pagava um único mês do add-on (ex.: Automatic PO Robot) e
-- ficava com ele ATIVO para sempre, porque nada voltava a ler a validade já
-- guardada em AddonCobranca.validoAte. Mesmo princípio de
-- Company.planoValidoAte: NUNCA usado para mudar `status` sozinho — é
-- verificado a cada leitura em addonService.assertAddon()/estado().
--
-- Idempotente: pode ser corrido mais do que uma vez sem erro.

ALTER TABLE "company_addons"
  ADD COLUMN IF NOT EXISTS "valido_ate" TIMESTAMP(3);
