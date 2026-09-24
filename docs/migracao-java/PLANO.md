# KIXIMA Backend — Migração Node.js/Express/Prisma → Java/Spring Boot

## Contexto

O backend actual do KIXIMA (`/home/user/Kixima/backend`) é um marketplace B2B angolano em produção, em Node/Express/Prisma sobre PostgreSQL (Supabase). O utilizador pediu a migração completa da linguagem do backend para Java. Dado o risco de reescrever um sistema em produção (71 serviços, 34 rotas, 8 controllers, 49 modelos de dados, 111 testes, incluindo a integração fiscal AGT), foi confirmado com o utilizador:

- **Framework**: Spring Boot.
- **Estratégia**: migração incremental, lado a lado — o Java cresce numa pasta própria (`backend-java/`), o Node **continua em produção** durante toda a migração, sem interrupção.
- **Bug conhecido do NIF fixo no envelope AGT** (`agtPayloadService.js`, já identificado no Manual Técnico/auditoria anterior): corrigir **já, nos dois backends**, como primeiro passo, antes do resto da migração avançar.
- **Tempo real**: usar Spring WebSocket/STOMP nativo — **isto implica alterar o cliente de tempo real do frontend** quando esse domínio for cortado para o Java (única excepção à promessa de "zero mudanças no frontend", e só no momento do cutover desse domínio específico, não agora).

Este plano cobre a estrutura, o mapeamento de dados, a ordem de migração e os critérios de verificação. **Este documento é o plano — a implementação só começa depois de aprovado.**

---

## Passo 0 — Corrigir o bug do NIF fixo (nos dois backends, antes de mais nada)

Em `backend/src/services/agtPayloadService.js`, a função `envelope()` escreve sempre o literal `'5003488276'` em vez de usar o NIF real do fornecedor (o parâmetro `taxRegistrationNumber` é recebido mas ignorado). Corrige-se:
1. No Node (produção actual) — muda-se a linha para usar o parâmetro recebido, com teste de regressão a confirmar que o payload construído para FT/NC/RC usa o `taxId` real de cada fornecedor.
2. Esta correcção é a base a partir da qual o Java (`AgtPayloadService.java`, Fase 4 abaixo) será portado — o Java nasce já correcto, nunca reproduz o bug.

---

## 1. Estrutura do projecto Java

```
backend-java/
  pom.xml                          # Maven (escolha por omissão — mais convencional em Java empresarial)
  src/main/java/ao/kixima/
    KiximaApplication.java
    config/            # SecurityConfig, CorsConfig, RateLimitConfig (Bucket4j), AsyncConfig, SchedulingConfig
    security/           # JwtService, SessionCookieUtil, AuthenticationFilter, CurrentUser, RBAC (@RequireRole etc.)
    common/
      error/            # AppException + hierarquia (mirror de utils/errors.js), GlobalExceptionHandler
      pagination/        # mirror de utils/paginacao.js
      reference/          # mirror de utils/reference.js (gerador atómico de referências)
    <dominio>/           # um pacote por domínio Node (auth, company, catalog, po, invoice, payment,
                          # contract, policy, support, notification, admin, ...)
      <Dominio>Controller.java   # fino, espelha controllers/*.js exactamente (caminhos, verbos, DTOs)
      <Dominio>Service.java      # lógica de negócio, espelha services/*.js
      <Dominio>Repository.java   # Spring Data JPA
      dto/ entity/
    agt/                 # módulo próprio dado o tamanho/complexidade (AgtPayloadService, AgtSigningService,
                          # AgtSandboxClient, AgtSeriesService, AgtSandboxSubmissionService, FaturacaoHashChain)
    jobs/                # 6 jobs @Scheduled
    realtime/            # Spring WebSocket/STOMP
    messaging/           # RabbitMQ opcional/não-bloqueante
  src/main/resources/
    application.yml, application-{dev,test,prod}.yml
    db/migration/         # Flyway, baseline sobre o schema já existente (não recomeça o histórico do Prisma)
  src/test/java/ao/kixima/...   # JUnit5 + Mockito + MockMvc, espelha tests/ 1:1 por domínio
```

**Porquê pacote-por-domínio**: o Node já organiza por domínio atravessando camadas (routes→controllers→services), não por camada técnica. Mirroring com `po/PoController`, `po/PoService`, `po/PoRepository` mantém cada domínio revisável como um único directório e isola a complexidade do AGT no seu próprio módulo.

---

## 2. Mapeamento JPA sobre o schema Supabase existente (sem migração de dados)

