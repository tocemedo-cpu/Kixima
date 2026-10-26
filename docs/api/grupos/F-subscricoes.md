# Grupo F_subscricao: subscrições, add-ons e PO Robot

Ficheiros lidos: `backend/src/routes/assinaturaRoutes.js`, `addonRoutes.js`, `poRoboRoutes.js`; services `assinaturaService.js`, `addonService.js`, `planService.js`, `canaisPagamentoService.js` (e adaptadores `multicaixaService.js`, `paypayService.js`, `bancoGatewayService.js` só nas partes `estado`/`pedirPagamento`), `poRoboService.js`, `categoryAnalyticsService.js`, `storageService.js`, `uploadAccessService.js`, `config/upload.js`, `utils/fileSignature.js`; schema Prisma (`PlanoCobranca`, `AddonCobranca`, `CompanyAddon`, `PoRoboRegra`, enums) e a migração `20260918000000_cobranca_unica_em_aberto`. Os 20 endpoints do inventário estão todos no YAML (sem rotas em falta ou erradas no inventário).

## (a) Resumo do grupo

### O que faz
Três routers montados em `app.js:197-199` (`/api/assinatura`, `/api/addons`, `/api/po-robot`), todos com `authenticate` em `router.use`. O modelo é "a empresa pede e paga, a KIXIMA confirma". Em ambos os routers as rotas da KIXIMA (`/fila`, `/:id/confirmar`) estão declaradas antes das da empresa e com guards explícitos (`requireRole('ADMIN_SISTEMA')` + `requirePermission('financeiro')`).

### Planos e feature gating (`planService.js`)
- Escada `BASE < CORE < PRO` (`planService.js:96`); `BASICO` é um alias legado de `CORE` (`:260`). Preços por ambiente (`KIXIMA_PRECO_*`): BASE 100 USD/trimestral, CORE 100 USD/mensal, PRO 5000 USD/anual por omissão (`:135-150`).
- Dimensão da empresa (`MICRO/PEQUENA/MEDIA/GRANDE`) define o plano mínimo: GRANDE só pode subscrever PRO (`:90-100`, usado em `assinaturaService.impedimento`, `:137`).
- Os limites e funcionalidades vivem em `FEATURES` (`:182-248`); a guarda `assertFeature` (`:320`) é usada fora deste grupo (kits, API de catálogo, ERP, importação em massa, contratos-quadro, relatório de conteúdo local, Category Management) e devolve 400 `PLANO_INSUFICIENTE` com `details.planoNecessario`. Quando a subscrição está `RESTRITA` (vencida há mais de `KIXIMA_GRACE_PERIOD_DAYS`, 7 por omissão) essas funcionalidades premium são bloqueadas.
- O estado de subscrição (`ATIVA`/`A_EXPIRAR`/`GRACE`/`RESTRITA`) nunca é persistido; calcula-se de `Company.planoValidoAte` a cada leitura (`:54-62`). Um vencimento nunca desce o plano sozinho.
- Neste grupo a verificação de plano no servidor existe em três sítios: `assinaturaService.pedir` (dimensão, lugares, perdas), `addonService.pedir` (`PO_ROBOT` exige PRO) e `addonService.assertAddon` (add-on activo e dentro da validade, usado em 3 das 5 rotas do PO Robot).

### Máquina de estados da cobrança (`CobrancaStatus`, igual em `PlanoCobranca` e `AddonCobranca`)
```
              pedir (201)
                 v
             PENDENTE --- comprovativo (multipart) ---> COMPROVATIVO_ENVIADO
                 |  ^                                         |  (re-envio permitido)
                 |  +-------------------------------------------+
                 |                                             |
   cancelar (empresa ou admin) <-----------------------------+
                 v                                             |
             CANCELADA                         confirmar (ADMIN_SISTEMA, exige comprovativo)
                                                               v
                                                          CONFIRMADA
```
- Só pode existir uma cobrança em aberto (`PENDENTE`/`COMPROVATIVO_ENVIADO`) por empresa (subscrição) ou por empresa+add-on; garantido por índice único parcial na base de dados (migração `20260918000000`) e traduzido de `P2002` para 409.
- `CONFIRMADA` e `CANCELADA` são terminais. Não existe estado `REJEITADA` nem regresso a `PENDENTE`.
- Regras de ouro (comentários em `assinaturaService.js:23-31`): o plano/add-on só muda na confirmação; o preço, período e meses ficam congelados na cobrança no pedido.
- Confirmação: `Company.plan`, `searchRank`, `planoValidoAte` (e `ultimoAvisoSubscricaoTier=null`) mudam na mesma transacção que a cobrança e a auditoria `SUBSCRICAO_CONFIRMADA` (`assinaturaService.js:441-507`). Para add-ons, `CompanyAddon` é criado/renovado por `upsert` na transacção (`addonService.js:241-290`). `validoAte` soma `meses` a partir do fim da validade ainda em vigor, ou de hoje.
- Segundo caminho de confirmação (fora deste grupo mas ligado): webhook `POST /api/webhooks/pagamento/{canal}` -> `confirmarViaGateway` (`assinaturaService.js:602`). Só subscrições BASE/CORE; o PRO e todos os add-ons só se pagam por transferência com confirmação humana.

