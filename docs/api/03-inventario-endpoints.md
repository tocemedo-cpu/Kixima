# 03 · Inventário completo de endpoints

Total: **247 operações HTTP** em 215 caminhos, agrupadas em 42 áreas funcionais. Os dados são extraídos do [`openapi.yaml`](openapi.yaml) (que contém parâmetros, corpos, respostas e exemplos) e da análise estática dos routers em `backend/src/routes/` (coluna *Código*: ficheiro:linha onde a rota é registada).

Por método: GET 119, POST 77, PUT 11, PATCH 27, DELETE 13. Operações **sem autenticação** (públicas por desenho ou por serem webhooks/health): **21**.

> Convenções: todos os caminhos começam por `/api` excepto `/health`, `/ready` e o `/api/uploads` estático. *Autenticação*: `sessão` = cookie `kixima_sessao` ou `Authorization: Bearer`. *Papéis* vêm do `requireRole`; *áreas* do `requirePermission` (só filtram `ADMIN_SISTEMA`; lista de áreas vazia = Super Admin). Muitas regras de **posse por empresa** são feitas dentro dos services e estão descritas, operação a operação, no `openapi.yaml`.

## Endpoints públicos (sem sessão)

| Método | Caminho | Resumo | Limitador | Código |
|---|---|---|---|---|
| GET | `/api/admin/invite/{token}` | Resolve um convite de assessor (público) | sensitiveLimiter | `backend/src/routes/adminRoutes.js:30` |
| POST | `/api/admin/invite/{token}/accept` | Aceita um convite de assessor e cria a conta de Admin do Sistema (público) | sensitiveLimiter | `backend/src/routes/adminRoutes.js:34` |
| POST | `/api/auth/2fa/reenviar` | Reenviar o código por email (ecrã de login, sem sessão) | apiLimiter | `backend/src/routes/authRoutes.js:21` |
| POST | `/api/auth/2fa/verify` | Iniciar sessão (2.º passo): desafio + código | authLimiter | `backend/src/routes/authRoutes.js:18` |
| POST | `/api/auth/forgot-password` | Pedir link de recuperação de senha | forgotPasswordLimiter | `backend/src/routes/authRoutes.js:15` |
| POST | `/api/auth/login` | Iniciar sessão (1.º passo) | authLimiter | `backend/src/routes/authRoutes.js:12` |
| POST | `/api/auth/reset-password` | Definir nova senha com o token de recuperação | authLimiter | `backend/src/routes/authRoutes.js:16` |
| GET | `/api/companies/invite/{token}` | Resolve um convite de utilizador a partir do token (público) | sensitiveLimiter | `backend/src/routes/companyRoutes.js:37` |
| POST | `/api/companies/invite/{token}/accept` | Aceita um convite e cria a conta do convidado (público) | sensitiveLimiter | `backend/src/routes/companyRoutes.js:38` |
| POST | `/api/companies/register` | Cadastro público de empresa (onboarding) com documentos | sensitiveLimiter | `backend/src/routes/companyRoutes.js:33` |
| POST | `/api/integration/callback` | Callback assinado (HMAC) do microserviço de integração ERP | — | `backend/src/routes/integrationRoutes.js:26` |
| GET | `/api/planos` | Tabela pública de planos, preços e taxas por transacção | apiLimiter | `backend/src/routes/planosRoutes.js:13` |
| GET | `/api/public/feedback` | Parede pública de avaliações aprovadas | apiLimiter | `backend/src/routes/publicRoutes.js:20` |
| GET | `/api/public/stats` | Estatísticas agregadas da plataforma (homepage) | apiLimiter | `backend/src/routes/publicRoutes.js:12` |
| GET | `/api/retencao` | Política de retenção de dados (pública) | apiLimiter | `backend/src/app.js:194` |
| GET | `/api/supplier-development/fee` | Taxa de acesso ao programa Supplier Development (público) | — | `backend/src/routes/supplierDevRoutes.js:27` |
| POST | `/api/supplier-development/requests` | Submete uma candidatura pública ao programa (sem conta) | publicLimiter | `backend/src/routes/supplierDevRoutes.js:32` |
| GET | `/api/supplier-development/requests/{reference}/track` | Acompanha o estado de uma candidatura pela referência (público) | — | `backend/src/routes/supplierDevRoutes.js:37` |
| POST | `/api/webhooks/pagamento/{canal}` | Callback de um gateway de pagamento automático (subscrições) | apiLimiter | `backend/src/routes/webhookPagamentoRoutes.js:15` |
| GET | `/health` | Liveness: o processo está de pé | — | `backend/src/app.js:115` |
| GET | `/ready` | Readiness: a base de dados responde | — | `backend/src/app.js:120` |

## Todos os endpoints por área

### API pública de catálogo (v1)

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/catalogo` | chave de API | empresa dona da chave | — | limitador por chave | Lista o catálogo da empresa dona da chave (paginado) | `backend/src/routes/apiCatalogoRoutes.js:99` |
| GET | `/api/v1/catalogo/{sku}` | chave de API | empresa dona da chave | — | limitador por chave | Obtém um item pelo SKU (da empresa dona da chave) | `backend/src/routes/apiCatalogoRoutes.js:117` |
| PATCH | `/api/v1/catalogo/{sku}` | chave de API | empresa dona da chave | — | limitador por chave | Actualiza preço, stock e disponibilidade de um item por SKU | `backend/src/routes/apiCatalogoRoutes.js:127` |

### Add-ons

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/addons/catalogo` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Catálogo de add-ons pagos disponíveis | `backend/src/routes/addonRoutes.js:17` |
| GET | `/api/addons/fila` | sessão | ADMIN_SISTEMA | financeiro | apiLimiter | Fila da KIXIMA - cobranças de add-on em aberto | `backend/src/routes/addonRoutes.js:22` |
| GET | `/api/addons/{addonKey}/estado` | sessão | COMPANY_ADMIN, FINANCEIRO, COMPRADOR | — | apiLimiter | Estado de um add-on para a empresa (activo, validade, cobrança em aberto) | `backend/src/routes/addonRoutes.js:31` |
| POST | `/api/addons/{addonKey}/pedir` | sessão | COMPANY_ADMIN | — | apiLimiter | Pedir um add-on (emite a cobrança; não activa nada) | `backend/src/routes/addonRoutes.js:35` |
| POST | `/api/addons/{id}/cancelar` | sessão | COMPANY_ADMIN, ADMIN_SISTEMA | financeiro | apiLimiter | Cancelar uma cobrança de add-on em aberto | `backend/src/routes/addonRoutes.js:52` |
| POST | `/api/addons/{id}/comprovativo` | sessão | COMPANY_ADMIN, FINANCEIRO | — | apiLimiter | Carregar o comprovativo da transferência de uma cobrança de add-on | `backend/src/routes/addonRoutes.js:40` |
| POST | `/api/addons/{id}/confirmar` | sessão | ADMIN_SISTEMA | financeiro | apiLimiter | A KIXIMA confirma o pagamento de um add-on e activa-o | `backend/src/routes/addonRoutes.js:26` |

