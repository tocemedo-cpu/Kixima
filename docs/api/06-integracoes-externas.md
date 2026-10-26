# Integrações externas do backend Node (KIXIMA)

> Gerado por análise estática. Só nomes de variáveis de ambiente; nenhum valor foi lido.

Âmbito: `backend/` (Node/Express). Só leitura; nada foi executado nem chamado. Nenhum valor de `.env*` foi lido nem é reproduzido aqui — só nomes de variáveis e finalidade (fonte: `backend/.env.example`, `backend/src/config/env.js`, `render.yaml` e o código). Todas as referências são `caminho:linha` relativas a `/home/user/Kixima`. Diferenças em `backend-java/` só quando evidentes (secção 11).

Convenção de estado: **Completa** = código real, ligável com configuração; **Parcial** = existe e corre, mas com lacunas relevantes ou dependente de factos não confirmados; **Por ligar** = implementado contra uma especificação presumida, sem credenciais/contrato; **Ferramenta de teste** = não faz parte do fluxo real.

## Tabela-resumo

| Integração | Estado | Ficheiros | Variáveis | Notas |
|---|---|---|---|---|
| AGT — assinatura JWS RS256 | Parcial (código completo; inactiva sem chave e nº de validação reais) | `backend/src/services/agtSigningService.js`, `backend/src/config/env.js:11-150` | `AGT_JWS_PRIVATE_KEY_BASE64` (ou Secret File `/etc/secrets/chavePrivada.pem`, ou `src/chave/chavePrivada.pem`), `AGT_SOFTWARE_VALIDATION_NUMBER`, `AGT_SOFTWARE_ID`, `AGT_SOFTWARE_VERSION` | Recusa-se a assinar sem configuração (`agtSigningService.js:52-61`). Dois esquemas de assinatura coexistem (ver 1.3). |
| AGT — cliente REST (HML/PRD) | Parcial | `backend/src/services/agtSandboxClient.js`, `backend/src/config/agt.js` | `AGT_ENV` (`hml` por omissão/`prd`), `AGT_SANDBOX_USERNAME`, `AGT_SANDBOX_PASSWORD` + as da linha anterior | HTTP Basic, `fetch` sem timeout nem retry. Só 4 dos 6 endpoints têm uso real (`registarFactura`, `solicitarSerie`, `obterEstado`; `consultarFactura`/`listarFacturas` sem chamadores; `listarSeries` sem função). |
| AGT — séries (Solicitar Série / nº de documento) | Parcial | `backend/src/services/agtSeriesService.js`, rotas em `backend/src/routes/faturacaoRoutes.js:161-200` | `AGT_NIF`, `AGT_ESTABLISHMENT_NUMBER` | Pedido por GET com efeito externo; contador atómico por série AGT (`FOR UPDATE`). |
| AGT — submissão de documentos (FT/NC/RC) | Parcial | `backend/src/services/agtPayloadService.js`, `agtSandboxSubmissionService.js`, chamadores em `poService.js`, `contractService.js`, `paymentService.js`, `creditNoteService.js`, `conciliacaoService.js` | (as AGT acima) | Cada documento é enviado duas vezes com dois formatos diferentes (ver 1.4). Sem confirmação no repo de que a AGT aceitou algum documento. |
| AGT — gerador de casos de certificação | Ferramenta de teste | `backend/src/services/agtCertificacaoService.js`, `backend/scripts/agt-certificacao-c1-fr.js` | — | Nunca chamado por rotas. |
| Cadeia de integridade interna (hash por série) | Completa (mas não é a assinatura RSA da AGT) | `backend/src/services/faturacaoService.js` | — (série em `Company.serieFiscal`, não em env) | SHA-256 encadeado; `verificarCadeia` tem falhas (ver Achados). |
| Exportação SAF-T (AO) | Parcial — estrutura mínima, não conforme | `backend/src/services/saftService.js`, `backend/src/routes/faturacaoRoutes.js:82-111` | `KIXIMA_NIF`, `KIXIMA_CERTIFICADO_AGT` | XML escrito à mão, sem XSD, sem tabelas mestre de produtos/impostos, sem recibos. |
| Email (Brevo API / SMTP / console) | Completa (sem timeout/retry no Brevo) | `backend/src/services/notificationService.js`, `backend/src/i18n/emails.js`, `backend/src/config/env.js:289-298,426-435` | `EMAIL_PROVIDER` (`console` por omissão, `smtp`, `brevo`/`brevo-api`), `EMAIL_FROM`, `BREVO_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | `BREVO_API_KEY` não consta de `backend/.env.example`. Falhas de envio são engolidas, excepto no envio "directo" (2FA, alertas). |
| Supabase — Postgres | Completa | `backend/prisma/schema.prisma:9-17`, `backend/src/config/database.js` | `DATABASE_URL` (pooler de transacção, 6543), `DIRECT_URL` (pooler de sessão, 5432) | Prisma; `DIRECT_URL` serve migrações e `pg_dump`. |
| Supabase — Storage (S3-compatível) | Completa (risco: documentos privados no bucket público) | `backend/src/services/storageService.js`, `backend/src/config/upload.js`, `backend/src/config/env.js:303-327,450-460`, `backend/src/routes/uploadsRoutes.js` | `STORAGE_PROVIDER` (`local`/`s3`), `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_ENDPOINT`, `STORAGE_PUBLIC_URL`, `STORAGE_FORCE_PATH_STYLE`, `STORAGE_BACKUP_BUCKET` | Em produção o arranque falha se não for `s3` com credenciais. Sem SDK Supabase: só `@aws-sdk/client-s3`. |
| Cópias de segurança (`pg_dump` → bucket S3 privado) | Completa (opt-in) | `backend/src/jobs/backupJob.js`, `backend/src/services/backupVerificacaoService.js` | `BACKUP_CRON`, `BACKUP_MAX_IDADE_HORAS`, `STORAGE_BACKUP_BUCKET`, `DIRECT_URL` | Não consta de `.env.example`. |
| RabbitMQ / eventBus | Parcial (entrega "no máximo uma vez") | `backend/src/services/eventBus.js` | `RABBITMQ_URL`, `RABBITMQ_EXCHANGE` (`kixima.events`) | Opcional; sem URL, no-op com `logger.warn`. Não consta de `.env.example`. |
| kixima-integration-service (consumidor + adaptadores ERP) | Parcial (adaptadores contra formatos presumidos) | `kixima-integration-service/src/**` (fora do âmbito; só descrito) | `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_QUEUE`, `INTEGRATION_ADMIN_TOKEN`, `ENCRYPTION_KEY`, `WEBHOOK_SIGNING_SECRET`, `KIXIMA_CALLBACK_URL`, `KIXIMA_CALLBACK_SECRET`, `REDIS_*`, `RETRY_*` | Fila `kixima.integration.q` + DLX; BullMQ com 5 tentativas e backoff exponencial por omissão. |
| ERP — configuração por empresa + cifra AES-256-GCM | Completa | `backend/src/services/erpConfigService.js`, `erpCrypto.js`, rotas `backend/src/routes/companyRoutes.js:58-63` | `ERP_CONFIG_ENCRYPTION_KEY`, `INTEGRATION_URL`, `INTEGRATION_ADMIN_TOKEN` | Plano PRO; só Admin do Sistema (área cadastro). |
| ERP — callback de entrada | Completa | `backend/src/routes/integrationRoutes.js` (montado em `/api/integration`, `app.js:213`) | `KIXIMA_CALLBACK_SECRET` | HMAC-SHA256 sobre o corpo bruto; falha fechada. |
| Gateways de pagamento (Multicaixa/EMIS, PayPay, BAI, BFA, Standard Bank AO) | Por ligar — e Multicaixa é inutilizável como está | `backend/src/services/multicaixaService.js`, `paypayService.js`, `bancoGatewayService.js`, `canaisPagamentoService.js` | `EMIS_BASE_URL`, `EMIS_POS_ID`, `EMIS_TOKEN`, `EMIS_CALLBACK_URL`; `PAYPAY_BASE_URL/MERCHANT_ID/TOKEN/CALLBACK_URL`; `BAI_*`, `BFA_*`, `STANDARD_BANK_AO_*` (`BASE_URL`, `CLIENT_ID`, `CLIENT_SECRET`, `CALLBACK_URL`) | Recusam-se a simular sucesso. Só para subscrições BASE/CORE. |
| Webhook de pagamento de subscrição | Parcial | `backend/src/routes/webhookPagamentoRoutes.js` (montado em `/api/webhooks/pagamento`, `app.js:200`) | — | Sem segredo/assinatura própria; confia na reconsulta ao gateway. |
| IA — recomendação Category Management | Completa (opcional) | `backend/src/services/aiRecommendationService.js`, `backend/src/routes/categoryManagementRoutes.js:24-52` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (omissão `claude-sonnet-5`) | Fornecedor: Anthropic (SDK `@anthropic-ai/sdk`). |
| Sentry | Parcial | `backend/src/config/sentry.js`, `backend/src/middleware/errorHandler.js` | `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`; frontend: `VITE_SENTRY_DSN` (build) | Só `captureException` manual em 5xx. |
| Socket.IO | Completa (instância única) | `backend/src/services/realtimeService.js`, `backend/src/server.js:67` | `CORS_ORIGINS` (via `config/cors.js`) | Autenticação por cookie `kixima_sessao`; salas `user:`, `support:`, `conversation:`. |
| Outras (SMS, WhatsApp, Google, push, mapas, captcha, Stripe, etc.) | Não existem | — | — | Pesquisa por `fetch(`, `axios`, `https.request` e dependências: só Brevo, AGT, EMIS/PayPay/bancos, ERP-microserviço e Anthropic. "WhatsApp" aparece só como texto/ligação de contacto em `supportRoutes.js:88` e numa regex de risco em `riskAnalysisService.js:47`. |

Dependências externas reais em `backend/package.json:32-59`: `@anthropic-ai/sdk`, `@aws-sdk/client-s3`, `@sentry/node`, `amqplib`, `nodemailer`, `socket.io`, `node-cron`, `xlsx`, `adm-zip`.

---

## 1. AGT / facturação electrónica

### 1.1 Visão geral e verdade sobre o estado

O que está **realmente implementado e a correr no fluxo de negócio**:

1. Numeração interna certificada + cadeia de hash por fornecedor (`faturacaoService.atribuir`, usada na emissão de fatura, nota de crédito e recibo) — só activa quando a empresa tem `Company.serieFiscal` (`faturacaoService.js:24-26,146-196`).
2. Geração e assinatura JWS dos documentos no esquema "e-Fatura" (`agtPayloadService`) — só funciona com chave + nº de validação.
3. Chamadas HTTP reais à AGT (HML por omissão) para `registarFactura`, `solicitarSerie`, `obterEstado` — só com chave, nº de validação e credenciais Basic (`agtSandboxClient.js:60-79`).
4. Exportação SAF-T em XML, de uma só empresa fornecedora, por pedido manual.

O que **é só preparação**:

- O programa **não está certificado**: `AGT_SOFTWARE_VALIDATION_NUMBER` e `KIXIMA_CERTIFICADO_AGT` ficam vazios até a AGT os atribuir (`.env.example`; `env.js:349-352,371`; `saftService.js:190-193` usa `'0'` quando vazio).
- Os comentários do código afirmam respostas "CONFIRMADO em produção (HML)" (`agtSandboxClient.js:271-299`, `agtSeriesService.js:91-96`, erro "E99 … estabelecimento com o código 1" em `env.js:219-228`), o que indica que houve chamadas reais à homologação. **Não há no repositório nenhuma evidência (resposta guardada, log, teste de integração) de que a AGT tenha aceite algum documento.** Os testes (`backend/tests/agt-*.test.js`) são unitários/mocks. Estado de aceitação: não confirmado.
- A conformidade do SAF-T não foi validada contra nenhum XSD (não há XSD nem validador no repo).

Princípio transversal "recusa-se a fingir": sem configuração, as funções lançam em vez de simular (`agtSigningService.js:52-61`, `agtSandboxClient.js:70-79`); a submissão automática simplesmente não faz nada (`agtSandboxSubmissionService.js:38`).

### 1.2 `agtSigningService.js` — JWS RS256 e gestão da chave

- `assinarJWS(obj)` (`agtSigningService.js:76-82`): cabeçalho fixo `{"typ":"JOSE","alg":"RS256"}`, payload = `JSON.stringify(objecto)` (a ordem das chaves é a de inserção), assinatura `crypto.sign('RSA-SHA256', …, pem)` (PKCS#1 v1.5, correcto para RS256), tudo em base64url. Não usa `jsonwebtoken`.
- `construirSoftwareInfo()` (`:92-102`): `softwareInfoDetail = {productId, productVersion, softwareValidationNumber}` + `jwsSoftwareSignature` sobre esse objecto.
- `assinarDocumento()` (`:110-112`): assina exactamente 8 campos nesta ordem: `documentNo, taxRegistrationNumber, documentType, documentDate, customerTaxID, customerCountry, companyName, documentTotals` (citando a spec DS.120 §4.1.6 no comentário, `:6-19`).
- `exigirConfiguracao()/disponivel()/emFalta()/estado()` (`:52-61,119-129`): `estado()` alimenta o painel Prontidão (`prontidaoService.js:586-594`) e inclui `diagnosticoChavePrivadaAgt()` (só a fonte e o tamanho, nunca a chave).
- **Gestão da chave** (`config/env.js:11-150`): ordem de procura:
  1. `AGT_JWS_PRIVATE_KEY_BASE64` (PEM em base64); só aceite se decodificar para PEM com marcas `BEGIN/END` **e** `crypto.createPrivateKey` a aceitar (`candidatoValido`, `:74-76`). Se vier cortada pelo painel (problema real documentado, `.env.example`) é ignorada e a procura continua.
  2. Secret Files `/etc/secrets/chavePrivada.pem` e `/etc/secrets/AGT_JWS_PRIVATE_KEY_BASE64` (`:30-33`), aceitando PEM directo ou base64 (`interpretarConteudoFicheiro`, `:80-86`).
  3. Ficheiro local `backend/src/chave/chavePrivada.pem` (`:15`), coberto por `backend/.gitignore:15` (`src/chave/*`); no repositório só existe `.gitkeep`.
  - A chave é lida uma vez no arranque (`env.js:365`); trocar a chave exige reinício. Não há rotação, `kid`, nem exportação/registo da chave pública (não está no código onde nem como a chave pública é entregue à AGT — não confirmado). O tamanho/tipo da chave não é validado (qualquer chave privada decodificável serve; o `.env.example` sugere RSA 2048).
- Risco: a mesma chave assina tudo para todos os fornecedores (é a chave "do software", o que é coerente com `softwareInfo`), mas a validade perante a AGT depende de o nº de validação e da chave pública estarem registados — não confirmado.

### 1.3 `agtSandboxClient.js` — transporte e segundo esquema de assinatura

- Endpoints por ambiente em `config/agt.js:14-35` (`sifphml.minfin.gov.ao` e `sifp.minfin.gov.ao`, caminho `/sigt/fe/v1/<endpoint>`); `AGT_ENV` escolhe `hml`/`prd`. **Os URLs não são configuráveis por env.** Se `AGT_ENV` tiver um valor inválido, `getEndpoint` rebenta com `TypeError` (`config/agt.js:42-45`).
- Autenticação: HTTP Basic com `AGT_SANDBOX_USERNAME/PASSWORD` (`agtSandboxClient.js:183-189`) — assumida, "por confirmar" no próprio comentário (`:23-26`). São credenciais **únicas da KIXIMA** para todos os fornecedores.
- `pedido()` (`:217-242`): `fetch` **sem timeout/AbortSignal e sem retry**; tenta `resposta.json()` e, se falhar, `dados = null`; HTTP não-2xx → `AgtApiError`; **se `dados == null` considera sucesso** (`:237`).
- Predicados de sucesso: `registarFactura` = `requestID` presente e `errorList` sem entradas reais (`:280-286`); `solicitarSerie` = `seriesFEResult.seriesCode` presente (a AGT devolve `resultCode=1` mesmo quando aceita, `:293-307`); restantes = `resultCode === "0"` (`:237`).
- `obterEstado` é POST com envelope (um GET devolveu 405, `:314-324`); `consultarFactura` e `listarFacturas` são GET + query ("por confirmar", `:27-32,326-336`) e não têm nenhum chamador no código; **`listarSeries` está em `config/agt.js:23` e no `.env.example` mas não tem função no cliente.**
- Este cliente tem o seu **próprio** esquema de assinatura (`:141-179`): `jwsDocumentSignature` sobre a string `documentNo|taxRegistrationNumber|documentType|documentDate|customerTaxID|customerCountry|companyName|documentTotals` (com `documentTotals` como `JSON.stringify`, assunção 3 por confirmar, `:33-36`) e `jwsSignature = taxRegistrationNumber|submissionUUID`. Difere do esquema JSON de `agtSigningService` (1.2). Resultado: **dois formatos de assinatura de documento coexistem** para o mesmo endpoint.
- `AgtApiError` guarda `respostaBruta`, `errorList`, `resultCode` (`:109-118`); `utils/errors.js:81-89` converte-o em `AgtRecusadoError` (502 `AGT_RECUSOU`) com `details = {endpoint, resultCode, errorList, respostaBruta, pedido}`, que o `errorHandler` devolve ao cliente (`middleware/errorHandler.js:22`).

### 1.4 `agtPayloadService.js` e `agtSandboxSubmissionService.js` — o que é submetido e quando

`agtPayloadService` (envelope "schema v2.0", `:262-272`):

- `construirPayload(tipo, id, supplierCompanyId)` (`:279-325`): exige assinatura configurada (`:280`), carrega o documento, **verifica posse** (`verificarPosse`, `:250-254`) e devolve `{schemaVersion:'2.0', submissionUUID, taxRegistrationNumber (NIF do fornecedor), submissionTimeStamp, softwareInfo, numberOfEntries:1, documents:[doc]}`.
- FT (`:126-160`): linhas de `InvoiceLine`, IVA `taxCode` da linha (sempre `NOR`), `unitOfMeasure` fixo `'UN'` (`:133`), `documentStatus` sempre `'N'` (`:109`), `withholdingTaxList` (IRT) só se houver retenção. NC (`:166-212`): **uma única linha sintética** `CORRECAO` com `referenceInfo` à fatura original. RC (`:220-248`): sem linhas, `paymentReceipt.sourceDocuments` a apontar à FT. FR: apenas reconhecido no tipo, sem produtor (`:321-324`).
- `documentNo` = `"<tipo> <seriesCode>/<n>"` atribuído **uma só vez** por `agtSeriesService.atribuirDocumentNo` e gravado em `agtDocumentNo` (`:79-82`). Sem série AGT pedida, lança `BusinessRuleError` (`agtSeriesService.js:223-228`).
- `customerTaxID` desconhecido → `'999999999'` (`:62,103`); país → ISO só para Angola/Portugal, outros passam tal como estão (`:52-57`).
- `submeterDocumento` (`:388-403`): `registarFactura(payload)` + consulta imediata de `obterEstado` (nunca lança, `:357-366`). Em recusa: `AgtRecusadoError` com `estado` e `pedido` em `details`. `consultarEstadoFatura` (`:434-460`) usa `Invoice.agtRequestId`.

`agtSandboxSubmissionService.submeter(tipo, id, supplierCompanyId)` (`agtSandboxSubmissionService.js:37-92`): "submissão automática e silenciosa" — reutiliza `construirPayload` só para os campos comuns, **volta a assinar** com o esquema pipe-delimited do cliente (1.3) e envia um documento **plano** (sem `documents[]`, sem `schemaVersion`) a `registarFactura` (`:60-76`). Nunca lança; grava `AGT_SANDBOX_SUBMETIDO` ou `AGT_SANDBOX_FALHOU` em auditoria (`:78-90`). Retorna sem fazer nada se o cliente não está configurado (`:38`).

Pontos de chamada (todos **dentro do pedido HTTP**, com `await`):

| Momento | Chamada | Ficheiro:linha |
|---|---|---|
| Fatura gerada (PO) | `submeter('FT')` | `services/poService.js:604` |
| Fatura consolidada (contrato) | `submeter('FT')` | `services/contractService.js:238` |
| Pagamento processado (comprovativo) | `submeterFatura` (explícita, grava `agtRequestId/agtResultCode/agtErro/agtEstado` na fatura) e depois `submeter('RC')` | `services/paymentService.js:164-214` |
| Pagamento confirmado pelo ERP | `submeter('RC')` | `services/poService.js:511` |
| Conciliação bancária | `submeter('RC')` | `services/conciliacaoService.js:259` |
| Nota de crédito emitida | `submeter('NC')` | `services/creditNoteService.js:177-178` |
| Anular fatura | NC total + `submeterNotaCredito` explícita (grava resultado na NC) | `services/creditNoteService.js:219-243` |

Consequência: **cada FT/NC é enviada duas vezes** (uma por `submeter`, outra por `submeterFatura/submeterNotaCredito`) com o mesmo `documentNo` e dois formatos diferentes; o próprio código admite que a AGT "pode recusá-lo por documentNo repetido" (`paymentService.js:166-171`). Qual dos dois formatos é o correcto perante a AGT não está confirmado.

### 1.5 `agtSeriesService.js` — séries

- `construirPedidoSerie` (`:45-81`): assina `{taxRegistrationNumber, seriesYear, documentType, establishmentNumber, seriesContingencyIndicator}` — conjunto **não confirmado** pela spec (o comentário `:16-26` admite que a spec fala em `requestID`, que aqui não existe). Faz `logger.info` do pedido completo (inclui o JWS; não a chave).
- `solicitarSerie` (`:102-146`): envia a `solicitarSerie`; se aceite grava `AgtSeriesFe` (histórico + `ultimoNumero`, `schema.prisma:1298-1334`); se recusada → `AgtRecusadoError`.
- Rotas: `GET /api/faturacao/agt-serie-payload?ano=&tipoDocumento=` (**só ADMIN_SISTEMA, área faturação; submete mesmo à AGT por GET**; exige `AGT_NIF` e `AGT_ESTABLISHMENT_NUMBER`, `faturacaoRoutes.js:161-190`) e `GET /api/faturacao/agt-series-fe` (histórico, `:198-200`).
- `atribuirDocumentNo` (`:203-237`): transacção com `SELECT … FOR UPDATE` sobre a linha mais recente de `agtseriesfe` por `(tipo, ano, establishmentNumber)`, incrementa `ultimo_numero`, grava `agtDocumentNo`. **Não filtra por NIF nem verifica `authorizedQuantity/lastDocumentNo`**; não há unicidade em `AgtSeriesFe` além de um índice (`schema.prisma:1336`). Como o pedido de série é feito com `AGT_NIF` (conta KIXIMA) e as credenciais são únicas, todas as empresas fornecedoras partilham a mesma série AGT, enquanto `taxRegistrationNumber` do documento é o do fornecedor — compatibilidade com as regras da AGT não confirmada.

### 1.6 `agtCertificacaoService.js`

Gerador de documentos com dados **sintéticos** para os casos de certificação (FR, estrangeiros, Cabinda, IEC/IS): `arredondarPorExcesso` (`:44-48`, regra da spec para `taxContribution`), `totaisDeLinhas` (`:63-70`), `construirDocumento` (`:83-105`), `envelope` (`:107-117`). Só é usado por `scripts/agt-certificacao-c1-fr.js` (que gera um par RSA descartável se não houver chave). Não faz parte de nenhum fluxo real. Nota: a regra de arredondamento por excesso **não** é usada no cálculo real (`faturacaoService.js:60-67` diz explicitamente que está por ligar; `taxService` arredonda ao mais próximo), pelo que `taxContribution` dos documentos reais pode divergir da regra da AGT — por confirmar.

### 1.7 Numeração interna e cadeia de integridade (`faturacaoService.js`)

- Série por fornecedor: `Company.serieFiscal` (+ sufixos `-NC` e `-RC`, `:33-43`); sem série → documentos sem número, hash nem `assinadaEm` (`:146-148`).
- `atribuir(tx, …)` (`:146-196`): cria a série `(codigo, ano)` se não existir, `SELECT … FOR UPDATE`, recusa série fechada, incrementa, calcula `hashDocumento = SHA-256(base64)` de `data;carimbo;serie/numero;montante;hashAnterior` (`:105-114`) e grava `ultimo_hash`. Recusa datas anteriores a `dataAdesaoFacturacaoElectronica` (`:150-155`).
- `verificarCadeia(codigo, ano)` (`:206-266`): só faturas; **o parâmetro `ano` não entra na consulta** (`:209-217`), e a numeração esperada é `i+1`, por isso uma série que reinicie por ano gera falsos "buracos"/"elo partido".
- O hash é SHA-256, **não** uma assinatura RSA do documento. Se a AGT exigir (como no modelo PT em que se inspira) hash RSA com chave privada, isto não cumpre — não confirmado para Angola.

### 1.8 Export SAF-T (`routes/faturacaoRoutes.js:82-111` + `services/saftService.js`)

Rotas (autenticadas; `FORNECEDOR`, `COMPANY_ADMIN`, `ADMIN_SISTEMA` + `requirePermission(FATURACAO)`; o fornecedor só obtém a sua empresa, o admin tem de indicar `supplierCompanyId`, `resolverEmpresaFornecedora`, `:66-74`):

- `GET /api/faturacao/saft?de=AAAA-MM-DD&ate=AAAA-MM-DD` → ficheiro `application/xml` com cabeçalhos `X-Kixima-Documentos` e `X-Kixima-Sem-Serie`.
- `GET /api/faturacao/saft/resumo` → JSON `resumo` (inclui `porConfigurar`).
- Também: `GET /integridade` (`verificarCadeia`), `GET /agt-payload/:tipo/:id`, `GET /agt-estado/:invoiceId`, `GET /metricas`.

Estrutura do XML (`saftService.js:164-334`), construído por concatenação de strings com escape de `& < > " '` (`:28-35`):

```
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01">
  <Header> AuditFileVersion(1.01_01), CompanyID, TaxRegistrationNumber, TaxAccountingBasis(F), CompanyName,
           FiscalYear, StartDate, EndDate, CurrencyCode(AOA), DateCreated, TaxEntity(Global),
           ProductCompanyTaxID(KIXIMA_NIF), SoftwareCertificateNumber(KIXIMA_CERTIFICADO_AGT | '0'),
           ProductID(KIXIMA), ProductVersion </Header>
  <MasterFiles> <Customer> CustomerID, AccountID('Desconhecido'), CustomerTaxID, CompanyName, BillingAddress </Customer>* </MasterFiles>
  <SourceDocuments><SalesInvoices>
     NumberOfEntries, TotalDebit(0), TotalCredit(soma líquido das faturas)
     <Invoice> FT: InvoiceNo, DocumentStatus, Hash, HashControl(1), InvoiceDate, InvoiceType(FT), SpecialRegimes,
               SourceID, SystemEntryDate, CustomerID, Line*, DocumentTotals </Invoice>*
     <Invoice> NC: idem + References{Reference, Reason}, sem Line </Invoice>*
  </SalesInvoices></SourceDocuments>
</AuditFile>
```

Validações existentes: período `AAAA-MM-DD` válido e `fim ≥ ini` (`validarPeriodo`, `:55-64`, 422), empresa fornecedora existente (`:77-81`). Faturas filtradas por `issuedAt` e posse (`:97-110`); notas de crédito por data de emissão da própria nota (`:117-129`); fatura "anulada" (`InvoiceStatus=A`) se totalmente creditada (`:143-146`).

**O que falta para estar conforme** (tudo por leitura do código; o repo não contém o XSD angolano, por isso o que é "obrigatório" está **não confirmado** — comparado com o modelo SAF-T PT que o próprio ficheiro invoca como base, `:218-221`):

1. Sem validação contra XSD, nem teste que o faça (`backend/tests/faturacao-agt.test.js:390-436` só testa rejeição de período).
2. Namespace e versão (`AO_1.01_01`) escritos à mão (`:166,170`) — não confirmados.
3. Sem `MasterFiles/Product`, `Supplier`, `TaxTable` (tabela de impostos) — as linhas referem `ProductCode`/`TaxCode` sem tabela mestre.
4. Sem `Payments` (recibos RC) em `SourceDocuments`, embora o sistema emita RC e os submeta à AGT (`agtPayloadService.js:220-248`).
5. `TotalDebit/TotalCredit` ignoram notas de crédito (marcado `NEEDS_AGT_CONFIRMATION`, `:222-227`); `HashControl` fixo `'1'` (`:251,306`).
6. Hash = SHA-256 interno (1.7), não assinatura RSA.
7. Campos fiscais incompletos por linha: `Tax` só tem `TaxCode` e `TaxAmount` (sem `TaxType`, `TaxPercentage`, país, isenção) (`:272-275`); retenção na fonte (IRT) das faturas não é exportada; `Customer` sem `CustomerTaxID` quando a empresa não tem NIF (o `el()` omite vazios, `:37-39,204`) — enquanto o payload AGT usa `999999999` (`agtPayloadService.js:62`).
8. Marcadores "POR-CONFIGURAR" em `CompanyID`/`TaxRegistrationNumber`/`ProductCompanyTaxID` e `SoftwareCertificateNumber='0'` (`:174-175,189,193`) produzem um ficheiro com ar completo e inválido; o descarregamento prossegue na mesma — o aviso só está em `resumo.porConfigurar` e nos cabeçalhos HTTP (`:349-354`).
9. Documentos sem série usam a referência interna como `InvoiceNo` e `Hash` vazio (`:231-237,250`).
10. Três identidades de número por documento: `reference` interna, `serie.ano/0000001` (`numeroDocumentoAGT`, `faturacaoService.js:55-58`, usada no SAF-T) e `agtDocumentNo` ("FT SERIE/n", usada nos payloads AGT). O SAF-T **não** inclui `agtDocumentNo`, logo o ficheiro e o que foi registado na AGT não coincidem em numeração.
11. Datas: `fim.setHours(23,59,59,999)` em hora local e `data(fim)` via `toISOString` (`:62,180`) — pode deslocar o último dia consoante o fuso do servidor.
12. `take: 100000` silencioso em faturas e notas (`:109,128`); XML todo em memória (sem streaming).
13. Sem submissão: o SAF-T é só um descarregamento; não há envio à AGT.

---

## 2. Brevo e email

**Serviço:** `backend/src/services/notificationService.js`. Provider por `EMAIL_PROVIDER` (`env.js:292`):

| Valor | Comportamento | Ficheiro:linha |
|---|---|---|
| `console` (omissão) | Não envia; `logger.info('Email (modo console)', {to, subject, body})` — **o corpo completo vai para o log** | `notificationService.js:50-53` |
| `brevo` / `brevo-api` | `POST https://api.brevo.com/v3/smtp/email` com `api-key: BREVO_API_KEY`; remetente de `EMAIL_FROM` (aceita `Nome <email>`); `textContent` + `htmlContent` opcional | `:25-46,56-64` |
| `smtp` | `nodemailer` com timeouts 10 s/10 s/15 s, `secure` só na 465, STARTTLS nas outras; um transporte novo por mensagem | `:67-89` |
| outro | `logger.warn` "EMAIL_PROVIDER desconhecido" e não envia | `:91` |

Validação de configuração: `config.email.missing` (variáveis em falta por provider, `env.js:426-431`) e `apenasLog` (`:435`); `server.js:34-47` regista erro no arranque se for `console` ou estiver incompleto — **não impede o arranque**, mesmo em produção. O painel Prontidão repete o aviso e lembra que `EMAIL_FROM` tem de estar verificado no Brevo (`prontidaoService.js:369-390`).

Tratamento de erros: `dispatchEmail` apanha e **engole** erros de Brevo/SMTP (`:57-63,68-88`); a chamada Brevo (`fetch`, `:27`) **não tem timeout nem retry**. `enviarEmailDireto` (`:111-138`) **não** engole (422 se `console`/em falta): usado para 2FA por email (`mfaEmailService.js:134`), lembrete de 2FA (`mfaLembreteService.js:135`), aviso de bloqueio de conta (`loginAttemptService.js:124`, aqui o erro é depois apanhado), alertas operacionais aos admins (`alertaOperacionalService.js:101`) e email de teste (`adminRoutes.js:229`).

**Templates:** não há motor de templates nem ficheiros de template. As mensagens são strings em português; só convite e recuperação de senha têm HTML inline com botão (`authService.js:385-406`, `companyService.js:400-417`, `adminService.js:110`). A tradução para `en`/`fr` é feita por dicionário chave=texto PT (`i18n/emails.js:13,55,97-120`), aplicada em `notifyUser` (`notificationService.js:164-166`) e nos emails de 2FA; sem tradução cai para PT. `notifyCompanyContact` envia sem i18n e sem HTML (`:200-209`).

**Eventos que disparam email** (`notificationService.events`, canal `IN_APP_EMAIL` ⇒ email ao utilizador, `notifyUser` `:163-167`):

| Evento | Destinatários | Disparado em |
|---|---|---|
| `poRecebidaPeloFornecedor` | FORNECEDOR, COMPANY_ADMIN do fornecedor | `poService.js:170,300,410` |
| `poRecusadaPeloFornecedor` | COMPRADOR, COMPANY_ADMIN | `poService.js:621` |
| `faturaGerada` | FINANCEIRO do comprador | `poService.js:596` |
| `pagamentoProcessado` | FORNECEDOR, COMPANY_ADMIN | `paymentService.js:151`, `poService.js:509` |
| `poEntregue` | COMPRADOR, COMPANY_ADMIN | `poService.js:664` |
| `poRecebidaConforme` | FORNECEDOR, COMPANY_ADMIN | `poService.js:705` |
| `rececaoComDivergencia`, `supplierDevRecebida` | ADMIN_SISTEMA | `poService.js:696`, `supplierDevService.js:58` |
| `divergenciaResolvida` | FORNECEDOR/COMPANY_ADMIN (email) + ADMIN_SISTEMA (só in-app) | `poService.js:743` |
| `apoliceSubmetidaOuAprovada`, `apoliceAExpirar` | COMPANY_ADMIN, FINANCEIRO | `policyService.js:23,33,58,90` |
| `subscricaoAExpirar` (D30…D0, graça) | COMPANY_ADMIN, FINANCEIRO | `assinaturaService.js:765` |
| `cadastroEmpresaDecidido` (canal `EMAIL`) | `Company.contactEmail` | `companyService.js:208` |
| `NOTA_CREDITO_EMITIDA` (chamada directa a `notifyUsersByRole`, não está em `events`) | FINANCEIRO, COMPANY_ADMIN do comprador | `creditNoteService.js:157-163` |

Só in-app (sem email): `poAguardaAprovacao`, `poAprovadaOuRejeitada`, `entregaDespachada`, `estoqueBaixo` (`notificationService.js:214-235,285-295,433-443`).

Outros emails (via `sendEmail`, erros engolidos): recuperação de senha (`authService.js:406`; anti-enumeração: não envia se a conta não existe, `:396-401`), convite de empresa/utilizador (`companyService.js:417,455`, `adminService.js:110`). Via envio directo: código 2FA (6 dígitos, 10 min, `mfaEmailService.js`), lembrete de 2FA, bloqueio de conta, alertas operacionais, email de teste.

Risco de latência: `notifyUsersByRole` faz `await Promise.all` de envios; como os serviços de PO esperam pelas notificações, um Brevo lento (sem timeout) atrasa a operação de negócio.

---

## 3. Supabase

### 3.1 Postgres

- Prisma (`schema.prisma:9-17`): `url = DATABASE_URL` (app → **pooler de transacção**, porta 6543, `pgbouncer=true`), `directUrl = DIRECT_URL` (migrações → **pooler de sessão**, 5432, mesmo host de pooler, IPv4). O `.env.example` proíbe o host directo `db.<ref>.supabase.co` (só IPv6). Em dev/teste `DIRECT_URL` pode ser igual a `DATABASE_URL`.
- `config/database.js`: cliente Prisma único com extensão que impõe tecto de `DB_MAX_ROWS` (omissão 1000) a `findMany` sem `take` e regista `logger.error` quando é atingido (`:29-69`) — as leituras do SAF-T usam `take` explícito (100000).
- Transacções interactivas com `SELECT … FOR UPDATE` (séries) dependem de o pooler manter a ligação durante a transacção (funciona no pooler de transacção; não há nada no repo que o confirme em produção).
- Arranque: `Dockerfile` (raiz) corre `scripts/migrate-boot.js` (`migrate deploy` reconciliável, `Dockerfile:77`); `backend/Dockerfile:31` usa `prisma db push` — dois caminhos diferentes de schema.
- `DIRECT_URL` (ou `DATABASE_URL`) é usada pelo `pg_dump` (`backupJob.js:35-37`).

### 3.2 Storage S3-compatível

- `storageService.js`: provider efectivo `s3` só se `STORAGE_PROVIDER=s3` e sem variáveis em falta (`providerAtivo`, `:44-61`); caso contrário **disco local** (`/app/uploads`, efémero) — por isso `env.js:450-460` **faz falhar o arranque em produção** se não houver `s3` completo.
- Cliente `S3Client` (`@aws-sdk/client-s3`) memorizado por assinatura da configuração (`:66-87`); `forcePathStyle` por omissão `true` quando há `STORAGE_ENDPOINT` (`env.js:323-326`); `PutObject` com `CacheControl: public, max-age=31536000, immutable` (`:126-138`). URL público: `STORAGE_PUBLIC_URL/key`, senão `endpoint/bucket/key`, senão host AWS (`:89-97`).
- Erros: `explicar()` traduz falhas do SDK (`:102-110`); falha de upload → erro 502 com mensagem acionável; **sem retry** além do do SDK; **sem fallback silencioso** para disco em `saveS3` (`:112-124`), mas se a configuração está incompleta usa o disco desde o início (`:154-162`).
- Antes de guardar, `fileSignature.verificar` confere os bytes iniciais contra o tipo declarado (`:152`).
- Limites de upload (`config/upload.js`, Multer em memória): imagens PNG/JPG/WEBP/GIF até **12 MB** (SVG recusado, `:97-103`); documentos PDF/imagem até **10 MB** (`:115-119`); média de produto (`mainImage`, `gallery` + documentos) até **15 MB** por ficheiro (`:136-140`); folhas `.xlsx` até **25 MB** (`:150-154`).
- Pastas/chaves: `products/`, `documents/` (KYC e apólices, `companyService.js:80-98`, chave com NIF), `proofs/` (comprovativos de pagamento e de subscrição, `paymentService.js:70`, `assinaturaService.js:379`), `backups/` (bucket **separado** `STORAGE_BACKUP_BUCKET`, recusa correr se igual ao das imagens, `backupJob.js:108-123`).
- `/api/uploads/:filename` (`uploadsRoutes.js`) só serve o modo **local**, com controlo de posse por `uploadAccessService` (negação por omissão). **Em modo S3 o URL guardado aponta directamente para o bucket** (`uploadsRoutes.js:3-6`): o controlo de acesso não se aplica.
- `scripts/storage-check.js` (`npm run storage:check`) testa a configuração.
- Backups: `backupJob.js` corre `pg_dump --no-owner --no-privileges --clean --if-exists <url>` (`:56-60`), gzip em memória (`:61`), grava no bucket privado com a chave (`:64-73`) e audita `COPIA_SEGURANCA_CONCLUIDA/FALHOU`; agendamento por `BACKUP_CRON` mais verificação de atraso a cada 30 min (`:144-192`) porque o plano gratuito adormece. Requer o cliente `postgresql17-client` na imagem (`Dockerfile:25-36`); o `backend/Dockerfile` **não** o instala.

---

## 4. RabbitMQ / eventBus e kixima-integration-service

**Lado KIXIMA (`backend/src/services/eventBus.js`):**

- Biblioteca `amqplib`; opcional (`require` em try/catch, `:13-18`). `RABBITMQ_URL` (vazio ⇒ desligado) e `RABBITMQ_EXCHANGE` (`kixima.events`, `:20-21`). `server.js:64` chama `eventBus.init()` (só regista o estado).
- Liga-se à primeira publicação, cria `ConfirmChannel` e `assertExchange(topic, durable)` (`:25-43`); em erro de ligação, `channelPromise = null` e tenta de novo na publicação seguinte (`:36-40`) — **sem backoff nem fila local**.
- `publish(routingKey, payload, {eventId, tenantId})` (`:52-80`): envelope `{eventId, tenantId, source:'kixima', occurredAt, payload}`, mensagem persistente com `messageId = eventId`; **nunca lança**, devolve `false` em falha. `ch.publish` é chamado sem aguardar a confirmação do broker nem usar `mandatory`.
- Eventos publicados (routing keys e chamadores):

| Routing key | Disparo | Linha |
|---|---|---|
| `purchase_order.approval_requested` (PO `erpManaged`) | criação de PO | `poService.js:176-180` (+ `ErpSyncLog` OUTBOUND SUCCESS/FAILED `:181-189`) |
| `purchase_order.approved` | aprovação | `poService.js:303` |
| `invoice.issued` | fatura gerada | `poService.js:599` |
| `goods.received` | receção | `poService.js:690` |
| `payment.completed` | pagamento processado | `paymentService.js:155` |

`eventId` é determinístico (`po-approved:<id>`, `invoice-issued:<id>`, …) para idempotência no consumidor.

**Lado `kixima-integration-service` (NestJS, fora do âmbito; só o necessário):** consumidor `RabbitmqConsumer` declara a fila durável `kixima.integration.q` com DLX `kixima.integration.dlx`, liga-a às 5 routing keys e faz `ack` após `SyncService.ingest` (idempotência + fila BullMQ/Redis `erp-sync`, 5 tentativas e backoff exponencial por omissão, `constants.ts:6-23`, `rabbitmq.consumer.ts:38-89`, `configuration.ts:55-59`). Os adaptadores (Primavera REST, SAP S/4HANA OData, Oracle Cloud, SAP Ariba cXML) chamam por HTTP os ERPs de cada tenant (`adapters/*.ts`); os caminhos/campos (p. ex. `/{company}/purchaseOrders` no Primavera) são do código do microserviço e **não foram confirmados contra documentação dos ERPs**. Webhooks de entrada de ERPs: `POST /webhooks/erp/:tenantId/:erp` com HMAC `x-signature` por tenant+ERP, verificação cruzada tenant↔PO e idempotência, reencaminhados ao KIXIMA (`webhook.controller.ts:58-119`, `webhook.producer.ts`).

**Ligação de volta (ERP → KIXIMA):** ver 5.3.

---

## 5. ERP

### 5.1 Configuração por empresa (`erpConfigService.js`, rotas em `routes/companyRoutes.js:58-63`)

- ERPs suportados e campos: `MANUAL`, `PRIMAVERA`, `SAP_S4HANA`, `ORACLE_ERP_CLOUD`, `SAP_ARIBA` (`:13-36`), com campos secretos marcados.
- Só **ADMIN_SISTEMA** com área `cadastro`; exige plano com `erpIntegration` (PRO) e empresa `APROVADA` (`:111-121`). Credenciais gravadas cifradas em `CompanyErpConfig.configEnc`, auditoria em `CompanyErpConfigAudit` (`:69-85,169-174`); `getConfig` devolve segredos mascarados (`••••••`, `:59-67`).
- Sincronização com o microserviço (`callIntegration`, `:42-57`): `PUT/DELETE /credentials/tenants/<companyId>/<ERP>` e `POST …/test` com `Authorization: Bearer INTEGRATION_ADMIN_TOKEN`, base `INTEGRATION_URL`. **Sem timeout**; se não configurado, devolve `skipped` e o pedido continua ("guardado (microserviço não configurado)", `:45,173`). As credenciais em claro (já decifradas/mescladas) viajam no corpo do `PUT`.
- Quando `Company` tem ERP real, as POs nascem `erpManaged` e a aprovação passa para o workflow do ERP (`poService.js:91-99,171-189`).

### 5.2 `erpCrypto.js` (AES-256-GCM)

Formato `base64(iv[12] | authTag[16] | ciphertext)`; chave `ERP_CONFIG_ENCRYPTION_KEY` = 64 hex (32 bytes), exigida só ao cifrar/decifrar (`erpCrypto.js:12-21,23-37`). IV aleatório por mensagem, tag verificada na decifra (GCM autenticado). Sem versão de chave nem rotação; o microserviço usa a sua própria `ENCRYPTION_KEY` (cifra independente). Falha de decifra no backend é silenciada (`catch { config = {} }`, `erpConfigService.js:97,147`).

### 5.3 Callback de entrada e eventos

- `POST /api/integration/callback` (público; `integrationRoutes.js:26-76`): falha fechada com 503 se `KIXIMA_CALLBACK_SECRET` não existir; HMAC-SHA256 hexadecimal do **corpo bruto** (`req.rawBody`) comparado com `X-Kixima-Signature` em tempo constante; sem timestamp/nonce. Tipos: `purchase_order.approval_decided` → `poService.aplicarDecisaoErp` (idempotente por estado, `poService.js:359-410`); `payment.confirmed` → `poService.aplicarPagamentoErp` (`:420-…`, cria `Payment` canal `ERP` + RC certificado + taxa da plataforma). Erros de **negócio** respondem 200 `{received:true, error}` e ficam em `ErpSyncLog` FAILED (`:67-75`).
- "Webhooks de saída" do backend para ERPs **não existem** como HTTP: a saída é só o evento RabbitMQ (secção 4); os webhooks para ERP são feitos pelo microserviço.

---

## 6. Gateways de pagamento e webhook

Âmbito real: **só cobranças de subscrição** (`PlanoCobranca`) dos planos BASE/CORE (`assinaturaService.js:536-539`). O pagamento de faturas de fornecedor continua a ser por comprovativo carregado (`paymentService.js:70`), conciliação de extracto bancário (`canal: 'REFERENCIA_BANCARIA'`, `conciliacaoService.js:223`) ou confirmação do ERP (`canal: 'ERP'`).

- `canaisPagamentoService.js`: mapeia `EMIS_MULTICAIXA`, `PAYPAY`, `BAI`, `BFA`, `STANDARD_BANK_ANGOLA` ao adaptador (`:11-19`) e expõe `estados()` ao painel Prontidão e a `GET /api/assinatura/canais` (`assinaturaRoutes.js:52-54`).
- **Multicaixa/EMIS** (`multicaixaService.js`): `pedirPagamento` faz `POST {EMIS_BASE_URL}/online-payment` com montante em cêntimos inteiros, `Bearer EMIS_TOKEN`, `posID`, `callbackUrl` (`:63-93`) e **só aceita AOA** (`:66-71`); `confirmarCallback` volta a consultar `GET /transactions/<id>` e considera pago `status === 'ACCEPTED'` (`:103-125`). Cabeçalho do ficheiro: "implementado contra a especificação, por ligar" (sem contrato nem credenciais).
- **PayPay** (`paypayService.js`): `POST /payments` e `GET /payments/<id>`, pago se `PAID`/`COMPLETED` (`:54-100`). O ficheiro assume ser "um palpite razoável" sem documentação real (`:1-14`).
- **Bancos** (`bancoGatewayService.js`): **um único adaptador genérico** parametrizado por prefixo de env para BAI/BFA/Standard Bank AO, `POST {BASE_URL}/payments`, `Bearer <CLIENT_SECRET>` (usa o segredo directamente como bearer), pago se `PAID`/`COMPLETED` (`:36-115`). Também declarado palpite sem documentação.
- Modo: **não há mock/sandbox**: sem as 4 variáveis do bloco o adaptador lança (`exigirConfiguracao`) — decisão deliberada do projecto. Sem timeout nem retry em nenhum `fetch`.
- Fluxo: `POST /api/assinatura/:id/pagar-com` (COMPANY_ADMIN, `assinaturaRoutes.js:56`) → `assinaturaService.iniciarPagamentoGateway` (`:548-600`): valida posse/estado/plano, chama `adaptador.pedirPagamento({referencia, valor: valorUsd, moeda: 'USD', telemovel})`, exige um `id`/`transactionId` na resposta e grava `canal` e `referenciaExterna`. Confirmação: gateway → `POST /api/webhooks/pagamento/:canal` (**público**, sem `authenticate`, `webhookPagamentoRoutes.js:15-37`) → `adaptador.confirmarCallback(req.body)` (reconsulta ao gateway) → se `pago`, procura `PlanoCobranca` por `(canal, referenciaExterna)` e chama `confirmarViaGateway`, idempotente (CONFIRMADA devolve; CANCELADA 409; `canal`/`referenciaExterna` têm de coincidir, `:602-632`), activa o plano e notifica. Não pago ⇒ 200 `{recebido:true}`.
- Estado: **por ligar** (Multicaixa: implementação plausível mas **incompatível** com as cobranças em USD; PayPay e bancos: palpites).

---

## 7. `aiRecommendationService` — IA

- Fornecedor: **Anthropic** (API Claude), SDK `@anthropic-ai/sdk` (`aiRecommendationService.js:12`). Modelo `ANTHROPIC_MODEL` (omissão `claude-sonnet-5`, `env.js:407-410`); `max_tokens: 400`; `output_config: {effort:'low'}` (`:69-79`). Cliente criado só se houver `ANTHROPIC_API_KEY` (`:17-21`).
- O que envia (`construirPrompt`, `:27-55`): **nome da empresa**, volume total em USD, desconto actual, próximo patamar e poupança potencial, até 8 categorias (nome, valor, %) e até 5 oportunidades de consolidação (categoria, nº de POs, valor em falta). Não consulta a BD e não envia documentos, NIF, utilizadores nem linhas de PO.
- Quem o aciona: `GET /api/category-management/analise` (COMPANY_ADMIN/COMPRADOR/FINANCEIRO, plano com `categoryManagement`; `?recomendacao=0` desliga) em `categoryManagementRoutes.js:24-52`; **uma chamada por abertura do ecrã, sem cache**.
- Erros: nunca lança; sem chave devolve `{texto:null, motivo}`; falha → `logger.warn` e `{texto:null, motivo}` (`:62-86`). O SDK tem por omissão timeout de 10 min e 2 retries (`node_modules/@anthropic-ai/sdk/client.js:104,113,904`) e o código não os altera.
- Estado: completa e opcional; não há mock (sem chave ⇒ sem texto).

---

## 8. Sentry / observabilidade

- Backend: `config/sentry.js` inicializa `@sentry/node` só se `SENTRY_DSN` e não for teste (`:11-19`), com `environment` e `tracesSampleRate` (`SENTRY_TRACES_SAMPLE_RATE`, 0 por omissão). `captureException(err, req)` com `extra {method, path, userId}` (`:24-31`), chamado pelo `errorHandler` em erros 5xx (`errorHandler.js:14,54`). Sem `setupExpressErrorHandler`, sem `beforeSend`/scrubbing, sem breadcrumbs personalizados. `npm run sentry:test` existe (`scripts/sentry-test.js`).
- Frontend: `VITE_SENTRY_DSN` embutido no build (`Dockerfile:11-14`; `frontend/src/sentry.jsx`); `SENTRY_FRONTEND_DSN` só é lida em `config/csp.js:74-78` para autorizar a origem do Sentry na CSP (não configura o SDK do frontend).
- Logs: `config/logger.js` escreve JSON em consola (`LOG_LEVEL`); `morgan` nos pedidos. Não há métricas nem tracing no backend Node (o microserviço tem OpenTelemetry opcional, `configuration.ts:68-72`).
- Prontidão (`services/prontidaoService.js`) e `alertaOperacionalService.js` funcionam como observabilidade operacional (email aos admins com arrefecimento de 1 h).

---

## 9. Socket.IO (`realtimeService.js`)

- Anexado ao servidor HTTP em `server.js:67`; CORS partilhado com o Express (`config/cors.js`: `APP_URL`, origens Capacitor, `CORS_ORIGINS`; em dev/teste tudo permitido).
- Autenticação do handshake: cookie `kixima_sessao` ou `auth.token`, `jwt.verify` HS256, vai à BD buscar o utilizador, confere `active` e `tokenVersion` (`:53-93`). Não aplica a política de sessão restrita por 2FA (`mfaRestrita`) — o socket só serve notificações e chats; não confirmado se isso é intencional.
- Salas: `user:<id>` (automática), `support:<ticketId>` e `conversation:<id>` (pedido de entrada, revalidado por autorizadores injectados pelos serviços de chat, `:95-132`). Emissões: `notification:new` em `notifyUser` (`notificationService.js:173`), mensagens de chat.
- Sem adaptador de cluster (estado em memória) ⇒ uma só instância; sem limitação de eventos por socket.

---

## 10. Outras integrações

- **Nenhuma** de SMS, WhatsApp (API), Google, push/FCM, mapas, captcha, Stripe ou Redis no backend Node (pesquisa de `fetch(`, `axios`, `https.request` e de `package.json`). `xlsx`/`adm-zip` processam ficheiros localmente (`xlsxSeguro.js`, `workers/lerXlsx.js`, com `XLSX_MEMORIA_MB`/`XLSX_TIMEOUT_MS`).
- **API pública de catálogo (entrada, plano Pro)** `/api/v1/catalogo` com chave de API própria e limite de 120 pedidos/min por chave (`apiCatalogoRoutes.js`; `apiKeyService.js`) — integração para terceiros consumirem, não uma integração de saída.
- `redis` só existe no microserviço (BullMQ).
- Variáveis lidas pelo código mas **ausentes do `backend/.env.example`** (comparação por grep): `BREVO_API_KEY`, `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `KIXIMA_CALLBACK_SECRET`, `ERP_CONFIG_ENCRYPTION_KEY`, `INTEGRATION_URL`, `INTEGRATION_ADMIN_TOKEN`, `STORAGE_BACKUP_BUCKET`, `BACKUP_CRON`, `BACKUP_MAX_IDADE_HORAS`, `CORS_ORIGINS`, `MFA_ENFORCE_FROM`, `MFA_REQUIRED_ROLES`, `KIXIMA_USD_AOA_RATE`, `KIXIMA_PRECO_*`, `KIXIMA_FEE_*`, `IVA_RATE`, `WITHHOLDING_RATE`, `ALERTA_INTERVALO_MIN`, `SENTRY_FRONTEND_DSN`, etc. Constam de `render.yaml` as de Brevo, RabbitMQ, ERP, AGT e storage.

---

## 11. Diferenças evidentes no `backend-java/` (não auditado a fundo)

- Os mesmos módulos existem em Java (`ao/kixima/agt/*`, `faturacao/SaftService.java`, `messaging/EventBus.java`, `notification/EmailDispatchService.java`, `cobranca/*`, `analytics/AiRecommendationService.java`, `storage/StorageService.java`).
- **Timeouts explícitos** em Java, que o Node não tem: AGT `connectTimeout 15 s` e pedido 30 s (`agt/AgtSandboxClient.java:57,196`), email Brevo 15/20 s (`notification/EmailDispatchService.java:63,131`), Anthropic `connectTimeout 15 s` (`analytics/AiRecommendationService.java:36`).
- Realtime em Java é **STOMP**, não Socket.IO (`realtime/RealtimeService.java:28`).
- Anthropic em Java por HTTP directo, sem SDK (`AiRecommendationService.java:26`).
- A limitação USD vs AOA do Multicaixa repete-se (`cobranca/HttpGatewayAdapter.java:102`, `cobranca/AssinaturaService.java:455`); `conciliacao/MulticaixaService.java` só espelha o estado do canal.

---

## Achados

| Severidade | Tipo | Descrição | Evidência | Confirmado? |
|---|---|---|---|---|
| Alta | incompleto | O SAF-T exportado não está em conformidade: sem validação XSD; sem tabelas mestre de produtos/impostos nem fornecedores; sem recibos (RC); totais ignoram notas de crédito; hash SHA-256 interno em vez de assinatura RSA; `Tax` sem tipo/percentagem; marcadores `POR-CONFIGURAR`/`SoftwareCertificateNumber='0'` geram ficheiro com ar completo; `InvoiceNo` ≠ `agtDocumentNo` usado na AGT. | `backend/src/services/saftService.js:164-334,174-175,189,193,222-227,235-237,272-275`; `backend/src/services/faturacaoService.js:55-58,105-114`; `backend/tests/faturacao-agt.test.js:390-436` | Sim (leitura do código). Conformidade real face ao XSD angolano: não confirmado — o repo não o contém. |
| Alta | falha | O canal Multicaixa/EMIS nunca consegue iniciar um pagamento de subscrição: as cobranças são pedidas em `USD` e o adaptador recusa tudo o que não seja `AOA`. | `backend/src/services/assinaturaService.js:568-573`; `backend/src/services/multicaixaService.js:66-71`; Java idem: `backend-java/.../cobranca/HttpGatewayAdapter.java:102`, `AssinaturaService.java:455` | Sim |
| Alta | vulnerabilidade | Em modo S3 os documentos de credenciamento (chave com o NIF da empresa), apólices e comprovativos de pagamento são guardados no mesmo bucket das imagens (público por desenho) e o URL público é o guardado; o controlo de acesso de `/api/uploads` só existe em modo local. Nomes `taxId-tipo-timestamp.ext`. | `backend/src/services/storageService.js:145-163`; `backend/src/services/companyService.js:80-98`; `backend/src/services/paymentService.js:70`; `backend/src/services/assinaturaService.js:379`; `backend/src/routes/uploadsRoutes.js:3-6`; `backend/src/config/env.js:315-321` (comentário: bucket das imagens é público) | Sim no código; depende de o bucket estar de facto público (é o que o próprio repo exige). |
| Alta | falha | Chamadas à AGT são síncronas, dentro do pedido HTTP, sem timeout nem retry: `fetch` sem `AbortSignal`; a emissão de fatura aguarda a submissão apesar do comentário "não-bloqueante". Uma AGT lenta pendura emissão de faturas, pagamentos e anulações. | `backend/src/services/agtSandboxClient.js:221`; `backend/src/services/poService.js:603-604`; `backend/src/services/paymentService.js:173,214` | Sim (ausência de timeout no código; comportamento sob lentidão não executado). |
| Média | falha | Cada FT/NC é enviada à AGT duas vezes, com dois formatos de payload e assinatura diferentes (plano pipe-delimited vs envelope v2.0) e o mesmo `documentNo`; o próprio código espera recusa por duplicado. Não se sabe qual formato a AGT aceita. | `backend/src/services/agtSandboxSubmissionService.js:37-92`; `backend/src/services/agtPayloadService.js:388-403`; `backend/src/services/paymentService.js:164-173`; `backend/src/services/creditNoteService.js:177-178,219-243` | Sim (duplicação). Aceitação pela AGT: não confirmado. |
| Média | falha | `pedido()` trata resposta sem corpo JSON (ou não-JSON com 2xx) como sucesso; a submissão silenciosa audita `AGT_SANDBOX_SUBMETIDO` com `resultCode: null`. | `backend/src/services/agtSandboxClient.js:227-237`; `backend/src/services/agtSandboxSubmissionService.js:78-84` | Sim |
| Média | falha | `atribuirDocumentNo` usa a série AGT mais recente por tipo/ano/estabelecimento sem filtrar NIF nem validar o intervalo `authorizedQuantity/lastDocumentNo`; todas as empresas partilham a série da conta KIXIMA e as credenciais Basic são únicas, enquanto o `taxRegistrationNumber` do documento é o do fornecedor. | `backend/src/services/agtSeriesService.js:203-237`; `backend/src/config/env.js:377-399`; `backend/prisma/schema.prisma:1298-1336` | Sim (comportamento). Aceitação pela AGT: não confirmado. |
| Média | falha | Rotas GET com efeitos: `/agt-serie-payload` submete um pedido à AGT; `/agt-payload` consome número de série (queima de números, buracos na série AGT); `/agt-estado` chama a AGT. Pré-visualizar um documento atribui-lhe número definitivo. | `backend/src/routes/faturacaoRoutes.js:118-127,135-144,161-190`; `backend/src/services/agtPayloadService.js:79-82`; `backend/src/services/agtSeriesService.js:230-234` | Sim |
| Média | falha | `verificarCadeia` ignora o parâmetro `ano` na consulta e compara a numeração com `i+1`, gerando falsos "buracos"/"elos partidos" quando a série atravessa anos; só verifica faturas (não NC nem RC). | `backend/src/services/faturacaoService.js:206-266` | Sim (leitura) |
| Média | vulnerabilidade | Callback ERP: HMAC sem timestamp/nonce (replay); `poId` não é validado contra tenant; `aplicarPagamentoErp` usa `valorPago` do ERP como `Payment.amount` e marca a PO/fatura `PAGA` sem comparar com o valor da fatura. | `backend/src/routes/integrationRoutes.js:33-41`; `backend/src/services/poService.js:420-470` (`amount: valorPago != null ? valorPago : invoice.amount`) | Sim (leitura) |
| Média | falha | Webhook de pagamento de subscrição não confere o montante nem a referência devolvidos pelo gateway (`verificado.montante/referencia` ignorados) contra a cobrança; endpoint público sem assinatura própria (confia só na reconsulta). Formatos dos gateways são palpites. | `backend/src/routes/webhookPagamentoRoutes.js:22-36`; `backend/src/services/assinaturaService.js:602-632` | Sim (leitura). Exploração: não demonstrada. |
| Média | falha | eventBus entrega "no máximo uma vez": sem esperar confirmação do broker, sem `mandatory`, sem outbox/retry; a fila só é declarada pelo consumidor, logo eventos publicados antes de ela existir perdem-se. Só `approval_requested` regista falha (`ErpSyncLog`), e a PO fica à espera sem reenvio; os outros 4 eventos não deixam rasto de falha. | `backend/src/services/eventBus.js:25-80`; `backend/src/services/poService.js:176-189`; `kixima-integration-service/src/consumers/rabbitmq.consumer.ts:44-47` | Sim (leitura) |
| Média | falha | Não há listeners de `error`/`close` no canal AMQP (só na ligação); um erro de canal pode ficar sem tratamento e deixar `channelPromise` obsoleto. | `backend/src/services/eventBus.js:28-35` | Não confirmado (risco por padrão conhecido do `amqplib`; não reproduzido). |
| Média | falha | Email Brevo sem timeout nem retry e com erros engolidos; as notificações são aguardadas dentro de operações de negócio (`Promise.all` em `notifyUsersByRole`), pelo que um Brevo lento atrasa PO/pagamentos e um erro faz o utilizador nunca receber convite/recuperação sem aviso. | `backend/src/services/notificationService.js:25-46,57-63,178-198` | Sim (leitura) |
| Média | dívida | A recomendação de IA é chamada a cada abertura de `/analise`, sem cache; o SDK tem timeout de 10 min e 2 retries por omissão; envia o nome da empresa e agregados de compras à Anthropic. | `backend/src/routes/categoryManagementRoutes.js:35-45`; `backend/src/services/aiRecommendationService.js:42-52,69-79`; `backend/node_modules/@anthropic-ai/sdk/client.js:104,113,904` | Sim |
| Média | vulnerabilidade | O `pg_dump` recebe a connection string (com palavra-passe) como argumento de linha de comandos (visível a quem lista processos no contentor) e a cópia é carregada e comprimida em memória (`maxBuffer` 1 GiB, `gzipSync`) num contentor de 512 MB. | `backend/src/jobs/backupJob.js:56-61` | Sim (leitura) |
| Baixa | falha | `getEndpoint` rebenta com `TypeError` se `AGT_ENV` tiver valor diferente de `hml`/`prd`. | `backend/src/config/agt.js:42-45` | Sim |
| Baixa | incompleto | `listarSeries` está declarado (URL e `.env.example`) mas o cliente não o implementa; `consultarFactura`/`listarFacturas` existem sem chamadores e com verbo/forma "por confirmar". | `backend/src/config/agt.js:23-24`; `backend/src/services/agtSandboxClient.js:27-32,326-347` | Sim |
| Baixa | dívida | Documentação interna incoerente: comentários falam em schema "v1.2" enquanto o código envia `schemaVersion: '2.0'`; a regra de arredondamento por excesso da spec não está ligada ao cálculo real. | `backend/src/config/env.js:355,233`; `backend/src/services/agtSandboxClient.js:11,130`; `backend/src/services/agtPayloadService.js:264`; `backend/src/services/faturacaoService.js:60-67` | Sim |
| Baixa | dívida | Dados sensíveis em logs: modo `console` regista o corpo do email (inclui links com token de recuperação/convite); "Solicitar Série" regista o pedido assinado completo. | `backend/src/services/notificationService.js:51`; `backend/src/services/agtSeriesService.js:78` | Sim |
| Baixa | dívida | Credenciais ERP enviadas em claro (JSON) ao microserviço com bearer estático e sem timeout; falha de decifra silenciada pode apagar segredos ao gravar com valores mascarados; chave AES sem versão/rotação. | `backend/src/services/erpConfigService.js:42-57,97,143-151`; `backend/src/services/erpCrypto.js:12-37` | Sim (leitura) |
| Baixa | dívida | Sentry: só `captureException` manual em 5xx; sem scrubbing de PII nem handler Express oficial; tracing a 0 por omissão. | `backend/src/config/sentry.js:11-31`; `backend/src/middleware/errorHandler.js:14,54` | Sim |
| Baixa | dívida | Socket.IO sem adaptador (estado em memória, uma instância), sem limitação por socket; o handshake não aplica a sessão restrita de 2FA. | `backend/src/services/realtimeService.js:66-93,117-124` | Sim (leitura). Intenção quanto à 2FA: não confirmado. |
| Baixa | dívida | `backend/.env.example` omite variáveis lidas pelo código (Brevo, RabbitMQ, ERP, backups, CORS…); e há dois caminhos de arranque de schema (`db push` no `backend/Dockerfile`, `migrate-boot` no Dockerfile raiz). | `backend/.env.example`; `backend/Dockerfile:31`; `Dockerfile:77`; `backend/src/config/env.js:292-296` | Sim |
| Baixa | dívida | O `backend/Dockerfile` não instala `pg_dump`; o job de backup falharia nessa imagem. | `backend/Dockerfile:5`; `Dockerfile:25-36`; `backend/src/jobs/backupJob.js:56` | Sim |
| Info | dívida | Java já tem timeouts nas chamadas externas (AGT, Brevo, Anthropic); Node não. Realtime em Java é STOMP. | `backend-java/src/main/java/ao/kixima/agt/AgtSandboxClient.java:57,196`; `notification/EmailDispatchService.java:63,131` | Sim |

## Dúvidas por resolver

1. A AGT aceitou algum documento em HML? Os comentários dizem "confirmado em produção (HML)", mas o repo não guarda respostas nem testes de integração; não se sabe qual dos dois formatos de payload (pipe-delimited plano vs envelope v2.0) é o aceite.
2. Como e onde é registada a chave pública correspondente a `AGT_JWS_PRIVATE_KEY_BASE64` junto da AGT, e se o nº de validação do software já existe.
3. A AGT permite uma única conta Basic KIXIMA a submeter em nome de vários NIFs de fornecedores, com uma série partilhada? É o que o código faz hoje.
4. Versão/XSD oficial do SAF-T de Angola (o namespace `AO_1.01_01` e a estrutura são assumidos pelo modelo PT).
5. Se o bucket `STORAGE_BUCKET` de produção é de facto público e se os documentos de KYC/comprovativos deviam ir para um bucket privado com URLs assinados.
6. Se o plano e o contrato permitem usar Multicaixa em AOA (conversão USD→AOA existe como `KIXIMA_USD_AOA_RATE`, mas não é usada neste fluxo).
