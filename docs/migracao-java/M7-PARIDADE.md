# M7 — Validação de paridade em profundidade

O que o plano pede (secção 3, marco 8, e secção 4): **diff de contrato em
todos os endpoints** e **replay de contrato ao vivo** — gravar pedidos reais
contra o Node, reproduzir os mesmos contra o Java apontado à mesma cópia da
base, comparar estado + corpo JSON estruturalmente — mais um teste de carga
contra uma réplica de staging. Este documento é o registo do que foi feito, o
que se encontrou, o que se corrigiu e o que fica documentado como desvio.

Tudo o que aqui está corre com `backend-java/paridade/correr.sh` (ver o fim do
documento) e é repetível a qualquer momento.

## 1. Inventário mecânico de rotas

`paridade/inventario.py` lê as rotas do Node (34 routers + rotas directas do
`app.js`) e os `@RequestMapping` dos controllers Java.

| | Rotas |
|---|---|
| Node | 246 |
| Java | 246 |
| Comuns | 245 |

A única diferença é um artefacto do parser: `GET /api/policies/company/{}?`
(parâmetro opcional no Express) é em Java `@GetMapping({"/company", "/company/{companyId}"})`
— as duas formas existem nos dois lados. `/health` e `/ready` foram
acrescentados ao Java neste marco (`ops/HealthController`: `/ready` faz
`SELECT 1` com 3 s de tecto e devolve 503 `degradado` quando a base não
responde).

## 2. Replay de contrato Node × Java

### Como

- `paridade/cenario.json`: 95 passos que percorrem as cinco personas
  (comprador, company admin, financeiro, fornecedor, admin do sistema):
  sondas públicas, leituras em todos os domínios (catálogo, marketplace,
  painéis, financeiro, empresa, subscrição/add-ons, cotações, contratos,
  apólices, notificações, relatórios, kits, PO Robot, suporte, conversas,
  admin, faturação, conciliação), o **fluxo completo de uma ordem de compra**
  (criar → aprovar → aceitar/gerar fatura → pagar com comprovativo multipart →
  despachar → entregue → receção conforme → histórico) e os caminhos de erro
  (401, 403, 404, 422, plano insuficiente).
- `paridade/replay.mjs gravar` inicia sessão por persona, substitui
  `{{variáveis}}` capturadas de respostas anteriores (ids da PO, da fatura…),
  e grava estado, content-type e corpo de cada resposta.
- `paridade/replay.mjs comparar` faz o diff estrutural das duas gravações.
  Só é ignorado o genuinamente não-determinístico, listado em
  `paridade/ignorar.json` (ids gerados, carimbos, tokens, latências, URLs de
  ficheiros, `referenciaPagamento` gerada na primeira leitura); UUIDs, datas
  ISO, JWTs e referências com bytes aleatórios (`PAY-1AF199F2`) são tratados
  como equivalentes quando ambos os lados têm essa forma.
- `paridade/correr.sh` restaura o mesmo `pg_dump` antes de cada lado, arranca
  o servidor, grava, desliga, e restaura no fim — os dois backends vêem
  exactamente a mesma base.

### Resultado final

| | |
|---|---|
| Passos | 95 |
| Iguais (estado + content-type + corpo) | **89** |
| Com diferenças, todas explicadas abaixo | 6 |
| Campos decimais string↔número tolerados | 0 |

### Defeitos reais encontrados pelo replay e corrigidos neste marco

O replay foi feito para isto: a suíte JUnit (164 testes, 100 % verdes) tinha
passado por cima de todos eles.