### Administração

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/admin/activities` | sessão | ADMIN_SISTEMA | operacoes | apiLimiter | Feed de actividades de todo o sistema (área Operações) | `backend/src/routes/adminRoutes.js:135` |
| GET | `/api/admin/audit-logs` | sessão | ADMIN_SISTEMA | — | apiLimiter | Consulta o trilho de auditoria (qualquer Admin do Sistema) | `backend/src/routes/adminRoutes.js:153` |
| POST | `/api/admin/backup` | sessão | ADMIN_SISTEMA | operacoes | apiLimiter | Faz uma cópia de segurança da base de dados agora (área Operações) | `backend/src/routes/adminRoutes.js:172` |
| POST | `/api/admin/backup/verificar` | sessão | ADMIN_SISTEMA | operacoes | apiLimiter | Verifica que a última cópia de segurança ainda se lê (área Operações) | `backend/src/routes/adminRoutes.js:205` |
| POST | `/api/admin/email-teste` | sessão | ADMIN_SISTEMA | operacoes | apiLimiter | Envia um email de teste ao próprio administrador (área Operações) | `backend/src/routes/adminRoutes.js:227` |
| GET | `/api/admin/feedback` | sessão | ADMIN_SISTEMA | suporte | apiLimiter | Fila de moderação das avaliações públicas (área Suporte) | `backend/src/routes/adminRoutes.js:263` |
| DELETE | `/api/admin/feedback/{id}` | sessão | ADMIN_SISTEMA | suporte | apiLimiter | Remove (rejeita) uma avaliação (área Suporte) | `backend/src/routes/adminRoutes.js:280` |
| PATCH | `/api/admin/feedback/{id}/aprovar` | sessão | ADMIN_SISTEMA | suporte | apiLimiter | Aprova uma avaliação para a homepage (área Suporte) | `backend/src/routes/adminRoutes.js:267` |
| GET | `/api/admin/invite/{token}` | **pública** | — | — | sensitiveLimiter | Resolve um convite de assessor (público) | `backend/src/routes/adminRoutes.js:30` |
| POST | `/api/admin/invite/{token}/accept` | **pública** | — | — | sensitiveLimiter | Aceita um convite de assessor e cria a conta de Admin do Sistema (público) | `backend/src/routes/adminRoutes.js:34` |
| GET | `/api/admin/invites` | sessão | ADMIN_SISTEMA | — | apiLimiter | Lista os convites de assessor (só Super Admin) | `backend/src/routes/adminRoutes.js:96` |
| POST | `/api/admin/invites` | sessão | ADMIN_SISTEMA | — | apiLimiter | Convida um novo assessor administrativo (só Super Admin) | `backend/src/routes/adminRoutes.js:98` |
| POST | `/api/admin/invites/{id}/cancel` | sessão | ADMIN_SISTEMA | — | apiLimiter | Cancela um convite de assessor (só Super Admin) | `backend/src/routes/adminRoutes.js:123` |
| POST | `/api/admin/invites/{id}/resend` | sessão | ADMIN_SISTEMA | — | apiLimiter | Reenvia um convite de assessor com token novo (só Super Admin) | `backend/src/routes/adminRoutes.js:111` |
| POST | `/api/admin/mfa-lembrete` | sessão | ADMIN_SISTEMA | operacoes | apiLimiter | Envia email a pedir a activação da 2FA (área Operações) | `backend/src/routes/adminRoutes.js:252` |
| GET | `/api/admin/mfa-pendentes` | sessão | ADMIN_SISTEMA | operacoes | apiLimiter | Lista contas com poder que ainda não activaram a 2FA (área Operações) | `backend/src/routes/adminRoutes.js:248` |
| GET | `/api/admin/platform-fees` | sessão | ADMIN_SISTEMA | financeiro | apiLimiter | Livro de taxas da plataforma KIXIMA (área Financeiro) | `backend/src/routes/adminRoutes.js:138` |
| PATCH | `/api/admin/platform-fees/{id}/charge` | sessão | ADMIN_SISTEMA | financeiro | apiLimiter | Marca uma taxa da plataforma como cobrada (área Financeiro) | `backend/src/routes/adminRoutes.js:139` |
| GET | `/api/admin/prontidao` | sessão | ADMIN_SISTEMA | operacoes | apiLimiter | Relatório de prontidão para produção (área Operações) | `backend/src/routes/adminRoutes.js:164` |
| GET | `/api/admin/users` | sessão | ADMIN_SISTEMA | — | apiLimiter | Lista todos os utilizadores do sistema (só Super Admin) | `backend/src/routes/adminRoutes.js:55` |
| PATCH | `/api/admin/users/{id}/areas` | sessão | ADMIN_SISTEMA | — | apiLimiter | Atribui áreas administrativas a um Admin do Sistema (só Super Admin) | `backend/src/routes/adminRoutes.js:74` |
| PATCH | `/api/admin/users/{id}/status` | sessão | ADMIN_SISTEMA | — | apiLimiter | Bloqueia ou desbloqueia um utilizador (só Super Admin) | `backend/src/routes/adminRoutes.js:57` |

### Apólices

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/policies/company` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | — | Lista as apólices da empresa do utilizador autenticado | `backend/src/routes/policyRoutes.js:32` |
| GET | `/api/policies/company/{companyId}` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | — | Lista as apólices de uma empresa (ficha da empresa) | `backend/src/routes/policyRoutes.js:32` |
| POST | `/api/policies/kixima-to-client/{companyId}` | sessão | ADMIN_SISTEMA | apolices | — | Emite uma apólice KIXIMA->Cliente para uma empresa | `backend/src/routes/policyRoutes.js:23` |
| POST | `/api/policies/supplier-to-kixima` | sessão | FORNECEDOR, COMPANY_ADMIN | — | — | Fornecedor submete uma apólice Fornecedor->KIXIMA | `backend/src/routes/policyRoutes.js:14` |
| PATCH | `/api/policies/supplier-to-kixima/{id}/decision` | sessão | ADMIN_SISTEMA | apolices | — | Aprova ou rejeita uma apólice Fornecedor->KIXIMA | `backend/src/routes/policyRoutes.js:20` |

### Autenticação

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| POST | `/api/auth/forgot-password` | **pública** | — | — | forgotPasswordLimiter | Pedir link de recuperação de senha | `backend/src/routes/authRoutes.js:15` |
| POST | `/api/auth/login` | **pública** | — | — | authLimiter | Iniciar sessão (1.º passo) | `backend/src/routes/authRoutes.js:12` |
| POST | `/api/auth/logout` | sessão | qualquer autenticado | — | apiLimiter | Terminar sessão em todos os dispositivos | `backend/src/routes/authRoutes.js:24` |
| GET | `/api/auth/me` | sessão | qualquer autenticado | — | apiLimiter | Sessão actual (req.user) | `backend/src/routes/authRoutes.js:22` |
| PATCH | `/api/auth/password` | sessão | qualquer autenticado | — | apiLimiter | Alterar a própria senha | `backend/src/routes/authRoutes.js:23` |
| POST | `/api/auth/reset-password` | **pública** | — | — | authLimiter | Definir nova senha com o token de recuperação | `backend/src/routes/authRoutes.js:16` |

