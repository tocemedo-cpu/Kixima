-- Índices nas chaves estrangeiras.
--
-- O PostgreSQL cria a restrição de chave estrangeira mas NÃO cria índice para a
-- coluna que a suporta. Sem ele, duas coisas degradam à medida que a base cresce:
--   • as consultas que filtram por essa coluna varrem a tabela inteira —
--     products.supplier_id é usada em todo o catálogo, e
--     purchase_order_items.purchase_order_id em cada abertura de ordem;
--   • cada eliminação na tabela referenciada tem de procurar linhas dependentes
--     sem índice, o que torna apagar uma empresa ou um produto cada vez mais lento.
--
-- São 19 índices sobre as chaves estrangeiras que estavam a descoberto.
--
-- Nota para bases já grandes: CREATE INDEX bloqueia escritas na tabela enquanto
-- corre. Com o volume atual é instantâneo. Se um dia for preciso repetir isto
-- numa tabela com milhões de linhas, usa-se CREATE INDEX CONCURRENTLY à mão —
-- não aqui, porque não pode correr dentro de uma transação, e o Prisma envolve
-- cada migração numa.
--
-- Idempotente: pode ser corrido mais do que uma vez sem erro.

CREATE INDEX IF NOT EXISTS "company_documents_company_id_idx" ON "company_documents"("company_id");

CREATE INDEX IF NOT EXISTS "contracts_client_company_id_idx" ON "contracts"("client_company_id");
CREATE INDEX IF NOT EXISTS "contracts_supplier_company_id_idx" ON "contracts"("supplier_company_id");

CREATE INDEX IF NOT EXISTS "favorites_product_id_idx" ON "favorites"("product_id");

CREATE INDEX IF NOT EXISTS "invoices_contract_id_idx" ON "invoices"("contract_id");

CREATE INDEX IF NOT EXISTS "kit_items_kit_id_idx" ON "kit_items"("kit_id");
CREATE INDEX IF NOT EXISTS "kit_items_product_id_idx" ON "kit_items"("product_id");

CREATE INDEX IF NOT EXISTS "kixima_to_client_policies_company_id_idx" ON "kixima_to_client_policies"("company_id");

-- A mais importante de todas: todo o marketplace filtra produtos por fornecedor.
CREATE INDEX IF NOT EXISTS "products_supplier_id_idx" ON "products"("supplier_id");

CREATE INDEX IF NOT EXISTS "purchase_order_items_product_id_idx" ON "purchase_order_items"("product_id");
CREATE INDEX IF NOT EXISTS "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");

CREATE INDEX IF NOT EXISTS "purchase_orders_approved_by_id_idx" ON "purchase_orders"("approved_by_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_contract_id_idx" ON "purchase_orders"("contract_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_created_by_id_idx" ON "purchase_orders"("created_by_id");

CREATE INDEX IF NOT EXISTS "quote_items_product_id_idx" ON "quote_items"("product_id");
CREATE INDEX IF NOT EXISTS "quote_items_quote_request_id_idx" ON "quote_items"("quote_request_id");

CREATE INDEX IF NOT EXISTS "reviews_user_id_idx" ON "reviews"("user_id");

CREATE INDEX IF NOT EXISTS "supplier_to_kixima_policies_company_id_idx" ON "supplier_to_kixima_policies"("company_id");

CREATE INDEX IF NOT EXISTS "users_company_id_idx" ON "users"("company_id");

-- Divergência antiga entre as migrações e o schema.prisma: a coluna foi criada
-- com DEFAULT CURRENT_TIMESTAMP, mas no modelo é @updatedAt — que o Prisma
-- preenche do lado da aplicação, sem default na base. Enquanto isto não bate
-- certo, `prisma migrate diff` acusa sempre uma diferença e deixa de servir para
-- detetar divergências reais.
ALTER TABLE "supplier_dev_requests" ALTER COLUMN "updated_at" DROP DEFAULT;