### Quem confirma pagamentos
Só um `ADMIN_SISTEMA` com a área `financeiro` (ou Super Admin, `adminAreas` vazio) chama `/confirmar`; a empresa nunca confirma o seu próprio pagamento. Os requisitos são: cobrança existente, não confirmada, não cancelada e com `comprovativoUrl`. O comprovativo é obrigatório no upload e a confirmação sem ele é recusada (400). O sistema não verifica valor, data, titular nem referência da transferência: a verificação é humana.

### Comprovativo por transferência bancária
Multipart, campo `comprovativo`; tipos `png/jpeg/webp/gif/pdf`; máximo 10 MB (`config/upload.js:34-49`, `uploadDocuments`). SVG e HEIC são rejeitados. Além do filtro de mimetype do Multer, `storageService.saveFile` compara os primeiros bytes com o tipo declarado (`fileSignature.verificar`, `storageService.js:152`). Guarda em `proofs/<subscricao|addon>-<referencia>-<timestamp>.<ext>`. Notifica todos os `ADMIN_SISTEMA` (tipo `SUBSCRICAO_COMPROVATIVO`). Acesso ao ficheiro em modo local controlado por `uploadsRoutes.js` + `uploadAccessService.js:35-49`: dono da cobrança (mesma empresa) ou ADMIN_SISTEMA, resposta 404 aos restantes e `Cache-Control: private, no-store`.

### Papéis por endpoint (resumo)
| Endpoint | Papéis |
|---|---|
| `GET /api/assinatura`, `/canais`, `POST /pedir`, `/:id/pagar-com`, `/:id/comprovativo` | COMPANY_ADMIN (FINANCEIRO foi retirado de propósito, `assinaturaRoutes.js:29-33`) |
| `GET /api/assinatura/fila`, `POST /:id/confirmar` (e addons idem) | ADMIN_SISTEMA + área `financeiro` |
| `POST /api/assinatura/:id/cancelar`, `POST /api/addons/:id/cancelar` | COMPANY_ADMIN (só a sua empresa) ou ADMIN_SISTEMA com `financeiro` (qualquer) |
| `GET /api/addons/catalogo` | qualquer autenticado |
| `GET /api/addons/:addonKey/estado` | COMPANY_ADMIN, FINANCEIRO, COMPRADOR |
| `POST /api/addons/:addonKey/pedir` | COMPANY_ADMIN |
| `POST /api/addons/:id/comprovativo` | COMPANY_ADMIN, FINANCEIRO |
| `/api/po-robot/*` | COMPANY_ADMIN (`router.use`) |

### PO Robot
O Company Admin configura regras (`PoRoboRegra`: produto, `mediaOrigem` IA|MANUAL, `mediaMensal`, `periodicidade` SEMANAL|QUINZENAL|MENSAL, `quantidade` fixa opcional, `limiteMaximoUsd` opcional, `ativo`, `proximaExecucaoEm`). Um cron diário às 06:00 (`jobs/poRoboJob.js`) chama `poRoboService.executarCiclo`: reclama a regra de forma atómica (`updateMany` condicional, `:139`), reverifica o add-on, cria uma PO em `AGUARDANDO_APROVACAO` através de `createPurchaseOrder` (`createdBySource='ROBOT'`, em nome do Company Admin activo mais antigo) e só depois avança `proximaExecucaoEm`. O robot nunca aprova nem paga. Falhas (produto inactivo, limite excedido, sem admin) repõem a data original e emitem um alerta operacional; por isso uma regra permanentemente inválida volta a falhar e a alertar todos os dias.

### Fora do âmbito mas relacionado
`/api/webhooks/pagamento/*` (sem sessão, confirma via gateway), `subscriptionExpiryJob` (avisos D30/D7/D3/D1/D0/grace), `GET /api/uploads/:filename`.

## (b) Achados