### Autenticação 2FA

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| POST | `/api/auth/2fa/disable` | sessão | qualquer autenticado | — | apiLimiter | Desactivar a 2FA (exige um código válido) | `backend/src/routes/authRoutes.js:33` |
| POST | `/api/auth/2fa/email/enviar` | sessão | qualquer autenticado | — | apiLimiter | Pedir o código de activação da 2FA por email | `backend/src/routes/authRoutes.js:28` |
| POST | `/api/auth/2fa/email/reenviar` | sessão | qualquer autenticado | — | apiLimiter | Reenviar o código por email (já com sessão) | `backend/src/routes/authRoutes.js:29` |
| POST | `/api/auth/2fa/enable` | sessão | qualquer autenticado | — | apiLimiter | Confirmar o código e activar a 2FA | `backend/src/routes/authRoutes.js:32` |
| POST | `/api/auth/2fa/reenviar` | **pública** | — | — | apiLimiter | Reenviar o código por email (ecrã de login, sem sessão) | `backend/src/routes/authRoutes.js:21` |
| POST | `/api/auth/2fa/setup` | sessão | qualquer autenticado | — | apiLimiter | Gerar segredo TOTP (app de autenticação) | `backend/src/routes/authRoutes.js:31` |
| GET | `/api/auth/2fa/status` | sessão | qualquer autenticado | — | — | Estado da verificação em dois passos | `backend/src/routes/authRoutes.js:26` |
| POST | `/api/auth/2fa/verify` | **pública** | — | — | authLimiter | Iniciar sessão (2.º passo): desafio + código | `backend/src/routes/authRoutes.js:18` |

### Avaliações

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| POST | `/api/feedback` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | feedbackLimiter | Enviar uma avaliação (nunca anónima) | `backend/src/routes/feedbackRoutes.js:29` |
| GET | `/api/feedback/minhas` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | As avaliações que o utilizador enviou (qualquer estado) | `backend/src/routes/feedbackRoutes.js:25` |
| GET | `/api/feedback/opcoes` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Opções reais para o dropdown «sobre o que é a avaliação» | `backend/src/routes/feedbackRoutes.js:21` |

### Category Management

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/category-management/admin/thresholds` | sessão | ADMIN_SISTEMA | financeiro | apiLimiter | Lista os patamares de desconto por economia de escala (área Financeiro) | `backend/src/routes/categoryManagementRoutes.js:78` |
| POST | `/api/category-management/admin/thresholds` | sessão | ADMIN_SISTEMA | financeiro | apiLimiter | Cria um patamar de desconto (área Financeiro) | `backend/src/routes/categoryManagementRoutes.js:82` |
| PUT | `/api/category-management/admin/thresholds/{id}` | sessão | ADMIN_SISTEMA | financeiro | apiLimiter | Actualiza (parcialmente) um patamar de desconto (área Financeiro) | `backend/src/routes/categoryManagementRoutes.js:87` |
| DELETE | `/api/category-management/admin/thresholds/{id}` | sessão | ADMIN_SISTEMA | financeiro | apiLimiter | Remove um patamar de desconto (área Financeiro) | `backend/src/routes/categoryManagementRoutes.js:91` |
| GET | `/api/category-management/analise` | sessão | COMPANY_ADMIN, COMPRADOR, FINANCEIRO | — | apiLimiter | Análise de compras por categoria e economia de escala (plano PRO) | `backend/src/routes/categoryManagementRoutes.js:22` |
| GET | `/api/category-management/produtos/{productId}/media-mensal` | sessão | COMPANY_ADMIN, COMPRADOR, FINANCEIRO | — | apiLimiter | Média mensal de compra de um produto (plano PRO) | `backend/src/routes/categoryManagementRoutes.js:61` |

### Catálogo

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/catalog` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Lista o catálogo activo (todos os fornecedores) | `backend/src/routes/catalogRoutes.js:41` |
| POST | `/api/catalog` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Publica um produto/serviço (com imagens e documentos) | `backend/src/routes/catalogRoutes.js:89` |
| GET | `/api/catalog/documents` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Lista os documentos do fornecedor (técnicos e da empresa) | `backend/src/routes/catalogRoutes.js:45` |
| POST | `/api/catalog/import` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Importa catálogo em massa a partir de Excel (.xlsx) | `backend/src/routes/catalogRoutes.js:43` |
| GET | `/api/catalog/slug/{slug}` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Obtém um produto pelo slug | `backend/src/routes/catalogRoutes.js:85` |
| GET | `/api/catalog/{id}` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Obtém um produto pelo ID | `backend/src/routes/catalogRoutes.js:86` |
| PUT | `/api/catalog/{id}` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Actualiza os campos de um produto | `backend/src/routes/catalogRoutes.js:90` |
| DELETE | `/api/catalog/{id}` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Desactiva (remoção lógica) um produto | `backend/src/routes/catalogRoutes.js:97` |
| DELETE | `/api/catalog/{id}/documents/{docId}` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Remove um documento técnico do produto | `backend/src/routes/catalogRoutes.js:96` |
| POST | `/api/catalog/{id}/image` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Substitui a imagem principal de um produto | `backend/src/routes/catalogRoutes.js:92` |
| DELETE | `/api/catalog/{id}/images/{imageId}` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Remove uma imagem da galeria | `backend/src/routes/catalogRoutes.js:95` |
| POST | `/api/catalog/{id}/media` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Acrescenta galeria e documentos a um produto publicado | `backend/src/routes/catalogRoutes.js:94` |
| GET | `/api/catalog/{id}/reviews` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Lista avaliações de um produto | `backend/src/routes/catalogRoutes.js:87` |
| POST | `/api/catalog/{id}/reviews` | sessão | COMPRADOR | — | apiLimiter | Avalia (ou reavalia) um produto | `backend/src/routes/catalogRoutes.js:88` |

### Catálogo - Chaves de API

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/catalog/api-keys` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Lista as chaves de API da empresa | `backend/src/routes/catalogRoutes.js:56` |
| POST | `/api/catalog/api-keys` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Cria uma chave de API do catálogo (mostrada uma só vez) | `backend/src/routes/catalogRoutes.js:60` |
| DELETE | `/api/catalog/api-keys/{id}` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Revoga uma chave de API | `backend/src/routes/catalogRoutes.js:74` |

### Catálogo - Inventário

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/catalog/movements` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Lista movimentos de inventário (paginado) | `backend/src/routes/catalogRoutes.js:47` |
| POST | `/api/catalog/movements` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Regista entrada/saída de stock | `backend/src/routes/catalogRoutes.js:48` |
| PATCH | `/api/catalog/{id}/stock` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Define os campos de inventário de um produto | `backend/src/routes/catalogRoutes.js:91` |

