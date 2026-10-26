# Documentação das APIs da KIXIMA

Documentação da API HTTP do backend Node (`backend/`), obtida por **análise estática do código-fonte**: nada foi executado contra produção nem contra uma base de dados, nenhum segredo foi lido e nenhum ficheiro do sistema foi alterado. Cada afirmação cita o ficheiro e a linha; o que depende de configuração fora do repositório (painel do Render, política do bucket, credenciais) está marcado como **não confirmado**.

## Índice

| Documento | Conteúdo |
|---|---|
| [`openapi.yaml`](openapi.yaml) | Especificação **OpenAPI 3.0.3** com as 247 operações: parâmetros, corpos, respostas, erros, segurança, `x-permissoes`, `x-limitador`. Validada com `openapi-spec-validator`. |
| [01 · Arquitetura](01-arquitetura.md) | Componentes, camadas, pipeline de cada pedido, frontend ↔ backend ↔ base de dados, jobs. |
| [02 · Autenticação e permissões](02-autenticacao-e-permissoes.md) | Sessão (cookie/Bearer), 2FA, papéis e áreas, chaves de API, HMAC, limites de pedidos, CORS/CSP. |
| [03 · Inventário de endpoints](03-inventario-endpoints.md) | Tabela completa por área: método, caminho, autenticação, papéis, limitador, ficheiro:linha. |
| [04 · Erros](04-erros.md) | Envelope, códigos, particularidades. |
| [05 · Base de dados e Supabase](05-base-de-dados-supabase.md) | 49 modelos, 36 enums, diagrama ER, 53 migrações, Storage S3, campos sensíveis, transacções, jobs. |
| [06 · Integrações externas](06-integracoes-externas.md) | AGT/SAF-T, Brevo, Supabase, RabbitMQ/ERP, gateways, IA, Sentry, Socket.IO. |
| [07 · Segurança](07-seguranca.md) | 32 achados (1 crítica, 2 altas, 9 médias, 13 baixas, 7 informativos), amostra de isolamento por empresa, `npm audit`, controlos positivos. |
| [08 · Funcionalidades incompletas](08-funcionalidades-incompletas.md) | O que existe no código mas não funciona de ponta a ponta. |
| [09 · Fluxos de negócio](09-fluxos-de-negocio.md) | Onboarding, PO, contratos, facturação AGT, cotações, subscrições, ERP, suporte. |
| [10 · Frontend, Java e integration-service](10-frontend-java-e-integration-service.md) | Cliente HTTP do SPA, páginas por persona, paridade do `backend-java/`, API do microserviço. |
| [`grupos/`](grupos/) | Notas detalhadas e tabelas de achados de cada grupo de endpoints (A–G). |

## O que existe (resumo)

| | |
|---|---|
| Operações HTTP | **247** em 215 caminhos (GET 119, POST 77, PATCH 27, DELETE 13, PUT 11) e 42 áreas funcionais |
| Sem sessão | 21 (login/2FA/recuperação, registo e convites, planos/estatísticas/avaliações públicas, candidaturas de Supplier Development, webhook de pagamento, callback ERP, `/health`, `/ready`, `/api/retencao`) |
| Chave de API | 3 (`/api/v1/catalogo*`) |
| Código | 34 ficheiros de rotas, 8 controllers, 71 services, 6 jobs agendados |
| Base de dados | PostgreSQL no Supabase via Prisma; Storage S3 em produção; **sem** Supabase Auth nem RLS |
| Tempo real | Socket.IO (`/socket.io`) no Node; STOMP no Java |
| Integrações | AGT (parcial), Brevo (completa), RabbitMQ + `kixima-integration-service` (parcial), gateways de pagamento (por ligar), Anthropic (opcional), Sentry (parcial) |

Grupos (número de operações): A Autenticação e público 34 · B Empresas 45 · C Administração e relatórios 33 · D Catálogo e mercado 47 · E Ordens de compra, pagamento e fiscal 36 · F Subscrições 20 · G Suporte e conversas 32.

## Achados mais importantes