| Severidade | Tipo | Descrição | Evidência | Confirmado? |
|---|---|---|---|---|
| Alta | falha | O `pagar-com` por `EMIS_MULTICAIXA` falha sempre: a rota envia `moeda: 'USD'` e o adaptador recusa tudo o que não seja AOA. Todos os erros dos adaptadores (sem configuração, recusa do gateway, moeda, sem id de transacção) são `Error` simples e chegam ao cliente como 500 `INTERNAL_ERROR` com mensagem genérica, em vez de 503/400. | `assinaturaService.js:568-577`; `multicaixaService.js:64-71,40-45,90`; `errorHandler.js` (só trata `AppError`) | Sim (leitura do código; não executado) |
| Alta | vulnerabilidade | Em produção o armazenamento é obrigatoriamente S3 e o URL guardado em `comprovativoUrl` aponta directamente ao bucket (o controlo de acesso de `/api/uploads` só vale para o modo local). O nome do ficheiro é previsível: `subscricao-SUB-AAAA-NNNNNN-<Date.now()>.<ext>` (referência sequencial + timestamp em ms). Os comprovativos ficam na pasta `proofs/` do mesmo bucket que serve as imagens públicas (`STORAGE_PUBLIC_URL`). Se o bucket/prefixo for legível publicamente, os comprovativos bancários podem ser adivinhados e lidos sem sessão. | `storageService.js:18-22,89-97,154-160`; `uploadsRoutes.js:1-5`; `config/env.js:450`; `assinaturaService.js:379-385`; `addonService.js:194-200` | Parcial: o código mostra o padrão; a política real do bucket não é verificável a partir do repositório |
| Média | falha | `confirmar` (subscrição e add-on) lê o estado e escreve sem condição: o `update` filtra só por `id`, não por `status`. Dois cliques/pedidos simultâneos (ou admin + webhook) passam ambos as verificações e somam o período duas vezes; `confirmar` e `cancelar` simultâneos também podem cruzar-se. | `assinaturaService.js:509-532,444-453`; `addonService.js:292-312,253-256`; `confirmarViaGateway` só é idempotente por leitura de estado (`:608`) | Sim (leitura; sem teste de concorrência) |
| Média | falha | Pagamento via gateway depois de a cobrança ser cancelada: `confirmarViaGateway` lança 409 ("pagamento chegou tarde de mais") e não há reconciliação nem alerta no código lido; o dinheiro foi recebido e o plano não activa. Além disso `pagar-com` pode ser repetido enquanto `PENDENTE` e sobrescreve `referenciaExterna`; o callback da primeira transacção deixa de coincidir (409) e fica sem plano activado. | `assinaturaService.js:557-583,609-614,632-660` | Sim (leitura) |
| Média | falha | O add-on PO Robot não é reavaliado contra o plano nem contra o estado `RESTRITA`: `assertAddon` só verifica `CompanyAddon.status` e `validoAte`. Uma empresa que desce de PRO para CORE/BASE mantém o robot até `validoAte`; as `perdas` avisadas na descida só contam chaves de API, kits e contratos-quadro (não add-ons). | `addonService.js:91-104,113-115`; `assinaturaService.js:52-74,180-188`; `poRoboService.js:65` | Sim (leitura) |
| Média | falha | `POST /api/po-robot/regras` só confirma que o produto existe. Aceita produtos inactivos, produtos da própria empresa (o `createPurchaseOrder` recusa-os depois: "Não pode comprar produtos da sua própria empresa") e produtos de qualquer fornecedor, bem como várias regras para o mesmo produto. O erro só aparece às 06:00, e a regra repete a falha e o alerta operacional todos os dias. | `poRoboRoutes.js:73-74`; `poRoboService.js:67-70,159-180`; `poService.js:44-46` | Sim (leitura) |
| Média | incompleto | Não há forma de rejeitar um comprovativo: a KIXIMA só pode confirmar ou cancelar a cobrança inteira (a empresa tem de pedir outra). Não existe estado `REJEITADA`/regresso a `PENDENTE`. Cancelar (e re-enviar comprovativo) não notifica ninguém. | `assinaturaService.js:632-660`; enum `CobrancaStatus` (`prisma/schema.prisma:86-91`) | Sim |
| Média | incompleto | Add-ons: não há canal de pagamento automático nem webhook (o webhook só procura `planoCobranca`), a fila `/api/addons/fila` não lista add-ons vencidos, `/estado` não devolve histórico, e nenhum job avisa da expiração de add-ons (só existe aviso escalonado para planos). | `webhookPagamentoRoutes.js:30-36`; `addonService.js:345-357,66-84`; grep: só `addonService`, `poRoboService`, `uploadAccessService` referem add-ons em `services/` e `jobs/` | Sim (por pesquisa no repositório) |
| Baixa | vulnerabilidade | `GET /api/assinatura` (e a fila) devolvem a linha `PlanoCobranca` inteira, incluindo `notas` (notas internas escritas pela KIXIMA na confirmação, ou o motivo do cancelamento), `confirmadaPor` (id do admin), `createdById`, `referenciaExterna`, `telemovel`. Não há `select`. | `assinaturaService.js:204-212` | Sim |
| Baixa | falha | `PUT /api/po-robot/regras/:id`: `ativo` é convertido com `Boolean(...)`, por isso a string `"false"` (ou qualquer string não vazia) activa a regra. Um corpo vazio gera `update` vazio e uma linha de auditoria. | `poRoboRoutes.js:108,128-136` | Sim |
| Baixa | falha | Validação de entrada manual e inconsistente com o resto da API: nos três routers não se usa `validate(schema)`/Zod; os erros saem como 422 `VALIDATION_ERROR` sem `details`. `req.body.notas` (confirmar), `telemovel` (pagar-com) e `motivo` (limite de tamanho) não têm tipo/tamanho validados; um `notas` não-string provavelmente provoca 500 do Prisma. Os `:id` não são validados como UUID. | `assinaturaRoutes.js:26,60,83`; `addonRoutes.js:27,54`; `poRoboRoutes.js:41-67` | Parcial: o 500 com `notas` não string não foi executado |
| Baixa | incoerência | O FINANCEIRO pode ver o estado do add-on e enviar comprovativo de add-on, mas foi explicitamente retirado do fluxo de subscrição (cuja página era o mesmo caso de uso). | `addonRoutes.js:31,42` vs `assinaturaRoutes.js:29-33` | Sim |
| Baixa | falha | Falhas de escrita no S3 lançam `Error` com `status = 502`, mas `errorHandler` só usa `statusCode` de `AppError`, logo o cliente recebe 500 genérico. | `storageService.js:111-117`; `errorHandler.js:10-27,58-66` | Sim |
| Baixa | falha | O comprovativo é guardado no armazenamento antes de actualizar a base de dados e pode ser substituído em `COMPROVATIVO_ENVIADO`; o ficheiro anterior (ou o de uma actualização falhada) fica órfão. | `assinaturaService.js:378-390`; `addonService.js:194-205` | Sim |
| Baixa | vulnerabilidade | Enumeração de ids: uma cobrança de outra empresa responde 403 e uma inexistente 404, o que revela a existência do UUID. O `cancelar` pela empresa depende de `companyId &&`: se `companyId` do utilizador fosse nulo, a verificação de posse seria ignorada (hipótese teórica). | `assinaturaService.js:370-373,638-640`; `addonService.js:186-189,320-322` | Parcial |
| Baixa | dívida | `GET /api/assinatura/fila` devolve todas as empresas vencidas sem paginação. | `assinaturaService.js:678-683` | Sim |
| Baixa | dívida | Os comentários do router PO Robot dizem que "todas as rotas exigem o add-on ativo", mas `GET /regras` e `DELETE /regras/:id` não chamam `assertAddon` (o `DELETE` parece intencional: permite limpar regras após o fim do add-on). | `poRoboRoutes.js:3-5,23,141` | Sim |
| Baixa | falha | `/api/assinatura/canais` devolve `canal: 'MULTICAIXA_EXPRESS'` para a chave `EMIS_MULTICAIXA`: o valor do campo `canal` não coincide com o enum `CanalCobranca` usado em `pagar-com`. `emFalta` expõe os nomes das chaves de configuração em falta (não os valores). | `multicaixaService.js:129-137`; `canaisPagamentoService.js:11,22-24` | Sim |