1. **500 em `GET /api/purchase-orders/{id}`, `/accept` e na listagem** —
   `LazyInitializationException` ("no Session"): o controller mapeava a PO
   para DTO depois da transação do serviço fechar (`open-in-view: false`), e
   `items` é lazy. Os testes MockMvc não o apanhavam porque correm cada teste
   dentro de UMA transação. Corrigido com `po/PoDtoService` (o DTO nasce
   dentro de uma transação de leitura própria, o equivalente do
   `findUnique({ include })` do Prisma) e, para esta classe inteira de avaria,
   `SemSessaoSmokeTest`: um teste **sem** `@Transactional` que percorre ~95
   leituras de todas as personas como o servidor real as executa e recusa
   qualquer 5xx.
2. **Forma da resposta das ordens de compra** — o Node devolve formas
   diferentes por função (transições: só a linha; criação: + `items`;
   listagem: + `items` e `invoice.payment`; detalhe: `items.product`,
   `invoice.{payment(+processedByName), creditNotes, lines}`,
   `buyerCompany`/`supplierCompany` com os 13 COMPANY_FIELDS, `createdBy`/
   `approvedBy` (nome), `contract.reference`). O Java devolvia sempre a linha +
   `items`. Sem `invoice` no detalhe, o frontend não conseguia sequer chegar
   ao pagamento. `PurchaseOrderDto` reescrito com essas quatro formas;
   `InvoiceDto` ganhou os campos que faltavam (`agtRequestId`, `agtResultCode`,
   `agtErro`, `agtEstado`, `hashAnterior`, `assinadaEm`, `updatedAt`) e as
   relações; `InvoiceLineDto` é novo; a listagem passou a `createdAt desc`
   como no Node; as faturas pendentes trazem a PO inteira (não um resumo).
3. **Decimais** — o Node devolve TODAS as colunas `Decimal` do Prisma como
   texto (`"unitPrice": "3200000"`, o `toJSON()` do decimal.js) e o que é
   aritmética em JS como número; o Java devolvia tudo como número. Eram **228
   campos** num cenário de 81 passos. `config/JacksonDecimalConfig` serializa
   `BigDecimal` como texto sem zeros à direita; os valores que no Node são
   `Number(...)`/somas/`Math.round` (preços de tabela, KPIs dos painéis, taxas
   da plataforma, totais dos relatórios, relatório de conteúdo local) saem
   como número via `Decimais.numero`/`Decimais.ComoNumeroJs`. O frontend lê
   os valores com `Number(...)`, portanto é indiferente para ele — mas o
   contrato é o do Node.
4. **`updatedAt` nunca era actualizado** em `PurchaseOrder`, `Invoice`, `Kit`,
   `Product` e `SupportCategoryImage` (o Prisma fá-lo com `@updatedAt`): a
   linha de tempo do admin ordenava mal e o campo mentia. `@UpdateTimestamp`.
5. **Canais de cobrança**: `emFalta` listava nomes de variáveis de ambiente
   (`EMIS_BASE_URL`); o Node lista as chaves do CONFIG (`baseUrl`, `posId`…),
   que é o que o painel mostra. Corrigido em `HttpGatewayAdapter` e
   `MulticaixaService` (a mensagem de erro continua a dizer a variável).
