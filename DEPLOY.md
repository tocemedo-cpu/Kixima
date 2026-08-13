# Deploy da KIXIMA (Render + Supabase)

Coloca a plataforma online num **serviço único**: o backend serve a API em `/api`
**e** o frontend compilado (SPA) na mesma origem — sem CORS nem proxy. A base de
dados é o teu **Supabase** (projeto `zbaybvxycwkyjkndjhly`).

O blueprint está em [`render.yaml`](./render.yaml).

## Pré-requisitos
- O código no **GitHub** (este repositório).
- Conta gratuita em [render.com](https://render.com) ligada ao teu GitHub.
- A **connection string** do teu Supabase (pooler) e a **Database password**.

## Passos

### 1. Garante o código no GitHub
Faz merge desta branch para `main` (ou usa a branch que tem o código ao criar o
blueprint):
```bash
git checkout main && git merge claude/kixima-app-work-gmz6jk && git push origin main
```

### 2. Cria o serviço no Render
1. Render → **New → Blueprint**.
2. Seleciona este repositório (e a branch com o código).
3. O Render lê o `render.yaml` e propõe um web service chamado **kixima**. Confirma.

### 3. Define a base de dados (segredos)
No serviço → **Environment**. Define **duas** variáveis, ambas com o host do
**pooler** (`...pooler.supabase.com`, IPv4). Copia-as em Supabase → Project
Settings → Database → **Connect**:

```
# App — Transaction pooler (porta 6543):
DATABASE_URL=postgresql://postgres.zbaybvxycwkyjkndjhly:A_TUA_DB_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true

# Migrações — Session pooler (porta 5432, MESMO host do pooler):
DIRECT_URL=postgresql://postgres.zbaybvxycwkyjkndjhly:A_TUA_DB_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require
```

> ⚠️ **Não uses** o host direto `db.<ref>.supabase.co:5432` — é **só IPv6** e no
> Render dá `P1001: Can't reach database server`. Usa sempre o host `pooler`.
> Substitui `A_TUA_DB_PASSWORD` pela tua Database password (só no dashboard, nunca no git).

O `JWT_SECRET` é **gerado automaticamente** pelo Render. As restantes variáveis já
vêm definidas no `render.yaml`.

### 4. Deploy
Clica **Create / Deploy**. O build:
- compila o frontend (`vite build`),
- gera o Prisma Client,
- e no arranque corre **`prisma migrate deploy`** → aplica as migrações versionadas
  (pasta `backend/prisma/migrations`) à base de dados, pela ligação DIRETA (`DIRECT_URL`).

Quando ficar "Live", abre o URL do serviço (algo como `https://kixima.onrender.com`).

### 4b. Migrações (Supabase) — passo único de baseline ⚠️
O projeto usa **migrações Prisma** (SQL versionado, seguro) em vez de `db push`.
A app usa o **pooler de transação** (`DATABASE_URL`, porta 6543) e as migrações o
**pooler de sessão** (`DIRECT_URL`, porta 5432) — ambos no host `...pooler.supabase.com`
(IPv4). Nunca o host direto `db.<ref>.supabase.co` (IPv6, dá `P1001`). Ver secção 3.

Como a tua base **já tinha as tabelas** (criadas por `db push`), a 1ª execução do
`migrate deploy` daria `P3005 (schema not empty)`. O arranque **trata disto
automaticamente** (auto-baseline): se apanhar o P3005, faz `prisma migrate
resolve --applied 0_init` e volta a correr o `migrate deploy`. Ou seja, **basta
fazer deploy** — não precisas de correr nada à mão.

> Se preferires fazer o baseline manualmente (ex.: local com o `DIRECT_URL` do
> Supabase): `cd backend && npm run migrate:baseline`.

A partir daí, cada nova migração aplica-se sozinha no deploy.

**Fluxo de futuras alterações ao esquema:** altera `schema.prisma`, gera a migração
(`npx prisma migrate dev --name a_minha_alteracao` em local com `DIRECT_URL`), faz
commit da pasta `prisma/migrations/…` e deploy — o `migrate deploy` aplica-a.
Confirma o estado com `npm run migrate:status`.

### 5. (Opcional) Dados de exemplo — OPT-IN
Os dados de demonstração **nunca entram sozinhos** em produção: o arranque só
carrega o catálogo fictício (fornecedor "Catálogo KIXIMA (Demonstração)" + 119
itens) se a variável `LOAD_DEMO_CATALOG=1` estiver definida no Render.

- **Para um piloto/testes:** define `LOAD_DEMO_CATALOG=1` no Environment e faz
  deploy — o catálogo de demonstração (re)carrega a cada arranque (idempotente).
- **Para produção real:** não definas a variável (ou remove-a) e, para limpar os
  dados de demonstração já carregados antes desta mudança, corre no Shell:
  ```bash
  cd backend && npm run demo:remove
  ```
  (apaga o fornecedor fictício e os seus produtos; os que já estiverem
  referenciados por ordens reais são apenas desativados, preservando o histórico).
- **Personas de teste completas** (5 utilizadores, ordens, faturas — password
  `Kixima@123`), só para ambientes de teste: `cd backend && npm run seed:demo`.

## Variáveis de ambiente (já no `render.yaml`, exceto o segredo)
| Variável | Valor | Notas |
|---|---|---|
| `DATABASE_URL` | *(segredo, no dashboard)* | string do pooler Supabase |
| `JWT_SECRET` | *(auto-gerado)* | segredo de assinatura dos tokens da app |
| `NODE_ENV` | `production` | |
| `FRONTEND_DIST` | `../frontend/dist` | faz o backend servir o SPA |
| `PAYMENT_SLA_DAYS` | `7` | prazo de pagamento |
| `POLICY_EXPIRY_ALERT_DAYS` | `30` | alerta de apólice |
| `EMAIL_PROVIDER` | `brevo` | `console` = **nada é enviado**, fica só no log |

### Modelo comercial (Taxa KIXIMA e planos)
As taxas são definidas **em dólares**; as POs e faturas continuam em Kwanzas. O
câmbio serve apenas para aferir o limiar dos 0,20% e fica **gravado em cada
taxa**, para o histórico não mudar quando o câmbio mudar.

| Variável | Valor por omissão | O que faz |
|---|---|---|
| `KIXIMA_FEE_PER_PO_USD` | `8` | taxa fixa por ordem de compra (até ao limiar) |
| `KIXIMA_FEE_PER_INVOICE_USD` | `15` | taxa fixa por fatura |
| `KIXIMA_FEE_THRESHOLD_USD` | `11500` | limiar por transação |
| `KIXIMA_FEE_PERCENT_ABOVE` | `0.002` | 0,20% — **substitui** o valor fixo acima do limiar |
| `KIXIMA_USD_AOA_RATE` | `900` | câmbio USD→AOA para aferir o limiar — **atualiza-o quando o Kwanza mudar** |
| `KIXIMA_SEAT_PRICE_CAP_USD` | `100` | teto da taxa de acesso por utilizador/mês (plano Básico) |

**Planos:** `BASICO` (micro/pequenas/médias) e `PRO` (obrigatório para grandes
empresas; inclui a integração com ERPs — SAP, AS400, Ariba, Maximo, Oracle). A
dimensão é declarada no cadastro (nº de trabalhadores e volume de negócios),
classificada automaticamente pelo critério MPME e confirmada pelo Admin do
Sistema em **Planos e Subscrições**.

## Antes de abrir a operadoras — as cinco coisas que faltam

Estas definições vivem no painel do Render e **não dão erro quando faltam**: a
aplicação arranca à mesma e comporta-se como se estivesse tudo bem. Por isso há
uma página que as verifica de dentro: entra como Admin do Sistema em
**Configurações e Suporte → Prontidão para produção**. Ela lê o que o processo
tem mesmo carregado, diz o que falta, e traz dois botões que confirmam o que a
configuração sozinha não confirma — **Fazer cópia agora** e **Enviar email de
teste para mim**.

> O plano `free` do Render **não tem Shell**. Todos os `npm run …` referidos
> neste ficheiro pressupõem um plano pago ou execução local com as variáveis do
> Supabase. A página de Prontidão é a alternativa que funciona no plano free.

**A ordem interessa.** A rotação da senha da base derruba o serviço até o Render
ser atualizado, por isso faz-se **por último**, junto com tudo o resto, num só
guardar → um só redeploy.

### 1. Bucket privado para as cópias (`STORAGE_BACKUP_BUCKET`)
1. Supabase → **Storage → New bucket** → nome `kixima-backups`.
2. **Deixa "Public bucket" DESLIGADO.** Este é o ponto todo: o bucket
   `product-images` é público por necessidade (é de lá que o marketplace serve
   as fotos), e um dump da base tem hashes de senha, os dados de todas as
   empresas e o histórico financeiro. Num bucket público ficaria descarregável
   por quem soubesse o URL.
3. Render → Environment: `STORAGE_BACKUP_BUCKET=kixima-backups`.

As credenciais S3 são as mesmas do `product-images` — não é preciso criar
outras. Se esta variável faltar, ou se for igual a `STORAGE_BUCKET`, a cópia
automática **recusa-se a correr**, de propósito.

### 2. Email a sério (`EMAIL_PROVIDER=brevo` + `BREVO_API_KEY`)
Enquanto `EMAIL_PROVIDER=console`, **nada sai**: convites, recuperação de senha
e avisos de fatura ficam no log e o utilizador nunca vê erro — simplesmente não
recebe.

1. Cria conta em [brevo.com](https://www.brevo.com) (o plano gratuito dá 300
   emails/dia).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: regista o
   endereço que vai aparecer como remetente e **confirma o email de
   verificação**. Sem esta verificação o Brevo recusa o envio.
3. **SMTP & API → API Keys → Generate a new API key**. A chave começa por
   `xkeysib-`. É mostrada **uma única vez**.
4. Render → Environment:
   ```
   EMAIL_PROVIDER=brevo
   BREVO_API_KEY=xkeysib-…        (segredo)
   EMAIL_FROM=Kixima <o-remetente-verificado@…>
   APP_URL=https://o-teu-dominio
   ```
   O `APP_URL` não é um detalhe: os links dos convites e da recuperação de senha
   são construídos a partir dele. Em `localhost` saem links que não funcionam
   para ninguém.
5. Confirma com **Prontidão para produção → Enviar email de teste para mim**.

> Porquê a API e não SMTP: o Render bloqueia portas SMTP de saída (25/465/587) e
> o envio fica em *connection timeout*. A API do Brevo usa a 443.

### 3. Cópia de segurança automática (`BACKUP_CRON`)
```
BACKUP_CRON=0 3 * * *
```
Cinco campos, **hora UTC** — este exemplo é uma cópia diária às 03:00 UTC (04:00
em Luanda). A cópia usa a `DIRECT_URL` e vai para o bucket privado do ponto 1.

Depois de o deploy ficar Live, carrega em **Fazer cópia agora**. Uma cópia
agendada que nunca foi vista a correr é uma suposição: o botão confirma de uma
vez que o `pg_dump` existe na imagem, que a ligação direta serve, que as
credenciais são aceites e que o bucket privado recebe o ficheiro.

Cada cópia fica registada no **trilho de auditoria** (`COPIA_SEGURANCA_CONCLUIDA`),
e a página assinala a vermelho se a última tiver mais de 48 horas — é assim que
se dá por uma cópia que deixou de correr.

> **Uma cópia que nunca foi restaurada não é uma cópia.** O ensaio de restauro
> (`npm run backup:restore-test`) repõe a cópia numa base descartável e compara
> as contagens tabela a tabela. Corre-o localmente de vez em quando.

### 4. 2FA obrigatória (`MFA_ENFORCE_FROM`)
```
MFA_ENFORCE_FROM=2026-09-15T00:00:00Z
```
Data **futura**, em UTC. Até lá, quem tem perfil `ADMIN_SISTEMA` ou
`COMPANY_ADMIN` e ainda não configurou a 2FA entra normalmente e vê um aviso.
A partir dela, a sessão dessas contas passa a ser **restrita**: só dá acesso ao
ecrã de ativação da 2FA e a mais nada.

O prazo existe por uma razão prática — ativar a 2FA exige estar *dentro* da
aplicação. Sem prazo, trancava-se os administradores fora no dia do lançamento,
e a única saída seria mexer na base à mão. Escolhe uma data que dê tempo de
avisar as pessoas, e confirma na página de Prontidão quantas contas ainda não a
têm antes de a data chegar.

### 5. Rodar a senha da base de dados
A senha do Supabase foi partilhada em texto e tem de ser considerada
comprometida. **Este passo derruba o serviço até o Render ser atualizado**, por
isso deixa-o para o fim.

1. Supabase → **Project Settings → Database → Reset database password**. Guarda
   a nova senha no teu gestor de senhas.
   > Se a definires tu, usa **só letras e números**. Caracteres como `@ : / ? #`
   > partem a connection string, a não ser que sejam codificados em percentagem.
2. Render → Environment: atualiza **as duas** variáveis, porque a senha aparece
   nas duas:
   ```
   DATABASE_URL=…:NOVA_SENHA@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
   DIRECT_URL=…:NOVA_SENHA@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require
   ```
3. Guarda tudo de uma vez → o Render faz **um** redeploy.
4. Quando ficar Live, abre a página de Prontidão: as duas ligações devem estar a
   verde.

Enquanto lá estás, considera rodar também o `JWT_SECRET` (termina todas as
sessões abertas — o que é aceitável, e às vezes é mesmo o que se quer).

## Notas de produção
- **Imagens de produtos (persistência):** por omissão ficam em disco local, que
  no plano free do Render é **efémero** (perde-se em cada deploy). Para
  persistirem, usa o **Supabase Storage** (S3-compatível, já tens Supabase):
  1. Supabase → Storage → cria um bucket **público** `product-images`.
  2. Storage → Settings → **S3 Connection**: ativa e copia Access key / Secret.
  3. No Render → Environment, acrescenta:
     ```
     STORAGE_PROVIDER=s3
     STORAGE_BUCKET=product-images
     STORAGE_REGION=eu-central-1
     STORAGE_ENDPOINT=https://zbaybvxycwkyjkndjhly.supabase.co/storage/v1/s3
     STORAGE_PUBLIC_URL=https://zbaybvxycwkyjkndjhly.supabase.co/storage/v1/object/public/product-images
     STORAGE_ACCESS_KEY=...   (segredo)
     STORAGE_SECRET_KEY=...   (segredo)
     STORAGE_FORCE_PATH_STYLE=true
     ```
  4. **Verifica** em Configurações e Suporte → **Prontidão para produção** (ou,
     se tiveres Shell, `cd backend && npm run storage:check`, que envia um
     objeto de teste e confirma `HTTP 200` no URL público).
  A partir daí, as fotos carregadas pelos fornecedores (incluindo a importação
  em massa **Catálogo → Importar (Excel)**) ficam guardadas no Supabase e
  sobrevivem aos deploys. Nota: as imagens do catálogo de demonstração vão no
  próprio build (pasta `catalog/`), pelo que já persistem sem Storage.
- **Segurança e email:** ver a secção *Antes de abrir a operadoras* acima.
- **Domínio próprio:** podes ligar `app.kixima.co.ao` em Settings → Custom
  Domains. Depois de o ligares, atualiza o `APP_URL` — é dele que saem os links
  dos convites e da recuperação de senha.
- **Rastreio de erros (Sentry):**
  1. Cria conta em sentry.io → **Create Project** → plataforma **Node.js** (dá o
     DSN do backend) e outra **React** (dá o DSN do frontend). Copia cada DSN
     (`https://…@…ingest.sentry.io/…`).
  2. No Render → Environment: `SENTRY_DSN` = DSN do Node; e o **build-arg**
     `VITE_SENTRY_DSN` = DSN do React (é embutido no build do frontend).
  3. **Verifica** o backend (no Shell do serviço): `cd backend && npm run sentry:test`
     → deve aparecer um issue em Sentry → Issues. O frontend confirma-se quando
     ocorrer um erro real (o `ErrorBoundary` mostra o ecrã de recurso e reporta).

  Sem estas variáveis o rastreio fica desligado e a app corre normalmente; com
  elas, os erros de servidor (5xx) e as falhas de UI passam a ser reportados.