### Chat Comercial

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/conversations` | sessão | qualquer autenticado | — | — | Listar as conversas da minha empresa | `backend/src/routes/conversationRoutes.js:24` |
| POST | `/api/conversations` | sessão | qualquer autenticado | — | — | Iniciar (ou reaproveitar) uma conversa com outra empresa | `backend/src/routes/conversationRoutes.js:28` |
| GET | `/api/conversations/unread-count` | sessão | qualquer autenticado | — | — | Contar mensagens não lidas do Chat Comercial da minha empresa | `backend/src/routes/conversationRoutes.js:20` |
| GET | `/api/conversations/{id}` | sessão | qualquer autenticado | — | — | Obter uma conversa (só participantes) | `backend/src/routes/conversationRoutes.js:34` |
| GET | `/api/conversations/{id}/messages` | sessão | qualquer autenticado | — | — | Listar mensagens de uma conversa (só participantes) | `backend/src/routes/conversationRoutes.js:38` |
| POST | `/api/conversations/{id}/messages` | sessão | qualquer autenticado | — | chatMessageLimiter | Enviar mensagem (texto e/ou anexo) numa conversa; passa pela análise de risco | `backend/src/routes/conversationRoutes.js:42` |
| POST | `/api/conversations/{id}/read` | sessão | qualquer autenticado | — | — | Marcar como lidas as mensagens da contraparte | `backend/src/routes/conversationRoutes.js:58` |

### Chat Comercial (Trust & Safety)

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/conversations/admin/alerts` | sessão | ADMIN_SISTEMA | suporte | — | Listar alertas de risco do Chat Comercial (Suporte) | `backend/src/routes/conversationRoutes.js:69` |
| PATCH | `/api/conversations/admin/alerts/{id}` | sessão | ADMIN_SISTEMA | suporte | — | Reclassificar um alerta (em análise / falso positivo / resolvido) | `backend/src/routes/conversationRoutes.js:78` |
| GET | `/api/conversations/admin/conversations/{id}` | sessão | ADMIN_SISTEMA | suporte | — | Aceder a uma conversa sinalizada (histórico completo, com auditoria) | `backend/src/routes/conversationRoutes.js:74` |

### Company Admin

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/company-admin/activities` | sessão | COMPANY_ADMIN | — | — | Actividades recentes da empresa (derivadas das POs) | `backend/src/routes/companyAdminRoutes.js:23` |
| GET | `/api/company-admin/dashboard` | sessão | COMPANY_ADMIN | — | — | Dashboard do Company Admin (KPIs, volume de 6 meses, actividade recente) | `backend/src/routes/companyAdminRoutes.js:22` |
| GET | `/api/company-admin/organizacao` | sessão | COMPANY_ADMIN | — | — | Perfil da empresa ("Organização") do Company Admin | `backend/src/routes/companyAdminRoutes.js:18` |
| GET | `/api/company-admin/reports` | sessão | COMPANY_ADMIN | — | — | Séries e catálogo de relatórios da empresa | `backend/src/routes/companyAdminRoutes.js:24` |
| GET | `/api/company-admin/settings` | sessão | COMPANY_ADMIN | — | — | Obtém as configurações da empresa | `backend/src/routes/companyAdminRoutes.js:25` |
| PUT | `/api/company-admin/settings` | sessão | COMPANY_ADMIN | — | — | Guarda as configurações da empresa | `backend/src/routes/companyAdminRoutes.js:26` |

### Comprador

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/buyer/activities` | sessão | COMPRADOR, COMPANY_ADMIN | — | apiLimiter | Tarefas/actividades do comprador derivadas das ordens | `backend/src/routes/buyerRoutes.js:38` |
| GET | `/api/buyer/deliveries` | sessão | COMPRADOR, COMPANY_ADMIN | — | apiLimiter | Acompanhamento de entregas do comprador | `backend/src/routes/buyerRoutes.js:26` |
| GET | `/api/buyer/orders` | sessão | COMPRADOR, COMPANY_ADMIN | — | apiLimiter | Ordens de compra da empresa compradora (paginado, com KPIs) | `backend/src/routes/buyerRoutes.js:15` |
| GET | `/api/buyer/payments` | sessão | COMPRADOR, COMPANY_ADMIN | — | apiLimiter | Faturas/pagamentos das ordens do comprador (com KPIs) | `backend/src/routes/buyerRoutes.js:22` |
| GET | `/api/buyer/profile` | sessão | COMPRADOR, COMPANY_ADMIN | — | apiLimiter | Perfil do utilizador e resumo da empresa compradora | `backend/src/routes/buyerRoutes.js:42` |
| GET | `/api/buyer/receptions` | sessão | COMPRADOR, COMPANY_ADMIN | — | apiLimiter | Recepções (por item) das ordens do comprador | `backend/src/routes/buyerRoutes.js:30` |
| GET | `/api/buyer/suppliers` | sessão | COMPRADOR, COMPANY_ADMIN | — | apiLimiter | Fornecedores visíveis ao comprador | `backend/src/routes/buyerRoutes.js:34` |

### Conciliação bancária

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/conciliacao/canais` | sessão | FINANCEIRO, ADMIN_SISTEMA | financeiro | apiLimiter | Estado dos canais de pagamento | `backend/src/routes/conciliacaoRoutes.js:31` |
| POST | `/api/conciliacao/extrato` | sessão | FINANCEIRO, ADMIN_SISTEMA | financeiro | apiLimiter | Importar linhas do extracto bancário e conciliar automaticamente | `backend/src/routes/conciliacaoRoutes.js:14` |
| GET | `/api/conciliacao/por-resolver` | sessão | FINANCEIRO, ADMIN_SISTEMA | financeiro | apiLimiter | Linhas do extracto por resolver | `backend/src/routes/conciliacaoRoutes.js:21` |
| POST | `/api/conciliacao/{id}/conciliar` | sessão | FINANCEIRO, ADMIN_SISTEMA | financeiro | apiLimiter | Reprocessar uma linha depois de corrigir a referência | `backend/src/routes/conciliacaoRoutes.js:25` |

### Contratos-quadro

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/contracts` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Listar os contratos-quadro da minha empresa | `backend/src/routes/contractRoutes.js:14` |
| POST | `/api/contracts` | sessão | ADMIN_SISTEMA, COMPANY_ADMIN | cadastro | apiLimiter | Criar um contrato-quadro | `backend/src/routes/contractRoutes.js:13` |
| GET | `/api/contracts/{id}` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Obter um contrato-quadro e as suas call-offs | `backend/src/routes/contractRoutes.js:15` |
| POST | `/api/contracts/{id}/consolidate-billing` | sessão | ADMIN_SISTEMA, FINANCEIRO, COMPANY_ADMIN | financeiro | apiLimiter | Consolidar a faturação das call-offs de um contrato | `backend/src/routes/contractRoutes.js:16` |

### Convites

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/companies/invite/{token}` | **pública** | — | — | sensitiveLimiter | Resolve um convite de utilizador a partir do token (público) | `backend/src/routes/companyRoutes.js:37` |
| POST | `/api/companies/invite/{token}/accept` | **pública** | — | — | sensitiveLimiter | Aceita um convite e cria a conta do convidado (público) | `backend/src/routes/companyRoutes.js:38` |
| GET | `/api/companies/invites` | sessão | COMPANY_ADMIN | — | — | Lista os convites da própria empresa | `backend/src/routes/companyRoutes.js:45` |
| POST | `/api/companies/invites` | sessão | COMPANY_ADMIN | — | — | Convida um funcionário para a empresa (envia email com link) | `backend/src/routes/companyRoutes.js:46` |
| POST | `/api/companies/invites/{id}/cancel` | sessão | COMPANY_ADMIN | — | — | Cancela um convite pendente | `backend/src/routes/companyRoutes.js:48` |
| POST | `/api/companies/invites/{id}/resend` | sessão | COMPANY_ADMIN | — | — | Reenvia um convite (renova token e validade) | `backend/src/routes/companyRoutes.js:47` |

### Cotações (RFQ)

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/quotes` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Lista pedidos de cotação conforme o papel | `backend/src/routes/quoteRoutes.js:13` |
| POST | `/api/quotes` | sessão | COMPRADOR | — | apiLimiter | Cria um pedido de cotação (RFQ) a um fornecedor | `backend/src/routes/quoteRoutes.js:23` |
| PATCH | `/api/quotes/{id}/close` | sessão | COMPRADOR | — | apiLimiter | O comprador encerra o pedido de cotação | `backend/src/routes/quoteRoutes.js:33` |
| PATCH | `/api/quotes/{id}/respond` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | O fornecedor responde com preço e prazo | `backend/src/routes/quoteRoutes.js:28` |

