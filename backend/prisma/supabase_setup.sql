-- ============================================================================
-- KIXIMA — Criação da base de dados no Supabase
-- Tradução 1:1 de prisma/schema.prisma para SQL puro.
--
-- COMO USAR:
--   1. Abra o seu projeto em https://supabase.com/dashboard
--   2. Vá a "SQL Editor" -> "New query"
--   3. Cole este ficheiro inteiro e clique "Run"
--   4. Confirme em "Table Editor" que as tabelas foram criadas
--
-- Depois disto, o backend só precisa da DATABASE_URL real (Project Settings
-- -> Database -> Connection string) no seu .env.development/.env.production
-- — NÃO das chaves de API que partilhou no chat (essas servem para outra
-- coisa; ver explicação na conversa).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Tipos (enums)
-- ----------------------------------------------------------------------------

create type company_type as enum ('CLIENTE', 'FORNECEDOR');
create type company_status as enum ('PENDENTE', 'APROVADA', 'REJEITADA', 'SUSPENSA');
create type persona_role as enum ('COMPRADOR', 'COMPANY_ADMIN', 'FORNECEDOR', 'FINANCEIRO', 'ADMIN_SISTEMA');

create type po_status as enum (
  'AGUARDANDO_APROVACAO', 'APROVADA', 'REJEITADA', 'ACEITE_FORNECEDOR',
  'RECUSADA_FORNECEDOR', 'AGUARDANDO_PAGAMENTO', 'PAGA', 'EM_EXECUCAO',
  'ENTREGUE', 'RECEBIDA_CONFORME', 'RECEBIDA_COM_DIVERGENCIA', 'CONCLUIDA'
);

create type invoice_status as enum ('PENDENTE', 'PAGA', 'VENCIDA', 'CANCELADA');
create type payment_status as enum ('PROCESSADO', 'FALHOU');
create type policy_status as enum ('SUBMETIDA', 'APROVADA', 'REJEITADA', 'EXPIRADA');
create type contract_status as enum ('ATIVO', 'EXPIRADO', 'ENCERRADO');
create type billing_periodicity as enum ('TRIMESTRAL', 'SEMESTRAL');
create type notification_channel as enum ('IN_APP', 'EMAIL', 'IN_APP_EMAIL');

create type notification_type as enum (
  'PO_AGUARDA_APROVACAO', 'PO_APROVADA', 'PO_REJEITADA', 'PO_RECEBIDA_FORNECEDOR',
  'FATURA_GERADA', 'PAGAMENTO_PROCESSADO', 'ENTREGA_DESPACHADA',
  'RECECAO_COM_DIVERGENCIA', 'APOLICE_SUBMETIDA_APROVADA', 'APOLICE_A_EXPIRAR',
  'CADASTRO_EMPRESA_APROVADO', 'CADASTRO_EMPRESA_REJEITADO'
);

-- ----------------------------------------------------------------------------
-- Função utilitária: mantém updated_at em dia (equivalente ao @updatedAt do Prisma)
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- companies
-- ----------------------------------------------------------------------------

create table companies (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  tax_id         text not null unique,
  type           company_type not null,
  status         company_status not null default 'PENDENTE',
  contact_email  text not null,
  contact_phone  text,
  address        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  approved_at    timestamptz,
  rejected_at    timestamptz
);

create trigger trg_companies_updated_at before update on companies
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------