- **Sem migração de dados** — o Java liga-se à mesma base de dados Supabase, às mesmas tabelas.
- Cada entidade recebe `@Table(name=...)` e cada coluna `@Column(name=...)` explícitos, replicando exactamente os `@@map`/`@map` do `schema.prisma` — nunca confiar na convenção implícita do Hibernate, mesmo quando coincidiria. Um script de geração mecânica (lido a partir de `schema.prisma`, não à mão) produz o esqueleto das 49 entidades, para eliminar erros de transcrição.
- **Verificação obrigatória antes da Fase 0 terminar**: confirmar se `@default(uuid())` no Prisma corresponde a um `DEFAULT gen_random_uuid()` real na coluna Postgres, ou se é gerado só do lado da aplicação Prisma — determina se `@GeneratedValue`/`@UuidGenerator` chega, ou se o Java tem de gerar o UUID explicitamente antes do `INSERT`, tal como o Node faz hoje.
- **Decimais**: `Decimal(p,s)` → `BigDecimal` com `precision`/`scale` iguais. Antes da Fase 3c (imposto/taxas), confirmar concretamente o modo de arredondamento que a matemática actual em Node produz (via a biblioteca decimal usada pelo Prisma), e replicar com o `RoundingMode` correspondente em Java — desvio silencioso aqui afecta dinheiro directamente.
- **Enums**: mapear com `@Enumerated(EnumType.STRING)`. Antes da Fase 0 terminar, tirar a lista completa de enums da base viva (`information_schema` ou `\dT+`), não só do `schema.prisma`, porque nem todos foram ainda inventariados.
- **Relações**: `fetch = LAZY` em todas — o Node usa `include` explícito por query, por isso `EAGER` por omissão mudaria silenciosamente a forma/desempenho das respostas. Cada resposta JSON é construída por um mapper explícito, nunca por serializar o grafo da entidade directamente, para garantir paridade exacta de forma com as respostas actuais.

**Migrações daqui para a frente**: Flyway em modo *baseline-on-existing-schema* (`baseline-on-migrate: true`, `baselineVersion` = agora) — nunca tenta repetir o histórico do Prisma. **Durante a transição, o Prisma continua dono do DDL** (o Node continua a evoluir o schema mais depressa do que o Java o vai apanhando); o Flyway só recebe migrações novas para mudanças que já nasçam do lado Java, ou depois de um domínio estar cortado. A posse do DDL passa formalmente para o Flyway só no cutover final.

---

## 3. Ordem de migração (marcos revisáveis)

1. **M0 — Scaffolding**: esqueleto do projecto, CI, tratamento de erros (envelope idêntico ao `errorHandler.js`/`utils/errors.js`, incluindo `P2002→409`, `P2025→404`), geração das 49 entidades, inventário de enums confirmado contra a base viva, variáveis de ambiente centralizadas desde o início (correcção deliberada face ao Node, que hoje lê `process.env` directamente em vários sítios — sem efeito no contrato externo).
2. **M1 — Autenticação e RBAC**: login/sessão/JWT/cookie (prioridade cookie httpOnly sobre Bearer, exactamente como `auth.js`), TOTP (porta directa do RFC 6238 manuscrito em `totp.js`, não uma biblioteca terceira com outros parâmetros por omissão), política de senha, os 5 perfis + sub-áreas do `ADMIN_SISTEMA` (incluindo a particularidade de `adminAreas` vazio = Super Admin irrestrito). Base de que tudo o resto depende — vai primeiro.
3. **M2 — Empresa e Catálogo (leitura)**: perfil de empresa, catálogo de produtos/kits, paginação — estabelece as convenções de DTO/mapper usadas por todos os domínios seguintes.
4. **M3a–M3d — Fluxo comercial central**: Cotações → Ordem de Compra (máquina de estados explícita e testável) → Fatura/Nota de Crédito (matemática de imposto) → Pagamento/Taxa KIXIMA/planos (matemática de comissão). Cada sub-fase é o seu próprio PR — é o domínio mais testado e mais crítico para a receita.
5. **M4a–M4f — AGT**: cadeia de hash local (independente da AGT, primeiro) → `AgtPayloadService` (já corrigido, Passo 0) → `AgtSigningService` (JWS/RS256 — verificação **byte-a-byte** da assinatura contra o Node, usando a mesma chave de teste, já que RS256/PKCS1v15 é determinístico) → `AgtSandboxClient` (esquema pipe-delimited, mesma verificação byte-a-byte) → `AgtSeriesService`/`AgtSandboxSubmissionService` (padrão *fire-and-forget* preservado, incluindo o "recusa-se a fingir" sem credenciais) → `AgtCertificacaoService`.
6. **M5 — Suporte/operações/admin** (2 lotes): tickets/conversas/notificações/alertas de risco/auditoria; depois favoritos/avaliações/pesquisas guardadas/convites/ERP/documentos/chaves de API/stock/desenvolvimento de fornecedores/descontos/feedback.
7. **M6 — Jobs, tempo real, mensageria**: os 6 cron jobs portados 1:1 para `@Scheduled`, **desligados por omissão no lado Java até o domínio respectivo ser cortado** (para nunca disparar em duplicado enquanto os dois backends coexistem); Spring WebSocket/STOMP (decisão tomada — implica actualizar o cliente de tempo real no frontend só quando este domínio for cortado); RabbitMQ com o mesmo contrato opcional/não-bloqueante (publicação nunca dentro de uma fronteira `@Transactional` de negócio).
8. **M7 — Validação de paridade em profundidade**: diff de contrato em todos os endpoints, teste de carga contra uma cópia/réplica de staging.
9. **M8 — Cutover**: aprovado explicitamente pelo utilizador, por domínio já verificado; o Node fica disponível como caminho de recuo durante uma janela acordada antes de ser desactivado.