### Dashboard

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/dashboard/comprador` | sessão | COMPRADOR | — | apiLimiter | Resumo do painel do Comprador | `backend/src/routes/dashboardRoutes.js:9` |

### Empresas

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/companies` | sessão | ADMIN_SISTEMA | cadastro | — | Lista empresas para a due diligence (Admin do Sistema) | `backend/src/routes/companyRoutes.js:56` |
| POST | `/api/companies/register` | **pública** | — | — | sensitiveLimiter | Cadastro público de empresa (onboarding) com documentos | `backend/src/routes/companyRoutes.js:33` |
| GET | `/api/companies/{id}` | sessão | COMPANY_ADMIN, ADMIN_SISTEMA | cadastro | — | Ficha completa da empresa (perfil / due diligence) | `backend/src/routes/companyRoutes.js:90` |
| GET | `/api/companies/{id}/bank-details` | sessão | FORNECEDOR, COMPANY_ADMIN, FINANCEIRO, ADMIN_SISTEMA | financeiro | — | Obtém os dados bancários da empresa | `backend/src/routes/companyRoutes.js:84` |
| PUT | `/api/companies/{id}/bank-details` | sessão | FORNECEDOR, COMPANY_ADMIN, ADMIN_SISTEMA | financeiro | — | Actualiza os dados bancários da empresa | `backend/src/routes/companyRoutes.js:85` |
| PUT | `/api/companies/{id}/budget-limit` | sessão | COMPANY_ADMIN, ADMIN_SISTEMA | cadastro | — | Define o limite de orçamento mensal da empresa | `backend/src/routes/companyRoutes.js:92` |
| PUT | `/api/companies/{id}/data-adesao` | sessão | ADMIN_SISTEMA | faturacao | — | Define a data de adesão da empresa à facturação electrónica | `backend/src/routes/companyRoutes.js:76` |
| PATCH | `/api/companies/{id}/decision` | sessão | ADMIN_SISTEMA | cadastro | — | Aprova ou rejeita o cadastro de uma empresa (due diligence) | `backend/src/routes/companyRoutes.js:91` |
| PUT | `/api/companies/{id}/plan` | sessão | ADMIN_SISTEMA | cadastro | — | Define dimensão, plano e preço por utilizador de uma empresa | `backend/src/routes/companyRoutes.js:67` |
| GET | `/api/companies/{id}/platform-fees` | sessão | FORNECEDOR, COMPANY_ADMIN, FINANCEIRO, ADMIN_SISTEMA | financeiro | — | Extracto da Taxa KIXIMA da empresa (o que deve e porquê) | `backend/src/routes/companyRoutes.js:81` |
| PUT | `/api/companies/{id}/serie-fiscal` | sessão | ADMIN_SISTEMA | faturacao | — | Define a série de facturação certificada da empresa (AGT) | `backend/src/routes/companyRoutes.js:72` |
| GET | `/api/companies/{id}/subscription` | sessão | COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | financeiro | — | Resumo de subscrição da empresa (plano, utilizadores activos, custo mensal) | `backend/src/routes/companyRoutes.js:77` |

### Faturação

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/faturacao/agt-estado/{invoiceId}` | sessão | FORNECEDOR, COMPANY_ADMIN, ADMIN_SISTEMA | faturacao | apiLimiter | Consultar à AGT o estado da última submissão do FT de uma fatura | `backend/src/routes/faturacaoRoutes.js:135` |
| GET | `/api/faturacao/agt-payload/{tipo}/{id}` | sessão | FORNECEDOR, COMPANY_ADMIN, ADMIN_SISTEMA | faturacao | apiLimiter | Gerar e assinar o payload AGT (e-Fatura) de uma FT, NC ou RC | `backend/src/routes/faturacaoRoutes.js:118` |
| GET | `/api/faturacao/agt-serie-payload` | sessão | ADMIN_SISTEMA | faturacao | apiLimiter | Pedir uma série de numeração à AGT (Solicitar Série) | `backend/src/routes/faturacaoRoutes.js:161` |
| GET | `/api/faturacao/agt-series-fe` | sessão | ADMIN_SISTEMA | faturacao | apiLimiter | Histórico dos pedidos de série aceites pela AGT | `backend/src/routes/faturacaoRoutes.js:198` |
| GET | `/api/faturacao/integridade` | sessão | ADMIN_SISTEMA | faturacao | apiLimiter | Verificar a cadeia de integridade de uma série de faturas | `backend/src/routes/faturacaoRoutes.js:77` |
| GET | `/api/faturacao/metricas` | sessão | ADMIN_SISTEMA | faturacao | apiLimiter | Métricas de negócio da plataforma | `backend/src/routes/faturacaoRoutes.js:203` |
| GET | `/api/faturacao/saft` | sessão | FORNECEDOR, COMPANY_ADMIN, ADMIN_SISTEMA | faturacao | apiLimiter | Descarregar o SAF-T (AO) de uma empresa fornecedora | `backend/src/routes/faturacaoRoutes.js:83` |
| GET | `/api/faturacao/saft/resumo` | sessão | FORNECEDOR, COMPANY_ADMIN, ADMIN_SISTEMA | faturacao | apiLimiter | Resumo JSON do SAF-T antes de descarregar | `backend/src/routes/faturacaoRoutes.js:102` |
| POST | `/api/payments/invoices/{invoiceId}/anular` | sessão | FORNECEDOR, COMPANY_ADMIN, ADMIN_SISTEMA | faturacao | apiLimiter | Anular uma fatura (nota de crédito pelo saldo total) | `backend/src/routes/paymentRoutes.js:39` |
| GET | `/api/payments/invoices/{invoiceId}/notas-credito` | sessão | FORNECEDOR, COMPANY_ADMIN, FINANCEIRO, COMPRADOR, ADMIN_SISTEMA | faturacao | apiLimiter | Listar as notas de crédito de uma fatura | `backend/src/routes/paymentRoutes.js:30` |
| POST | `/api/payments/invoices/{invoiceId}/notas-credito` | sessão | FORNECEDOR, COMPANY_ADMIN, ADMIN_SISTEMA | faturacao | apiLimiter | Emitir uma nota de crédito sobre uma fatura | `backend/src/routes/paymentRoutes.js:24` |

### Ficheiros

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/uploads/{filename}` | sessão | anónimo (só públicos), COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA (tudo) | — | nenhum | Descarrega um ficheiro carregado (modo de armazenamento local) | `backend/src/routes/uploadsRoutes.js:35` |