create table users (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null unique,
  password_hash  text not null,
  role           persona_role not null,
  approval_cap   numeric(14,2),
  company_id     uuid references companies(id),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- products (catálogo)
-- ----------------------------------------------------------------------------

create table products (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references companies(id),
  name            text not null,
  description     text,
  category        text not null,
  unit_price      numeric(14,2) not null,
  currency        text not null default 'AOA',
  lead_time_days  integer,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_products_category on products(category);

create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- contracts (contratos-quadro) — criada antes de purchase_orders por causa da FK
-- ----------------------------------------------------------------------------

create table contracts (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,
  client_company_id    uuid not null references companies(id),
  supplier_company_id  uuid not null references companies(id),
  categories_covered   text[] not null default '{}',
  total_value          numeric(14,2) not null,
  currency             text not null default 'AOA',
  used_value           numeric(14,2) not null default 0,
  billing_periodicity  billing_periodicity not null,
  payment_term_days    integer not null,
  status               contract_status not null default 'ATIVO',
  valid_from           timestamptz not null,
  valid_until          timestamptz not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_contracts_updated_at before update on contracts
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- purchase_orders (fluxo central)
-- ----------------------------------------------------------------------------

create table purchase_orders (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique,
  buyer_company_id      uuid not null references companies(id),
  supplier_company_id   uuid not null references companies(id),
  created_by_id         uuid not null references users(id),
  approved_by_id        uuid references users(id),
  status                po_status not null default 'AGUARDANDO_APROVACAO',
  total_amount          numeric(14,2) not null,
  currency              text not null default 'AOA',
  is_call_off           boolean not null default false,
  contract_id           uuid references contracts(id),
  accepted_at           timestamptz,
  payment_due_at        timestamptz,
  paid_at               timestamptz,
  dispatched_at         timestamptz,
  delivered_at          timestamptz,
  received_at           timestamptz,
  reception_status      text,
  approved_at           timestamptz,
  rejected_at           timestamptz,
  rejection_reason      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_po_status on purchase_orders(status);
create index idx_po_buyer_company on purchase_orders(buyer_company_id);
create index idx_po_supplier_company on purchase_orders(supplier_company_id);

create trigger trg_po_updated_at before update on purchase_orders
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- purchase_order_items
-- ----------------------------------------------------------------------------

create table purchase_order_items (
  id                 uuid primary key default gen_random_uuid(),
  purchase_order_id  uuid not null references purchase_orders(id) on delete cascade,
  product_id         uuid not null references products(id),
  quantity           integer not null,
  unit_price         numeric(14,2) not null,
  line_total         numeric(14,2) not null
);

-- ----------------------------------------------------------------------------
-- invoices
-- ----------------------------------------------------------------------------

create table invoices (
  id                   uuid primary key default gen_random_uuid(),
  reference            text not null unique,
  purchase_order_id    uuid unique references purchase_orders(id),
  contract_id          uuid references contracts(id),
  consolidated_po_ids  text[] not null default '{}',
  amount               numeric(14,2) not null,
  currency             text not null default 'AOA',
  status               invoice_status not null default 'PENDENTE',
  issued_at            timestamptz not null default now(),
  due_at               timestamptz not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_invoices_updated_at before update on invoices
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- payments
-- ----------------------------------------------------------------------------

create table payments (
  id                uuid primary key default gen_random_uuid(),
  invoice_id        uuid not null unique references invoices(id),
  amount            numeric(14,2) not null,
  currency          text not null default 'AOA',
  status            payment_status not null default 'PROCESSADO',
  processed_by_id   uuid not null references users(id),
  reference         text not null unique,
  processed_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- budget_limits (opcional, MVP)
-- ----------------------------------------------------------------------------

create table budget_limits (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null unique references companies(id),
  period_monthly  numeric(14,2) not null,
  currency        text not null default 'AOA',
  updated_at      timestamptz not null default now()
);

create trigger trg_budget_limits_updated_at before update on budget_limits
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Apólices
-- ----------------------------------------------------------------------------

create table supplier_to_kixima_policies (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id),
  policy_number    text not null,
  insurer          text not null,
  coverage_amount  numeric(14,2) not null,
  currency         text not null default 'AOA',
  status           policy_status not null default 'SUBMETIDA',
  valid_from       timestamptz not null,
  valid_until      timestamptz not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_supplier_policies_updated_at before update on supplier_to_kixima_policies
  for each row execute function set_updated_at();

create table kixima_to_client_policies (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references companies(id),
  policy_number          text not null,
  insurer                text not null,
  coverage_amount        numeric(14,2) not null,
  currency               text not null default 'AOA',
  status                 policy_status not null default 'APROVADA',
  issued_by_id           uuid not null references users(id),
  valid_from             timestamptz not null,
  valid_until            timestamptz not null,
  expiry_alert_sent_at   timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger trg_client_policies_updated_at before update on kixima_to_client_policies
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- notifications
-- ----------------------------------------------------------------------------

create table notifications (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references users(id),
  company_id           uuid references companies(id),
  type                 notification_type not null,
  channel              notification_channel not null default 'IN_APP',
  title                text not null,
  message              text not null,
  read_at              timestamptz,
  related_entity_type  text,
  related_entity_id    text,
  created_at           timestamptz not null default now()
);

create index idx_notifications_user on notifications(user_id);
create index idx_notifications_company on notifications(company_id);

-- ============================================================================
-- Fim. 12 tabelas, 11 tipos enum, índices e triggers de updated_at criados.
-- ============================================================================