---

## 4. Verificação de paridade comportamental

Duas técnicas obrigatórias por domínio antes de ser considerado pronto para cutover:

1. **Testes portados como oráculo de paridade**: cada um dos 111 ficheiros de teste Node é transcrito para JUnit5 com os mesmos fixtures e as mesmas asserções literais (códigos de estado, códigos/mensagens de erro, valores decimais, transições de estado) — nunca reinterpretadas. `@SpringBootTest`+`MockMvc` ao nível do controller (espelha `supertest`).
2. **Replay de contrato ao vivo**: gravar pedidos reais contra o Node (staging/cópia da base), reproduzir os mesmos pedidos contra o Java apontado à mesma cópia, comparar estado + corpo JSON estruturalmente (só ignorando campos genuinamente não-determinísticos, como timestamps, explicitamente listados por endpoint).

Um domínio só é "pronto para cutover" com as duas técnicas a 100%.

---

## 5. Base de dados durante a sobreposição

Java liga-se a uma **réplica/cópia de staging** para desenvolvimento e para a maior parte da verificação de paridade; só usa a base de produção partilhada na janela final de verificação pré-cutover de cada domínio, sempre com um pool de ligações próprio e limitado (para nunca esfomear o pool do Node em produção).

---

## 6. Decisões já tomadas nesta ronda

- **NIF fixo AGT**: corrigido já, nos dois backends (Passo 0).
- **Tempo real**: Spring WebSocket/STOMP nativo — o frontend muda de cliente de tempo real no cutover desse domínio (M6), não antes.
- **`requireSameCompany`** (middleware definido mas nunca usado no Node, achado da auditoria anterior): portado como primitivo disponível, preservando o isolamento ad-hoc actual por serviço tal como está — adoptá-lo de forma consistente fica proposto como tarefa de reforço **depois** do cutover, não misturado com a migração.
- **Build tool**: Maven por omissão (convenção mais comum em Java empresarial) — mudável se preferir Gradle.

---

## Ficheiros críticos de referência (Node, para o port)

- `backend/prisma/schema.prisma` — fonte de verdade para as 49 entidades JPA.
- `backend/src/middleware/auth.js` — semântica exacta de JWT/cookie/revogação por `tokenVersion`/MFA.
- `backend/src/middleware/rbac.js` — semântica exacta de RBAC (incluindo a particularidade do `adminAreas` vazio).
- `backend/src/middleware/errorHandler.js` + `backend/src/utils/errors.js` — envelope de erro exacto a reproduzir.
- `backend/src/services/agtPayloadService.js`, `agtSigningService.js`, `agtSandboxClient.js`, `agtSeriesService.js` — domínio AGT, incluindo a correcção do Passo 0.
- `backend/src/jobs/*.js` (esp. `poRoboJob.js`) — padrão *fire-and-forget*/engolir falha no alerta, a preservar exactamente.

## Verificação

- Cada marco (M0–M8) só avança depois de: `mvn test` (ou `./gradlew test`) 100% verde no domínio, mais o replay de contrato descrito na secção 4 sem diffs não explicados.
- O Node continua a correr em produção e os seus próprios testes (`npm test`) continuam a correr sem alteração durante toda a migração — é o comportamento de referência.