### Financeiro

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/financeiro/invoices` | sessão | FINANCEIRO, COMPANY_ADMIN | — | apiLimiter | Faturas pendentes da empresa compradora, com KPIs | `backend/src/routes/financeiroRoutes.js:14` |
| GET | `/api/financeiro/overview` | sessão | FINANCEIRO, COMPANY_ADMIN | — | apiLimiter | Centro Financeiro (KPIs, série de 6 meses, 5 faturas pendentes) | `backend/src/routes/financeiroRoutes.js:13` |
| GET | `/api/financeiro/payments` | sessão | FINANCEIRO, COMPANY_ADMIN | — | apiLimiter | Histórico de pagamentos/faturas da empresa compradora, filtrável por estado | `backend/src/routes/financeiroRoutes.js:15` |

### Infraestrutura

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/retencao` | **pública** | — | — | apiLimiter | Política de retenção de dados (pública) | `backend/src/app.js:194` |
| GET | `/health` | **pública** | — | — | — | Liveness: o processo está de pé | `backend/src/app.js:115` |
| GET | `/ready` | **pública** | — | — | — | Readiness: a base de dados responde | `backend/src/app.js:120` |

### Integração ERP

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/companies/{id}/erp-config` | sessão | ADMIN_SISTEMA | cadastro | — | Obtém a configuração ERP de uma empresa (segredos mascarados) | `backend/src/routes/companyRoutes.js:60` |
| PUT | `/api/companies/{id}/erp-config` | sessão | ADMIN_SISTEMA | cadastro | — | Define a configuração ERP de uma empresa (cifra e sincroniza com o microserviço) | `backend/src/routes/companyRoutes.js:61` |
| GET | `/api/companies/{id}/erp-config/audits` | sessão | ADMIN_SISTEMA | cadastro | — | Trilho de auditoria da configuração ERP (últimas 50 entradas) | `backend/src/routes/companyRoutes.js:63` |
| POST | `/api/companies/{id}/erp-config/test` | sessão | ADMIN_SISTEMA | cadastro | — | Testa a ligação ao ERP da empresa através do microserviço de integração | `backend/src/routes/companyRoutes.js:62` |
| POST | `/api/integration/callback` | **pública** | — | — | — | Callback assinado (HMAC) do microserviço de integração ERP | `backend/src/routes/integrationRoutes.js:26` |

### Kits

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/kits` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Lista os kits activos da empresa | `backend/src/routes/kitRoutes.js:13` |
| POST | `/api/kits` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Cria um kit (pacote de produtos) | `backend/src/routes/kitRoutes.js:17` |
| DELETE | `/api/kits/{id}` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Desactiva um kit | `backend/src/routes/kitRoutes.js:29` |

### Marketplace

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/marketplace/compare` | sessão | COMPRADOR | — | apiLimiter | Compara fornecedores que vendem o mesmo produto | `backend/src/routes/marketplaceRoutes.js:30` |
| GET | `/api/marketplace/facets` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Contagens (facetas) para os filtros de pesquisa | `backend/src/routes/marketplaceRoutes.js:36` |
| GET | `/api/marketplace/favorites` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Lista os IDs de produtos favoritos | `backend/src/routes/marketplaceRoutes.js:61` |
| POST | `/api/marketplace/favorites` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Adiciona um produto aos favoritos | `backend/src/routes/marketplaceRoutes.js:64` |
| DELETE | `/api/marketplace/favorites/{productId}` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Remove um produto dos favoritos | `backend/src/routes/marketplaceRoutes.js:69` |
| GET | `/api/marketplace/saved-searches` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Lista as pesquisas guardadas do utilizador | `backend/src/routes/marketplaceRoutes.js:46` |
| POST | `/api/marketplace/saved-searches` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Guarda uma pesquisa | `backend/src/routes/marketplaceRoutes.js:49` |
| DELETE | `/api/marketplace/saved-searches/{id}` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Remove uma pesquisa guardada | `backend/src/routes/marketplaceRoutes.js:55` |
| GET | `/api/marketplace/search` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Pesquisa paginada de produtos/serviços | `backend/src/routes/marketplaceRoutes.js:25` |
| GET | `/api/marketplace/suppliers` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Fornecedores verificados (home) | `backend/src/routes/marketplaceRoutes.js:40` |

### Notificações

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/notifications` | sessão | qualquer autenticado | — | apiLimiter | Listar notificações do utilizador/empresa (paginado) | `backend/src/routes/notificationRoutes.js:8` |
| PATCH | `/api/notifications/{id}/read` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Marcar uma notificação como lida | `backend/src/routes/notificationRoutes.js:9` |

### Ordens de compra

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/purchase-orders` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Listar as ordens de compra da minha empresa | `backend/src/routes/poRoutes.js:14` |
| POST | `/api/purchase-orders` | sessão | COMPRADOR, COMPANY_ADMIN | — | apiLimiter | Emitir uma ordem de compra (checkout) | `backend/src/routes/poRoutes.js:13` |
| GET | `/api/purchase-orders/{id}` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Obter uma ordem de compra com fatura, pagamento e empresas | `backend/src/routes/poRoutes.js:15` |
| PATCH | `/api/purchase-orders/{id}/accept` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Fornecedor aceita a PO (gera a fatura e inicia o prazo de 7 dias) | `backend/src/routes/poRoutes.js:25` |
| PATCH | `/api/purchase-orders/{id}/approve` | sessão | COMPANY_ADMIN | — | apiLimiter | Aprovar a PO (Company Admin da empresa compradora) | `backend/src/routes/poRoutes.js:21` |
| PATCH | `/api/purchase-orders/{id}/delivered` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Fornecedor marca a PO como entregue | `backend/src/routes/poRoutes.js:30` |
| PATCH | `/api/purchase-orders/{id}/dispatch` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Fornecedor despacha a entrega (só após pagamento) | `backend/src/routes/poRoutes.js:29` |
| GET | `/api/purchase-orders/{id}/history` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Linha do tempo auditável da PO | `backend/src/routes/poRoutes.js:18` |
| PATCH | `/api/purchase-orders/{id}/reception` | sessão | COMPRADOR, COMPANY_ADMIN | — | apiLimiter | Comprador confirma a recepção (conforme ou com divergência) | `backend/src/routes/poRoutes.js:33` |
| PATCH | `/api/purchase-orders/{id}/refuse` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Fornecedor recusa a PO | `backend/src/routes/poRoutes.js:26` |
| PATCH | `/api/purchase-orders/{id}/reject` | sessão | COMPANY_ADMIN | — | apiLimiter | Rejeitar a PO (Company Admin da empresa compradora) | `backend/src/routes/poRoutes.js:22` |
| PATCH | `/api/purchase-orders/{id}/resolve-divergence` | sessão | COMPRADOR, COMPANY_ADMIN | — | apiLimiter | Comprador resolve a divergência de recepção | `backend/src/routes/poRoutes.js:36` |

### PO Robot

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/po-robot/media-sugerida/{productId}` | sessão | COMPANY_ADMIN | — | apiLimiter | Média mensal de compra sugerida pela IA para um produto | `backend/src/routes/poRoboRoutes.js:34` |
| GET | `/api/po-robot/regras` | sessão | COMPANY_ADMIN | — | apiLimiter | Listar as regras do Automatic PO Robot da empresa | `backend/src/routes/poRoboRoutes.js:23` |
| POST | `/api/po-robot/regras` | sessão | COMPANY_ADMIN | — | apiLimiter | Criar uma regra do PO Robot | `backend/src/routes/poRoboRoutes.js:69` |
| PUT | `/api/po-robot/regras/{id}` | sessão | COMPANY_ADMIN | — | apiLimiter | Actualizar ou (des)activar uma regra do PO Robot | `backend/src/routes/poRoboRoutes.js:102` |
| DELETE | `/api/po-robot/regras/{id}` | sessão | COMPANY_ADMIN | — | apiLimiter | Remover uma regra do PO Robot | `backend/src/routes/poRoboRoutes.js:141` |

