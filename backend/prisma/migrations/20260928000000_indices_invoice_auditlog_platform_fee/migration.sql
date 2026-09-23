-- Índices em falta identificados na auditoria de performance (relatório
-- "Auditoria de Segurança e Arquitetura — KIXIMA", secção 8, achado A4).
--
-- invoices.issued_at: filtro principal do SAF-T (saftService.gerar, um
-- intervalo de datas sobre a tabela inteira, que só cresce — é dado fiscal,
-- nunca se apaga). Sem índice, qualquer exportação SAF-T fazia sequential
-- scan da tabela inteira, agravando-se linearmente com o volume histórico.
CREATE INDEX IF NOT EXISTS "invoices_issued_at_idx" ON "invoices"("issued_at");

-- invoices.due_at / status: relatórios de faturas vencidas/por estado nos
-- dashboards financeiros.
CREATE INDEX IF NOT EXISTS "invoices_due_at_idx" ON "invoices"("due_at");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status");

-- audit_logs.company_id: ecrãs de auditoria/compliance filtrados por empresa
-- forçavam sequential scan numa tabela que regista TODA a atividade de
-- negócio e nunca é podada. Composto com created_at porque o padrão de
-- consulta é sempre "atividade desta empresa, mais recente primeiro".
CREATE INDEX IF NOT EXISTS "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- platform_fees.status: dashboards administrativos de cobrança ("quais taxas
-- estão pendentes").
CREATE INDEX IF NOT EXISTS "platform_fees_status_idx" ON "platform_fees"("status");
