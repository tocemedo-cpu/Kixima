-- ENTRADA passa a chamar-se BASE.
--
-- Só o nome muda: as funcionalidades, os limites e a posição na pesquisa são
-- exatamente os mesmos. RENAME VALUE altera o rótulo no próprio tipo, por isso
-- as linhas que já lá estão acompanham — não há dados a migrar nem uma janela
-- em que metade das empresas esteja num plano e metade noutro.
ALTER TYPE "CompanyPlan" RENAME VALUE 'ENTRADA' TO 'BASE';