## (c) Dúvidas por resolver

1. **Política do bucket S3 para `proofs/`**: não é possível confirmar a partir do código se o bucket (ou o prefixo `proofs/`) é privado. Se for público, o primeiro achado de alta severidade é explorável.
2. **Pro-rata**: a confirmação de uma descida de plano baixa já o plano mas estende a validade a partir do fim da validade actual (`novoValidoAte`, `assinaturaService.js:426-431`), sem crédito do período já pago de um plano superior; numa subida, a empresa paga o preço completo mas o novo período começa depois do fim do período em curso. Não se sabe se é uma decisão comercial.
3. **Notificação aos admins**: `notifyUsersByRole({roles:['ADMIN_SISTEMA']})` é chamada sem `companyId` (`undefined`), pelo que se presume que o filtro Prisma é ignorado e notifica todos os ADMIN_SISTEMA activos, sem respeitar a área `financeiro`. Não foi executado para confirmar.
4. **Quem executa o `confirmar` quando o admin tem áreas restritas sem `financeiro`**: coberto por `requirePermission` (403 com mensagem), mas não foi lido o teste correspondente.
5. **Inventário**: sem discrepâncias. As rotas `GET /api/assinatura/{canais,fila}` não colidem com nenhum `/:id` de GET, e a ordem de declaração foi verificada.
6. **Serialização de `Decimal`**: assumi que o Prisma serializa `Decimal` como string em JSON (comportamento padrão de `Decimal.js`); não foi confirmado contra uma resposta real.
7. **Backend Java**: não foi lido; não se confirma se espelha as mesmas validações (por exemplo o índice único parcial).
