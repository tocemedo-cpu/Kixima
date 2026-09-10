-- Thresholds de desconto por economia de escala (Category Management),
-- configuráveis em runtime — ver categoryAnalyticsService.js/
-- discountThresholdService.js. Sem linhas aqui, nenhum desconto se aplica.
CREATE TABLE "discount_thresholds" (
    "id" TEXT NOT NULL,
    "min_volume_usd" DECIMAL(16,2) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_thresholds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "discount_thresholds_ativo_min_volume_usd_idx" ON "discount_thresholds"("ativo", "min_volume_usd");

-- Seed com os 3 patamares pedidos: < $100.000 sem desconto (implícito, sem
-- linha); ≥ $100.000 → 2,5%; ≥ $500.000 → 5%; ≥ $1.000.000 → 10%.
INSERT INTO "discount_thresholds" ("id", "min_volume_usd", "discount_percent", "ativo", "created_at", "updated_at") VALUES
    ('63ff40fc-cfb1-409c-a3e5-6b35609a8d06', 100000.00, 2.5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('95d38501-793a-4677-8506-8088e45606cc', 500000.00, 5.0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('3cf0c909-833c-42cc-b9a2-bdf57c59f48c', 1000000.00, 10.0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
