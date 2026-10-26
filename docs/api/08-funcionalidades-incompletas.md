# 08 · Funcionalidades incompletas, não aplicadas ou apenas preparadas

> Lista consolidada do que **existe no código mas não funciona de ponta a ponta**, ou que o produto sugere e o código não faz. Cada linha aponta para a nota onde está a evidência (`ficheiro:linha`). Inclui o estado de cada integração externa. Tudo foi verificado por leitura estática; o que depende de configuração fora do repositório (painel do Render, política do bucket, credenciais) está marcado «não confirmado».

## 1. Regras de negócio que não são aplicadas

| # | O que o produto sugere | O que o código faz | Evidência |
|---|---|---|---|
| 1 | Prazo de pagamento de **7 dias** | Só calcula `paymentDueAt`/`Invoice.dueAt`. Nenhum job, rota ou service marca `VENCIDA`, cancela a PO ou avisa. O comprador pode pagar depois do prazo. | [grupos/E](grupos/E-ordens-pagamento-fiscal.md) A6 |
| 2 | Tecto do contrato-quadro | `usedValue` só sobe; nada compara com `totalValue`. | [grupos/E](grupos/E-ordens-pagamento-fiscal.md) A10; [05](05-base-de-dados-supabase.md) F7 |
| 3 | Estados `VENCIDA`, `CANCELADA` (fatura), `ACEITE_FORNECEDOR` (PO), `FALHOU` (pagamento) | Existem nos enums, ninguém os escreve. | [05](05-base-de-dados-supabase.md) F22 |
| 4 | Devolução do stock reservado | O stock é decrementado ao criar a PO e **não** é devolvido em rejeição/recusa. | [05](05-base-de-dados-supabase.md) F6 |
| 5 | Nota de crédito anula a fatura | Fatura anulada continua `PENDENTE` e é paga pelo valor integral. | [grupos/E](grupos/E-ordens-pagamento-fiscal.md) A7 |
| 6 | Conciliação bancária fecha o ciclo | Marca a fatura `PAGA`, mas **não** passa a PO a `PAGA`, não cobra a taxa da plataforma e perde a auditoria (chamada com assinatura errada, erro engolido). | [grupos/E](grupos/E-ordens-pagamento-fiscal.md) A2/A3; [05](05-base-de-dados-supabase.md) F5 |
| 7 | Cotações (RFQ) | Isoladas: não geram PO, não notificam, não auditam; `minQuantity`/`maxQuantity` nunca aplicados. | [grupos/D](grupos/D-catalogo-e-mercado.md) |
| 8 | Kits de produtos | Só criar/listar/desactivar; sem edição, sem preço de kit e sem uso noutros módulos. | [grupos/D](grupos/D-catalogo-e-mercado.md) |
| 9 | Fecho de conversas do Chat Comercial | Estado `FECHADA` existe; **nenhum endpoint** o define. | [grupos/G](grupos/G-suporte-e-conversas.md) |
| 10 | Alertas de risco do Chat Comercial | Cria `RiskAlert` e auditoria, mas **não notifica o Suporte**; a heurística só analisa o `body` (não o anexo). | [grupos/G](grupos/G-suporte-e-conversas.md) |
| 11 | Rejeitar comprovativo de subscrição | Não existe (só confirmar ou cancelar). | [grupos/F](grupos/F-subscricoes.md) |
| 12 | Motivo da rejeição de empresa | Só vai para a auditoria; não é guardado nem enviado no email. `SUSPENSA` existe no enum sem endpoint. | [grupos/B](grupos/B-empresas.md) B-12 |
| 13 | Plano **BASE/CORE** em `PUT /companies/{id}/plan` | Só aceita `BASICO` ou `PRO`. | [grupos/B](grupos/B-empresas.md) B-13 |
| 14 | Anonimização RGPD | Só limpa `AuditLog.actorName`; deixa `entityRef` com email, `ip`, `detail`, `passwordHash`, `mfaCodeHash`, ficheiro de avatar e texto de chats/feedback. | [grupos/A](grupos/A-auth-e-publico.md) F-11; [05](05-base-de-dados-supabase.md) F11 |
| 15 | Retenção de convites expirados | Nunca apanha convites `PENDENTE` fora de prazo (`EXPIRADO` só é calculado na leitura). | [05](05-base-de-dados-supabase.md) F12 |
| 16 | Crons recuperam execuções perdidas | Não recuperam; no plano gratuito o serviço adormece e perde a janela das 06:00/07:00. | [05](05-base-de-dados-supabase.md) F18 |
| 17 | Category Management coerente | Compara volumes em AOA com patamares em USD sem conversão. | [grupos/C](grupos/C-admin-e-relatorios.md) |
| 18 | Listas completas | Todo `findMany` sem `take` é truncado a 1000 linhas (KPIs financeiros, relatório de conteúdo local, utilizadores, taxas), sem aviso ao utilizador. | [grupos/C](grupos/C-admin-e-relatorios.md); [05](05-base-de-dados-supabase.md) F19 |
| 19 | Descida de plano / add-ons | O add-on PO Robot não é reavaliado contra o plano; descer de PRO mantém o robot. Sem pro-rata. | [grupos/F](grupos/F-subscricoes.md) |
| 20 | Regras do PO Robot validadas ao criar | Só valida que o produto existe; produto inactivo/duplicado só falha no cron e o alerta repete-se diariamente. | [grupos/F](grupos/F-subscricoes.md) |

