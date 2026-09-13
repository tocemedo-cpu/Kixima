-- "Uma cobrança em aberto por empresa" era só uma verificação em JavaScript
-- (findFirst -> create), sem nada na base de dados a impedir a corrida:
-- duas chamadas concorrentes a pedir() podiam ambas passar o findFirst antes
-- de qualquer uma criar a linha, resultando em duas cobranças abertas para a
-- mesma empresa. Estes dois índices únicos PARCIAIS tornam a invariante real
-- — só existe filtro (WHERE) sobre os estados em aberto, por isso uma
-- empresa pode voltar a pedir livremente depois de a cobrança anterior ficar
-- CONFIRMADA ou CANCELADA.
--
-- Não representável em schema.prisma (Prisma não suporta índices únicos
-- parciais na linguagem do schema) — só aqui, em SQL puro, tal como outros
-- objetos de base de dados deste projeto. O Prisma Client não precisa de
-- saber disto para o funcionamento normal: só entra em jogo quando a
-- constraint é mesmo violada, e nesse caso o erro (P2002) é tratado
-- explicitamente em assinaturaService.pedir()/addonService.pedir().
CREATE UNIQUE INDEX IF NOT EXISTS "plano_cobrancas_company_id_aberta_key"
  ON "plano_cobrancas"("company_id")
  WHERE "status" IN ('PENDENTE', 'COMPROVATIVO_ENVIADO');

CREATE UNIQUE INDEX IF NOT EXISTS "addon_cobrancas_company_id_addon_key_aberta_key"
  ON "addon_cobrancas"("company_id", "addon_key")
  WHERE "status" IN ('PENDENTE', 'COMPROVATIVO_ENVIADO');