6. **422**: `error.details` era uma lista; o Node devolve o `flatten()` do zod
   (`{formErrors, fieldErrors}`). Mesma forma agora, e os textos por omissão
   do zod para `@NotNull`/`@NotBlank` ("Required") e `@NotEmpty` ("Array must
   contain at least 1 element(s)") em `ValidationMessages.properties`.
7. **Auditoria**: `detail.valor` era `"273600.00"` (o Node escreve
   `String(decimal)` → `"273600"`); `detail.notas` era `""` quando o Node
   grava `null`. `Decimais.texto` nos cinco sítios; `notas` a `null`.
8. **Eventos** (`EventPayloads`): os valores são números (`Number(d)` no
   `eventBus.js`), não o texto Decimal das respostas HTTP.

### Diferenças que ficam, e porquê

| Passo | Diferença | Decisão |
|---|---|---|
| `GET /api/marketplace/facets` | Ordem das categorias/tipos/certificações com a mesma contagem | O Node ordena só por contagem (`kinds` nem isso) e os empates saem na ordem física do Postgres — **não determinístico no próprio Node**, muda com um `UPDATE` qualquer. O Java desempata por nome. Nos dados de semente todos os produtos têm o mesmo `createdAt`, o que exagera o efeito. |
| `GET /api/reports/fornecedor` | Ordem de `topProducts` com a mesma quantidade | Idem: o Node ordena só por quantidade e os empates ficam na ordem de inserção do `findMany` sem `orderBy`. |
| `POST …/pay`, `GET /api/payments/history`, `GET /api/purchase-orders[/{id}]` (4 passos) | `invoice.agtErro.code`: `null` no Node, `"SERVICO_INDISPONIVEL"` no Java; `message` difere só no parêntese que descreve o ficheiro alternativo da chave | O Node lança um `Error` sem código quando a assinatura AGT não está configurada; o Java lança `ServiceUnavailableException` (503, decisão do M4: "recusa-se a fingir" com um código diagnosticável em vez de um 500). O texto refere a configuração centralizada (`kixima.agt.jws-private-key-path`) em vez de dois caminhos fixos. Fica. |
| `GET /api/marketplace/search` (auditoria pré-M8) | O Java desempata a ordenação por `id` no fim do `ORDER BY`; o Node não desempata | Nos empates (a mesma classificação, o mesmo preço) o Node devolve a ordem física do Postgres, que pode repetir ou saltar itens entre páginas; o desempate estável evita-o. Fica. |

Desvios deliberados que o comparador já não vê porque estão em `ignorar.json`:

- **`searchText`**: o Node deixa escapar a coluna interna de pesquisa nas
  linhas `Product`/`Company`; o Java omite-a (o frontend não a usa).
- **Mensagens de validação** de `@Size`/`@Positive`/`@Email`: textos do
  Hibernate Validator, não do zod. A forma e o código são iguais; o frontend
  mostra `error.message` ("Dados inválidos.").

## 3. Teste de carga

### Indicativo, local (`paridade/correr.sh carga`)

20 clientes concorrentes durante 15 s, mistura de nove leituras autenticadas
(catálogo, pesquisa, facets, dashboard, `auth/me`, POs, relatório do
fornecedor, actividades do admin, planos públicos), cada backend sobre a base
acabada de restaurar, na mesma máquina do contentor, sem afinação nenhuma do
Java (heap por omissão, aquecimento de 5 s).

| | Débito | p50 | p95 | p99 | 5xx |
|---|---:|---:|---:|---:|---:|
| Node | 503 pedidos/s | 38 ms | 80 ms | 96 ms | 0 |
| Java | 466 pedidos/s | 40 ms | 94 ms | 122 ms | 0 |

Leitura: **sem regressão de fiabilidade** (zero erros nos dois lados) e
latência da mesma ordem de grandeza; o Java está ~8 % abaixo em débito nesta
máquina sem afinação — dentro do esperado para um JIT frio e um pool de
ligações por omissão. Não é um número de produção. As tabelas completas estão
em `paridade/gravacoes/carga-*.md`.

### Contra a réplica de staging (por fazer — precisa de acesso)

O plano pede o teste contra uma cópia/réplica de staging (secção 5). Não há
acesso a essa réplica a partir deste ambiente. Quando houver:

1. `pg_dump -Fc` da réplica → `DUMP`; `DATABASE_URL`/`DIRECT_URL` a apontar a
   uma base de trabalho restaurada a partir dele (nunca à réplica viva).
2. `DUMP=… PORTA_NODE=… PORTA_JAVA=… DURACAO=120 CONCORRENCIA=50 paridade/correr.sh carga`.
3. Comparar p95/p99 e 5xx por endpoint; um 5xx no Java que não exista no Node
   é bloqueante para o cutover do domínio respectivo.
4. Repetir o replay (`paridade/correr.sh`) sobre o mesmo dump: com dados reais
   o comparador apanha formas que a semente não cobre.

## 4. Dependências transversais fechadas neste marco

- **Rate limiting** (`middleware/rateLimit.js` + limitadores locais de
  `feedbackRoutes.js` e `supplierDevRoutes.js`): portado em
  `security/RateLimitFilter` — um filtro antes da autenticação, com as mesmas
  regras (600/15 min na API, 60/15 min no login/2FA/reset com
  `skipSuccessfulRequests`, 10/15 min no forgot-password contando tudo, 30/15
  min nos fluxos públicos de registo/convite, 60/min nos chats, 10/15 min no
  feedback e nas candidaturas), a mesma chave (à pessoa quando o token é
  válido, ao endereço quando não — `trust proxy 1`, IPv6 agregado a /56), a
  mesma resposta 429 `RATE_LIMITED` e os cabeçalhos draft-7. Desligado no
  perfil de teste como no Node; `RateLimitFilterTest` exercita a configuração
  real (espelha `rate-limit.test.js` e `rate-limit-forgot-password.test.js`).
- `/health` e `/ready`.

## 5. O que ainda não está em Java (deferido, não omitido)

Depois da auditoria pré-M8 (ver `AUDITORIA-PRE-M8.md`) ficaram fechados o
provider **SMTP**, a **i18n dos emails**, o **tecto de linhas** transversal,
o Sentry, os cabeçalhos do helmet/CSP, a allow-list de CORS, o reset de senha
por email, o MFA por email e o pagamento de facturas consolidadas. Continua
por fazer:

- **Teste de carga contra staging** (secção 3).
- **S3 de ponta a ponta** contra um bucket real (o adaptador está portado e
  testado sem rede).
- Confirmar na configuração de produção `SPRING_PROFILES_ACTIVE` (nunca
  `dev`), o provider de email e `SENTRY_DSN`.

O procedimento que fecha estes pontos e faz a passagem está em `M8-CUTOVER.md`.

## 6. Como repetir

```bash
# Base de teste local (a mesma que os testes usam) e um dump dela:
pg_dump -Fc -h localhost -U kixima kixima_test > /tmp/kixima_test.dump

cd backend-java
mvn -o -q package -DskipTests                 # o jar que o replay arranca
DUMP=/tmp/kixima_test.dump paridade/correr.sh          # grava Node e Java, compara
DUMP=/tmp/kixima_test.dump paridade/correr.sh comparar # só compara
DUMP=/tmp/kixima_test.dump paridade/correr.sh carga    # carga indicativa
python3 paridade/inventario.py                        # inventário de rotas
```

As gravações ficam em `paridade/gravacoes/` (`node.json`, `java.json`); o
diff imprime-se em Markdown e o processo sai com código 1 se houver
diferenças.

## 7. Verificação depois da auditoria pré-M8

Depois das correcções de `AUDITORIA-PRE-M8.md`, com a base de testes
reposta a partir da semente:

| Suite | Resultado |
|---|---|
| Java (`mvn -o -q test`) | 271 testes, 0 falhas, 0 erros (depois da preparação do M8) |
| Node (`npm test`, referência) | 111 suites, 1020 testes, 0 falhas |
| Frontend (vitest, build, auditorias i18n) | 167 testes, 0 falhas; 0 textos em falta, 0 hardcoded |
| End-to-end (Playwright, 5 personas, axe nos três fundos) | 83 testes, 0 falhas |
| End-to-end **contra o backend Java** (`VITE_API_TARGET=http://localhost:4001 VITE_REALTIME=stomp`, chat por STOMP incluído) | 83 testes, 0 falhas |

O inventário de rotas continua em 246/246 (`paridade/inventario.py`). A suite
e2e a passar por inteiro contra o Java, com o mesmo frontend e a mesma base
de demonstração, é a prova de cutover mais forte disponível sem a réplica de
staging — ver `M8-CUTOVER.md`.