## 2. Integrações externas: estado real

Detalhe, variáveis e evidência em [06](06-integracoes-externas.md).

| Integração | Estado | O que falta |
|---|---|---|
| **AGT (e-Fatura)** — assinatura JWS, cliente REST HML/PRD, séries, submissão FT/NC/RC | **Parcial** | Programa **não certificado** (`AGT_SOFTWARE_VALIDATION_NUMBER` vazio). Sem evidência no repo de que a AGT aceitou algum documento. Cada FT/NC é enviada **duas vezes** em formatos diferentes. Chamadas síncronas, sem timeout nem retry. `consultarFactura`/`listarFacturas` sem chamadores. |
| **SAF-T (AO)** | **Parcial, não conforme** | XML escrito à mão, sem XSD; sem tabelas de produtos/impostos nem recibos; `TotalCredit` ignora NC; hash SHA-256 e não RSA; `InvoiceNo` ≠ número AGT; `SoftwareCertificateNumber` cai em `'0'`. |
| Gerador de casos de certificação AGT | Ferramenta de teste | Nunca chamado por rotas. |
| Numeração fiscal interna + hash | Completa mas **opt-in** | Sem `Company.serieFiscal` o documento sai sem série, número nem hash. `verificarCadeia` dá falsos alarmes com mais de um ano de dados. |
| **Brevo** (email) | Completa | Sem timeout/retry; falhas de envio engolidas (excepto envio «directo»: 2FA, alertas). `BREVO_API_KEY` não consta de `.env.example`. Por omissão `EMAIL_PROVIDER=console` (regista o email inteiro no log). |
| **Supabase** Postgres + Storage S3 | Completa | Sem RLS; ficheiros privados no bucket público em produção (não confirmado se o bucket é público). Sem `connection_limit`. |
| Cópias de segurança (`pg_dump`) | Completa (opt-in) | Não consta de `.env.example`; credenciais na linha de comandos do processo. |
| **RabbitMQ / eventBus** | **Parcial** | Entrega «no máximo uma vez», sem confirmação do broker nem retry; a fila só existe depois de o consumidor arrancar. Sem URL é *no-op*. |
| **kixima-integration-service** | **Parcial** | `WebhookDelivery FAILED` nunca é reenviado; fila `webhook-callback` nunca usada; callbacks `integration.completed/failed` caem em «tipo desconhecido» no backend; o relay de decisões ERP pode perder-se (erro engolido, 202); sem CI nem e2e; adaptadores contra formatos presumidos. |
| **ERP** (config + callback) | Completa | `aplicarPagamentoErp` aceita o `valorPago` do ERP sem comparar com a fatura; callback sem *timestamp*/nonce. |
| **Gateways de pagamento** (Multicaixa/EMIS, PayPay, BAI, BFA, Standard Bank) | **Por ligar** | Implementados contra especificação presumida, sem credenciais. **EMIS falha sempre** para subscrições (cobrança em USD, adaptador só aceita AOA). Erros dos adaptadores saem como 500. |
| Webhook de pagamento | Parcial | Sem assinatura/HMAC; ignora montante e moeda; idempotência não atómica; só activa subscrições. |
| **IA** (Anthropic) | Completa (opcional) | `GET /api/category-management/analise` sem limitador próprio; envia nome da empresa e agregados de compras ao fornecedor de IA. |
| **Sentry** | Parcial | Só `captureException` manual em 5xx; o caminho pode conter tokens (SEG-32). |
| SMS, WhatsApp, push, captcha, Stripe… | **Não existem** | «WhatsApp» só aparece como ligação de contacto e numa regex de risco. |

