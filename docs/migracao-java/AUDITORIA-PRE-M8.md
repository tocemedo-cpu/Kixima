# Auditoria final de paridade antes do M8 — achados e resolução

Auditoria independente, read-only, feita depois do M7 sobre as 18 dimensões
pedidas (rotas, entidades, autenticação, RBAC, validações, JSON, PostgreSQL,
uploads, email, AGT, rate limiting, auditoria, paginação, decimais, erros,
configuração, testes, dependências). O `backend/` (Node) é a referência; o
`backend-java/` tem de o reproduzir. Este documento regista cada achado com a
classificação da auditoria e o que foi feito a seguir.

Legenda: **PC** paridade confirmada · **DR** diferença real · **DD** diferença
deliberada · **NV** não verificado · **RP** risco para produção.

## 1. Veredicto da auditoria (antes das correcções)

**Não pronto para o M8.** Dois riscos críticos no domínio de autenticação,
não documentados no M7 (reset de senha nunca enviava email; MFA por email
ausente), mais cabeçalhos de segurança HTTP em falta, SMTP/i18n de email por
portar, tecto de linhas só no catálogo e Sentry ausente. Tudo o resto
(246/246 rotas, RBAC por persona, AGT, dinheiro/decimais, rate limiting,
auditoria, paginação) com paridade forte e sem escalada de privilégio nem
fuga de dados entre empresas.

## 2. Riscos para produção — todos corrigidos

| # | Achado | Node | Java (antes) | Resolução |
|---|---|---|---|---|
| R1 | Reset de senha nunca enviava email | `authService.js` envia e devolve `sent:true` | só `log.info`, `sent:false` | `AuthService.forgotPassword` envia pelo `EmailDispatchService` com o mesmo assunto/texto/link; `PasswordResetControllerTest` |
| R2 | MFA por email ausente (activação, verificação, reenvio) | `mfaEmailService.js` | 503 "pendente M5" nos 4 pontos | `MfaEmailService` portado linha a linha (código de 6 dígitos, bcrypt 10, 10 min, 5 tentativas, reenvio 60 s, reaproveitamento); `MfaEmailControllerTest` (19) |
| R3 | Cabeçalhos de segurança (helmet/CSP) ausentes | `helmet()` + `config/csp.js` | nenhum cabeçalho | `ContentSecurityPolicy` + `SecurityConfig.cabecalhosDoHelmet` com os 12 cabeçalhos do helmet 7.2.0 e a mesma CSP; `CspTest` (byte a byte) |
| R4 | SMTP e i18n de email por portar | `nodemailer` + `i18n/emails.js` | só `console`/`brevo`, sempre PT | provider `smtp` (JavaMail, mesmas variáveis, 465=SSL/STARTTLS, `emFalta`); `EmailI18n` com os dicionários EN/FR e a mesma semântica de fallback, aplicado nos mesmos pontos; `EmailI18nTest` |
| R5 | Tecto de linhas (`DB_MAX_ROWS`) só no catálogo | interceptor global de `findMany` | só `CatalogService` | `TectoDeLinhasStatementInspector` (limit N nas leituras sem paginação, dentro de chamadas a repositórios) + `TectoDeLinhasAspect` (o mesmo erro no log ao atingir o tecto); `reference_counters` isento como `SEM_TECTO`; `TectoDeLinhasTest` |
| R6 | Sentry ausente | `config/sentry.js` | 3 `TODO` | `sentry-spring-boot-starter-jakarta`, `SentryReporter` a capturar exactamente onde o Node captura (AppException ≥500, fallback, falha do audit); desligado sem DSN e em teste |
| R7 | CORS: allow-list não portada (descoberto ao portar `cors.test.js`) | `config/cors.js` (APP_URL + Capacitor + CORS_ORIGINS; tudo em dev/teste) | `allowedOriginPatterns("*")` em produção | `CorsOrigins` (decisão por pedido) ligado a `SecurityConfig` e a `WebSocketConfig`, um só sítio como no Node; `CorsOriginsTest` |
| R8 | Guarda de arranque em produção (descoberto ao portar `env-*-producao.test.js`) | recusa arrancar com `JWT_SECRET` fraco/placeholder ou S3 mal configurado | só `JWT_SECRET` vazio; S3 apenas avisava | `ProducaoStartupGuard` (`@Profile("prod")`) com as mensagens do Node; `EnvJwtSecretProducaoTest`, `EnvStorageS3ProducaoTest` |

## 3. Diferenças reais — todas corrigidas