| # | Sev. | Achado | Onde |
|---|---|---|---|
| 1 | **Crítica** | **A 2FA e a recuperação de senha são contornáveis.** `authenticate` não verifica o tipo do token; o *desafio 2FA* (emitido só com a senha) e o token do link de recuperação valem como sessão completa. Confirmado por leitura e por prova de conceito local. | [07](07-seguranca.md) SEG-01 |
| 2 | Alta | **Conciliação bancária sem isolamento por empresa:** o papel `FINANCEIRO` de qualquer empresa pode forjar linhas de extracto e marcar faturas como `PAGA`, com recibo fiscal enviado à AGT. | SEG-02; [grupos/E](grupos/E-ordens-pagamento-fiscal.md) A1 |
| 3 | Alta | **Documentos privados no bucket público** (certidões, alvarás, apólices, comprovativos, anexos de chat), com chaves previsíveis. Código confirmado; a política real do bucket **não confirmada**. | SEG-03; [05](05-base-de-dados-supabase.md) F1 |
| 4 | Alta | **Sem RLS** em nenhuma das 49 tabelas: se a Data API do Supabase estiver activa, ficam expostas à chave anónima (não confirmado). | [05](05-base-de-dados-supabase.md) F2 |
| 5 | Alta | **Seeds com senhas fixas** (incl. um `ADMIN_SISTEMA`); um deles corre no arranque do Docker quando `CATALOG_COMPANY=1`. | [05](05-base-de-dados-supabase.md) F3/F4 |
| 6 | Alta | **Prazo de 7 dias não aplicado**; PO fica `AGUARDANDO_PAGAMENTO` indefinidamente; conciliação não avança a PO nem cobra a taxa. | [08](08-funcionalidades-incompletas.md) #1, #6 |
| 7 | Alta | **AGT/SAF-T:** programa não certificado, sem prova de aceitação, documentos enviados em duplicado, SAF-T não conforme (sem XSD, sem produtos/impostos/recibos). | [06](06-integracoes-externas.md) §1 |
| 8 | Alta | **Fuga de credenciais na falha do backup:** a mensagem de erro do `pg_dump` inclui a URL da BD e segue na resposta 502, na auditoria, no email de alerta e nos logs. | [grupos/C](grupos/C-admin-e-relatorios.md) |
| 9 | Alta | **Listas truncadas a 1000 linhas sem aviso** (KPIs financeiros, relatório de conteúdo local, utilizadores). | [grupos/C](grupos/C-admin-e-relatorios.md); [05](05-base-de-dados-supabase.md) F19 |
| 10 | Alta | **Tempo real do Java inutilizável** com o frontend actual (STOMP vs Socket.IO). | [10](10-frontend-java-e-integration-service.md) B1 |
| 11 | Alta | **Multicaixa/EMIS nunca inicia pagamento** (USD vs AOA); webhook de pagamento sem assinatura e sem comparar montante. | [grupos/F](grupos/F-subscricoes.md); SEG-12 |
| 12 | Média | `PATCH /api/notifications/:id/read` sem filtro por `userId` (IDOR); Admin do Sistema lista notificações pessoais de todos. | SEG-13; [grupos/A](grupos/A-auth-e-publico.md) |
| 13 | Média | Dependências: `npm audit` com 11 vulnerabilidades (1 crítica, 6 altas); `xlsx` sem correcção publicada. | SEG-07 |
| 14 | Média | Rotas admin sem validação de corpo: `PATCH /admin/users/:id/status` (`"false"` activa) e `PATCH …/areas` (não-array promove a Super Admin). | [grupos/C](grupos/C-admin-e-relatorios.md) |
| 15 | Média | Importação Excel publica produtos com **preço inventado** por categoria quando falta o preço. | [grupos/D](grupos/D-catalogo-e-mercado.md) |

**Pontos fortes verificados:** segredo JWT forte obrigatório em produção, revogação por `tokenVersion`, cookie `httpOnly`/`Secure`/`SameSite=Lax`, CORS em lista, bloqueio de contas, política de senhas por perfil, validação Zod com remoção de campos desconhecidos, SQL parametrizado, sem SSRF com URL de utilizador, verificação de assinatura de ficheiros, segredos ERP cifrados (AES-256-GCM) e mascarados nas respostas, numeração fiscal serializada com `FOR UPDATE`, isolamento por empresa correcto em 26 de 28 rotas amostradas, e **nenhuma credencial real encontrada** nos ficheiros versionados nem no histórico (pesquisa por padrões). Há, porém, dados pessoais e identificadores em ficheiros versionados — emails reais em seeds e `.env.example` e o identificador do projecto Supabase ([05](05-base-de-dados-supabase.md) F27) — que convém rever.

## Como usar o `openapi.yaml`

```bash
# Visualizar
npx @redocly/cli preview-docs docs/api/openapi.yaml        # ou
npx swagger-ui-watcher docs/api/openapi.yaml
# Validar
pip install openapi-spec-validator && openapi-spec-validator docs/api/openapi.yaml
```

- Autenticação nos exemplos: `curl -c jar.txt -X POST …/api/auth/login -H 'Content-Type: application/json' -d '{"email":"…","password":"…"}'` e depois `-b jar.txt`; ou `-H 'Authorization: Bearer <token>'`. Os exemplos do ficheiro usam apenas dados fictícios.
- Extensões próprias: `x-permissoes` (papéis, áreas, restrições de posse verificadas no service), `x-limitador`, `x-exemplo`.
- Os `Decimal` do Prisma chegam como **string**.
- O ficheiro foi gerado a partir de fragmentos por grupo; se as rotas mudarem, a fonte de verdade continua a ser o código (`backend/src/routes/`).

## Limites desta análise

- **Estática:** nada foi executado contra uma base de dados real; os 500 «prováveis» (parâmetros inválidos, *overflow* de `Decimal`) são inferidos do `errorHandler`.
- **Fora do âmbito de verificação:** painel do Render (variáveis `APP_URL`, `MFA_ENFORCE_FROM`, `LAUNCH_BYPASS_KEY`), política do bucket, Data API do Supabase, credenciais AGT, diferenças reais entre produção e repositório.
- O `backend-java/` e o `kixima-integration-service/` foram descritos e comparados (secção A e B de [10](10-frontend-java-e-integration-service.md)) mas **não** auditados em profundidade.
- Nenhuma das falhas listadas foi corrigida: esta tarefa é apenas documentação.