## 3. `backend-java/` e frontend

| Tema | Estado | Detalhe |
|---|---|---|
| **Tempo real no Java** | **Não funciona com o frontend actual** | O Java só serve STOMP; o frontend só tem Socket.IO. `VITE_REALTIME=stomp` no `backend-java/Dockerfile:24` não é lido por nada no frontend. Chat de suporte, chat comercial e notificações em tempo real ficam sem ligação num deploy Java ([10](10-frontend-java-e-integration-service.md) B1/C1). |
| Paridade de rotas | Completa em cobertura (247 mapeamentos Java; nenhuma rota Node em falta) | Faturas consolidadas de contrato (sem PO) em `CreditNoteService` e `ConciliacaoService` ainda não tratadas no Java (B4). 15 marcadores «NÃO PORTADO» no código, vários já falsos; `docs/migracao-java/LACUNAS-POS-M6.md` desactualizado. Cutover (M8) não registado. |
| Sessão a meio do uso | Parcial | O frontend não trata `401` a meio da sessão (`api/client.js`, `auth/AuthContext.jsx:50`). |
| Sessão restrita por 2FA | Parcial | `mfaRestrita` não é consumida: cada página mostra o 403 isolado em vez de levar à página de Segurança (`components/AppLayout.jsx:161`). |
| `frontend/nginx.conf` | Parcial | Não reencaminha `/socket.io/` nem cabeçalhos de *upgrade* (só afecta a topologia `docker-compose`). |
| Endpoints sem interface | 40 endpoints Node nunca chamados pelo SPA (≈30 de negócio) | Inclui AGT/SAF-T, conciliação, chaves de API, ajustes de empresa, consolidação de contratos. Aproximação por *grep*. |

## 4. Itens de configuração e deploy

- `MFA_ENFORCE_FROM` não está no `render.yaml`: a 2FA obrigatória **nunca bloqueia** (SEG-11). `FINANCEIRO` não consta de `MFA_REQUIRED_ROLES`.
- `APP_URL` não está no `render.yaml` (os links de recuperação/convite podem usar o `Host` do pedido, SEG-10).
- Seeds com senhas fixas, um deles chamado no `CMD` do `Dockerfile` quando `CATALOG_COMPANY=1` ([05](05-base-de-dados-supabase.md) F3/F4).
- `migrate-boot.js` nunca falha o arranque por migrações pendentes (F15).
- Variáveis lidas pelo código mas ausentes de `backend/.env.example` (p. ex. `BREVO_API_KEY`, `RABBITMQ_*`, `BACKUP_*`) — [06](06-integracoes-externas.md).
- O `render.yaml` do `kixima-integration-service` aponta para o ramo `claude/kixima-app-work-gmz6jk`.