| # | Achado | Resolução |
|---|---|---|
| D1 | Aviso por email ao titular quando a conta é bloqueada só era registado no log | `LoginAttemptService` envia (uma vez por hora, erro engolido para o log); `LoginLockoutEmailTest` |
| D2 | Facturas consolidadas de call-offs não se pagavam (403 enganoso) e `poCount` fixo em 1 na taxa | `PaymentService.processPayment` trata a factura sem PO pelo contrato (posse, `paidAt` em todas as POs, sem notificação de PO como no Node); `poCount = consolidatedPoIds.size()`; repositórios com `LEFT JOIN` ao contrato; `ContractControllerTest.pagamentoDaFaturaConsolidadaDeVariasCallOffs` |
| D3 | `POST /api/support/tickets` sem assunto/mensagem dava 422 em vez de 400 `INVALID` | `InvalidRequestException` (400) nos três `res.status(400)` de `supportRoutes.js` |
| D4 | Perfil do convite validado só na regra de negócio (400) em vez de na entrada (422 com `fieldErrors`) | `ErrosDeCampos` reproduz o `flatten()` do zod; `InviteController` valida `role`/`name`/`email` como `createInviteSchema` |
| D5 | Candidatura ao Supplier Development sem os limites de comprimento/sinal do zod | `SupplierDevController` com todas as restrições de `supplierDevSchema` e os textos do zod |
| D6 | `@JsonInclude(NON_NULL)` omitia chaves que o Node devolve a `null` | Revistos os 20 DTOs, um a um, contra o `select`/objecto do Node: anotação por campo só onde o Node omite de facto (spreads condicionais, `chave` da API key); `Optional` onde o Node emite `null` sempre |
| D7 | Ordenação do marketplace com desempate extra por `id` no Java | Mantido e documentado como deliberado (o Node é não-determinístico nos empates; o desempate estável evita repetir/saltar itens entre páginas) — ver M7-PARIDADE.md |
| D8 | Comprovativo de subscrição/add-on sem tecto de 10MB | `UploadFilters.tamanho(..., LIMITE_DOCUMENTO)` DEPOIS do tipo (ordem do multer): 413 `LIMIT_FILE_SIZE` com a frase do `errorHandler.js`. O mesmo alinhamento no comprovativo de pagamento de PO, no anexo do suporte e no anexo do chat comercial, que davam 422 |
| D9 | `catalog-import`: 1 cenário em Java contra 11 no Node | Os 11 cenários portados em `CatalogWriteControllerTest` |
| D10 | Comentários "NÃO PORTADO" desactualizados | Varridos os 47 pacotes; 14 marcadores falsos corrigidos, zero restantes |
| D11 | `LOG_LEVEL` não parametrizável | `${LOG_LEVEL:INFO}` / `${LOG_LEVEL:DEBUG}` por perfil |
| D12 | SAF-T: período ilegível ou empresa em falta davam 500 no **Node** (o Java já dava 422, documentado como deliberado) | Corrigido no Node (`ValidationError`), teste em `faturacao-agt.test.js`; deixa de ser desvio |

## 4. Não verificado — estado

| Item | Estado |
|---|---|
| Testes JUnit dedicados para `login-lockout`, `password-reset`, `session-revocation`, `cors`, `env-*-producao` | Portados (ver secções 2 e 3) |
| Regras de serviço em `ApiKey`/`Conversation`/`RiskAlert`/`retention`/`backup`/`addon` | Continuam cobertas só pelos testes de controller existentes; sem achado |
| Fuga de *stack trace* em produção | Depende de `SPRING_PROFILES_ACTIVE` nunca incluir `dev`; verificar no deploy |
| `XLSX_MEMORIA_MB`/`XLSX_TIMEOUT_MS` | Sem equivalente em Java (o POI lê em memória com o tecto de 25MB do multipart); a confirmar se é preciso |
| Histórico de migrações Prisma vs `schema.prisma` | Fora de uma auditoria estática |
| `requireSameCompany` | Código morto nos dois lados; decisão de defesa em profundidade fica para depois do cutover, como no plano |

## 5. Diferenças deliberadas (inalteradas)

As já registadas no M7 (empates em `facets`/relatórios, código do erro AGT sem
chave, `searchText`, textos do Hibernate Validator) mais o desempate por `id`
na pesquisa do marketplace (D7).

## 6. O que continua por fazer antes do cutover

- Teste de carga contra a réplica de staging (precisa de acesso).
- S3 de ponta a ponta contra um bucket real.
- Confirmar na configuração de produção: `SPRING_PROFILES_ACTIVE`, provider de
  email e `SENTRY_DSN`.

## 7. Verificação

Ver o fim de `M7-PARIDADE.md` (secção 7) para os números das suites depois
destas correcções.
