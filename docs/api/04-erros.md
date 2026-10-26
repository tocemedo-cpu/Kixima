# 04 · Erros da API

> Fontes: `backend/src/utils/errors.js`, `middleware/errorHandler.js`, `utils/validate.js`, `middleware/rateLimit.js`. Análise estática; os 500 «prováveis» indicados em cada operação do `openapi.yaml` são inferidos da leitura do código, não de execuções.

## 1. Envelope único

Todas as respostas de erro têm o mesmo formato:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dados inválidos.", "details": { "fieldErrors": { "quantity": ["Number must be greater than or equal to 1"] } } } }
```

`details` só aparece quando existe (422 do Zod, 502 da AGT). Em `NODE_ENV=development` os 500 incluem também `stack` (SEG-22).

## 2. Códigos

| HTTP | `code` | Origem | Quando acontece (exemplos reais) |
|---|---|---|---|
| 400 | `BUSINESS_RULE_VIOLATION` | `BusinessRuleError` | Regra de negócio: documentos obrigatórios em falta no registo, PO com o próprio fornecedor, despachar fora de estado, etc. |
| 400 | `PLANO_INSUFICIENTE` | `PlanRequiredError` (`planService`, `companyService`) | A funcionalidade exige um plano superior ao da empresa. `details.planoNecessario` indica qual (a interface usa-o para mostrar o botão de upgrade) |
| 400 | `LIMIT_FILE_COUNT`, `LIMIT_UNEXPECTED_FILE` | Multer | Ficheiros a mais / campo de ficheiro inesperado |
| 401 | `UNAUTHORIZED` | `UnauthorizedError` | Sem cookie/Bearer, token inválido ou expirado, utilizador inactivo, `tokenVersion` revogada, credenciais erradas |
| 403 | `FORBIDDEN` | `ForbiddenError` | Papel ou área insuficiente (`requireRole`/`requirePermission`/`requireSuperAdmin`), sessão restrita por 2FA, acesso a recurso de outra empresa (alguns services) |
| 404 | `NOT_FOUND` | `NotFoundError`; Prisma `P2025` | Recurso inexistente ou de outra empresa |
| 404 | `ROUTE_NOT_FOUND` | `notFoundHandler` | `Rota GET /api/xyz não existe.` |
| 409 | `CONFLICT` | `ConflictError` | Transição de estado inválida (ex.: aprovar uma PO que já não está `AGUARDANDO_APROVACAO`), NIF/email já registado |
| 409 | `UNIQUE_CONSTRAINT` | Prisma `P2002` | Violação de unicidade não tratada antes («Já existe um registo com estes dados.») |
| 413 | `LIMIT_FILE_SIZE` | Multer | Ficheiro acima do limite de `config/upload.js` |
| 422 | `VALIDATION_ERROR` | `validate(zod)` | Corpo/query/params inválidos; `details` = `error.flatten()` |
| 429 | `RATE_LIMITED` | `express-rate-limit` | Ver [02](02-autenticacao-e-permissoes.md), secção 5. Cabeçalhos `RateLimit-*` (draft-7) |
| 500 | `INTERNAL_ERROR` | `errorHandler` (qualquer outra excepção) | Mensagem genérica «Ocorreu um erro interno…»; registado no log e enviado ao Sentry |
| 502 | `AGT_RECUSOU` | `AgtRecusadoError` | A AGT respondeu com recusa (`resultCode ≠ 0`). `details` traz o `errorList` da AGT, e pode trazer o pedido assinado enviado e a resposta bruta (úteis para diagnóstico) |
| 503 | `SERVICO_INDISPONIVEL` | `ServiceUnavailableError` | Integração não configurada («recusa-se a fingir»): sem chave AGT, gateway de pagamento sem credenciais, etc. |

## 3. Particularidades a conhecer

1. **Validação feita à mão devolve 500.** Os parâmetros sem esquema Zod (por exemplo `status`, `type`, `page` em listagens de catálogo, `q` não-string, `meses` enorme) acabam em excepção não tratada e saem como `500 INTERNAL_ERROR`, quando deviam ser `422`. Está assinalado nas notas de cada grupo ([grupos/](grupos/)).
2. **JSON malformado** no corpo não é tratado de forma específica: pela leitura de `errorHandler.js` cai no ramo genérico (`500 INTERNAL_ERROR`), não em 400/422. *Não confirmado por execução.*
3. **Erros dos adaptadores de pagamento** (`multicaixaService`, `paypayService`, `bancoGatewayService`) saem como 500 genérico em vez de 503/400 ([grupos/F](grupos/F-subscricoes.md)); o canal EMIS falha sempre para subscrições (moeda USD vs AOA).
4. **Mensagens que distinguem estados** (login com «conta inactiva» / «empresa ainda não aprovada» antes de validar a senha; registo com 409 distinto para NIF e email) permitem enumerar contas (SEG-08).
5. **`POST /api/integration/callback`** devolve `err.message` interno quando o evento falha (SEG-24).
6. **`GET /ready`** devolve o detalhe do erro da base de dados a anónimos (SEG-15).
7. Os erros de transição de estado da PO usam `409 CONFLICT`, excepto *dispatch* fora de estado, que usa `400 BUSINESS_RULE_VIOLATION` ([09](09-fluxos-de-negocio.md)).
8. A truncagem a 1000 linhas das listagens sem `take` **não gera erro**, só um registo no log ([05](05-base-de-dados-supabase.md)).

## 4. Respostas reutilizáveis no `openapi.yaml`

`components.responses`: `NaoAutenticado` (401), `SemPermissao` (403), `NaoEncontrado` (404), `DadosInvalidos` (422), `RegraNegocio` (400), `Conflito` (409), `LimiteExcedido` (429), `ServicoIndisponivel` (503), `ErroInterno` (500). Cada operação lista apenas os erros que o código dela pode realmente produzir, e as específicas trazem um exemplo com a mensagem real.