### Pagamentos

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/payments/history` | sessão | FINANCEIRO, COMPANY_ADMIN | — | apiLimiter | Histórico de pagamentos da minha empresa (compradora) | `backend/src/routes/paymentRoutes.js:49` |
| GET | `/api/payments/invoices/pending` | sessão | FINANCEIRO, COMPANY_ADMIN | — | apiLimiter | Faturas por pagar da minha empresa (compradora) | `backend/src/routes/paymentRoutes.js:48` |
| POST | `/api/payments/invoices/{invoiceId}/pay` | sessão | FINANCEIRO, COMPANY_ADMIN | — | apiLimiter | Pagar uma fatura com comprovativo obrigatório | `backend/src/routes/paymentRoutes.js:51` |
| PATCH | `/api/payments/{paymentId}/confirm-received` | sessão | FORNECEDOR, COMPANY_ADMIN, FINANCEIRO | — | apiLimiter | Fornecedor confirma que o valor entrou na conta | `backend/src/routes/paymentRoutes.js:14` |

### Público

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/planos` | **pública** | — | — | apiLimiter | Tabela pública de planos, preços e taxas por transacção | `backend/src/routes/planosRoutes.js:13` |
| GET | `/api/public/feedback` | **pública** | — | — | apiLimiter | Parede pública de avaliações aprovadas | `backend/src/routes/publicRoutes.js:20` |
| GET | `/api/public/stats` | **pública** | — | — | apiLimiter | Estatísticas agregadas da plataforma (homepage) | `backend/src/routes/publicRoutes.js:12` |

### Relatórios

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/reports/conteudo-local` | sessão | COMPANY_ADMIN, COMPRADOR, FINANCEIRO | — | apiLimiter | Relatório de conteúdo local da empresa compradora (plano PRO) | `backend/src/routes/reportsRoutes.js:26` |
| GET | `/api/reports/fornecedor` | sessão | FORNECEDOR, COMPANY_ADMIN | — | apiLimiter | Estatísticas do fornecedor (catálogo, ordens, receita, mais vendidos) | `backend/src/routes/reportsRoutes.js:16` |

### Subscrição

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/assinatura` | sessão | COMPANY_ADMIN | — | apiLimiter | Estado da subscrição da empresa (plano, validade, cobrança em aberto, escada de planos) | `backend/src/routes/assinaturaRoutes.js:34` |
| GET | `/api/assinatura/canais` | sessão | COMPANY_ADMIN | — | apiLimiter | Estado dos canais de pagamento automático (EMIS, PayPay, bancos) | `backend/src/routes/assinaturaRoutes.js:52` |
| GET | `/api/assinatura/fila` | sessão | ADMIN_SISTEMA | financeiro | apiLimiter | Fila de trabalho da KIXIMA - cobranças de plano em aberto e subscrições vencidas | `backend/src/routes/assinaturaRoutes.js:21` |
| POST | `/api/assinatura/pedir` | sessão | COMPANY_ADMIN | — | apiLimiter | Pedir (emitir a cobrança de) um plano - não muda o plano | `backend/src/routes/assinaturaRoutes.js:38` |
| POST | `/api/assinatura/{id}/cancelar` | sessão | COMPANY_ADMIN, ADMIN_SISTEMA | financeiro | apiLimiter | Cancelar uma cobrança de plano em aberto (empresa ou KIXIMA) | `backend/src/routes/assinaturaRoutes.js:80` |
| POST | `/api/assinatura/{id}/comprovativo` | sessão | COMPANY_ADMIN | — | apiLimiter | Carregar o comprovativo da transferência bancária de uma cobrança de plano | `backend/src/routes/assinaturaRoutes.js:67` |
| POST | `/api/assinatura/{id}/confirmar` | sessão | ADMIN_SISTEMA | financeiro | apiLimiter | A KIXIMA confirma o pagamento de uma subscrição e o plano muda | `backend/src/routes/assinaturaRoutes.js:25` |
| POST | `/api/assinatura/{id}/pagar-com` | sessão | COMPANY_ADMIN | — | apiLimiter | Iniciar o pagamento de uma cobrança num canal automático (EMIS, PayPay, banco) | `backend/src/routes/assinaturaRoutes.js:56` |

### Suporte

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| POST | `/api/support/categories/{key}/image` | sessão | ADMIN_SISTEMA | suporte | — | Carregar imagem de um local da Ajuda (rota legada/compatibilidade) | `backend/src/routes/supportRoutes.js:179` |
| POST | `/api/support/images/{key}` | sessão | ADMIN_SISTEMA | suporte | — | Carregar/substituir a imagem de um local da página de Ajuda (admin Suporte) | `backend/src/routes/supportRoutes.js:173` |
| DELETE | `/api/support/images/{key}` | sessão | ADMIN_SISTEMA | suporte | — | Remover o override de imagem de um local da Ajuda (volta à imagem por omissão) | `backend/src/routes/supportRoutes.js:174` |
| GET | `/api/support/overview` | sessão | qualquer autenticado | — | — | Conteúdo da página de Ajuda (FAQ, canais, imagens) e n.º de pedidos abertos do utilizador | `backend/src/routes/supportRoutes.js:136` |
| GET | `/api/support/tickets` | sessão | qualquer autenticado | — | — | Listar os últimos 20 pedidos de suporte do próprio utilizador | `backend/src/routes/supportRoutes.js:181` |
| POST | `/api/support/tickets` | sessão | qualquer autenticado | — | — | Abrir um pedido de suporte (ticket) | `backend/src/routes/supportRoutes.js:188` |

### Suporte (administração)

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/support/admin/agents` | sessão | ADMIN_SISTEMA | suporte | — | Listar assessores de Suporte activos (para "Transferir para…") | `backend/src/routes/supportRoutes.js:334` |
| GET | `/api/support/admin/my-tickets` | sessão | ADMIN_SISTEMA | suporte | — | Os meus atendimentos (EM_ANDAMENTO ou AGUARDANDO_RESPOSTA atribuídos a mim) | `backend/src/routes/supportRoutes.js:307` |
| GET | `/api/support/admin/overview` | sessão | ADMIN_SISTEMA | suporte | — | Painel de Suporte: KPIs de tickets, categorias e locais de imagem | `backend/src/routes/supportRoutes.js:209` |
| GET | `/api/support/admin/queue` | sessão | ADMIN_SISTEMA | suporte | — | Fila de atendimento: tickets ABERTOS sem responsável | `backend/src/routes/supportRoutes.js:303` |
| GET | `/api/support/admin/tickets` | sessão | ADMIN_SISTEMA | suporte | — | Listar pedidos de suporte de toda a plataforma (máx. 100, filtro por estado) | `backend/src/routes/supportRoutes.js:232` |
| POST | `/api/support/admin/tickets/{id}/assume` | sessão | ADMIN_SISTEMA | suporte | — | Assumir um ticket (atribui-o a mim) | `backend/src/routes/supportRoutes.js:311` |
| POST | `/api/support/admin/tickets/{id}/close` | sessão | ADMIN_SISTEMA | suporte | — | Fechar um ticket (deixa de aceitar mensagens) | `backend/src/routes/supportRoutes.js:325` |
| POST | `/api/support/admin/tickets/{id}/reopen` | sessão | ADMIN_SISTEMA | suporte | — | Reabrir um ticket (volta a EM_ANDAMENTO) | `backend/src/routes/supportRoutes.js:329` |
| POST | `/api/support/admin/tickets/{id}/resolve` | sessão | ADMIN_SISTEMA | suporte | — | Marcar um ticket como RESOLVIDO | `backend/src/routes/supportRoutes.js:321` |
| POST | `/api/support/admin/tickets/{id}/transfer` | sessão | ADMIN_SISTEMA | suporte | — | Transferir um ticket para outro assessor de Suporte | `backend/src/routes/supportRoutes.js:315` |
| PATCH | `/api/support/tickets/{id}` | sessão | ADMIN_SISTEMA | suporte | — | Alterar directamente o estado de um ticket (rota legada) | `backend/src/routes/supportRoutes.js:252` |

### Suporte (chat)

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/support/tickets/{id}` | sessão | qualquer autenticado | — | — | Obter um ticket (dono ou assessor de Suporte) | `backend/src/routes/supportRoutes.js:271` |
| GET | `/api/support/tickets/{id}/messages` | sessão | qualquer autenticado | — | — | Listar as mensagens de um ticket | `backend/src/routes/supportRoutes.js:276` |
| POST | `/api/support/tickets/{id}/messages` | sessão | qualquer autenticado | — | chatMessageLimiter | Enviar mensagem (texto e/ou anexo) num ticket | `backend/src/routes/supportRoutes.js:280` |
| POST | `/api/support/tickets/{id}/read` | sessão | qualquer autenticado | — | — | Marcar como lidas as mensagens de outros autores num ticket | `backend/src/routes/supportRoutes.js:296` |
| GET | `/api/support/unread-count` | sessão | qualquer autenticado | — | — | Contar mensagens de suporte não lidas | `backend/src/routes/supportRoutes.js:267` |

### Supplier Development

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/supplier-development/fee` | **pública** | — | — | — | Taxa de acesso ao programa Supplier Development (público) | `backend/src/routes/supplierDevRoutes.js:27` |
| GET | `/api/supplier-development/requests` | sessão | ADMIN_SISTEMA | suporte | — | Lista candidaturas ao programa (Admin do Sistema) | `backend/src/routes/supplierDevRoutes.js:42` |
| POST | `/api/supplier-development/requests` | **pública** | — | — | publicLimiter | Submete uma candidatura pública ao programa (sem conta) | `backend/src/routes/supplierDevRoutes.js:32` |
| PATCH | `/api/supplier-development/requests/{id}` | sessão | ADMIN_SISTEMA | suporte | — | Actualiza estado, notas, taxa e orçamento de uma candidatura | `backend/src/routes/supplierDevRoutes.js:48` |
| PATCH | `/api/supplier-development/requests/{id}/approve` | sessão | ADMIN_SISTEMA | suporte | — | Aprova a candidatura (cria empresa fornecedora, apólice e convite de fundação) | `backend/src/routes/supplierDevRoutes.js:54` |
| GET | `/api/supplier-development/requests/{reference}/track` | **pública** | — | — | — | Acompanha o estado de uma candidatura pela referência (público) | `backend/src/routes/supplierDevRoutes.js:37` |

### Utilizadores

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/users/me` | sessão | qualquer autenticado | — | apiLimiter | Dados básicos do próprio utilizador | `backend/src/routes/userRoutes.js:19` |
| POST | `/api/users/me/anonimizar` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Eliminar (anonimizar) a própria conta — irreversível | `backend/src/routes/userRoutes.js:61` |
| POST | `/api/users/me/avatar` | sessão | qualquer autenticado | — | apiLimiter | Carregar a foto de perfil | `backend/src/routes/userRoutes.js:74` |
| DELETE | `/api/users/me/avatar` | sessão | qualquer autenticado | — | apiLimiter | Remover a foto de perfil | `backend/src/routes/userRoutes.js:84` |
| GET | `/api/users/me/dados-pessoais` | sessão | COMPRADOR, COMPANY_ADMIN, FORNECEDOR, FINANCEIRO, ADMIN_SISTEMA | — | apiLimiter | Exportar os dados pessoais (direito de acesso, Lei 22/11) | `backend/src/routes/userRoutes.js:52` |
| PUT | `/api/users/me/locale` | sessão | qualquer autenticado | — | apiLimiter | Definir o idioma preferido (emails) | `backend/src/routes/userRoutes.js:33` |
| GET | `/api/users/profile` | sessão | qualquer autenticado | — | apiLimiter | Perfil pessoal com resumo por papel | `backend/src/routes/userRoutes.js:24` |

### Utilizadores da empresa

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| GET | `/api/companies/users` | sessão | COMPANY_ADMIN | — | — | Lista os utilizadores da própria empresa | `backend/src/routes/companyRoutes.js:44` |
| POST | `/api/companies/users` | sessão | COMPANY_ADMIN, ADMIN_SISTEMA | cadastro | — | Cria directamente um utilizador (Company Admin ou Admin do Sistema) | `backend/src/routes/companyRoutes.js:53` |
| DELETE | `/api/companies/users/{id}` | sessão | COMPANY_ADMIN | — | — | Rejeita/remove um utilizador da empresa (eliminação definitiva) | `backend/src/routes/companyRoutes.js:51` |
| PATCH | `/api/companies/users/{id}/activate` | sessão | COMPANY_ADMIN | — | — | Aceita o cadastro de um utilizador convidado (activa a conta) | `backend/src/routes/companyRoutes.js:49` |
| PATCH | `/api/companies/users/{id}/status` | sessão | COMPANY_ADMIN | — | — | Bloqueia ou desbloqueia um utilizador da empresa | `backend/src/routes/companyRoutes.js:50` |

### Webhooks de pagamento

| Método | Caminho | Autenticação | Papéis | Áreas admin | Limitador | Resumo | Código |
|---|---|---|---|---|---|---|---|
| POST | `/api/webhooks/pagamento/{canal}` | **pública** | — | — | apiLimiter | Callback de um gateway de pagamento automático (subscrições) | `backend/src/routes/webhookPagamentoRoutes.js:15` |
