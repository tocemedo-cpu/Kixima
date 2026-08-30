# Ambiente de teste KIXIMA — piloto com até 50 utilizadores reais

Este guia prepara um **ambiente separado da produção**, vazio (sem dados de
demonstração), para testares a plataforma com utilizadores reais: cada um
regista a sua própria empresa e usa a plataforma como usaria depois de
lançada. Constrói-se sobre o [`DEPLOY.md`](./DEPLOY.md) — lê-o primeiro se
ainda não o leste, este documento assume-o.

## Porquê um ambiente separado, e não a mesma base de produção

Um piloto com pessoas reais gera dados reais: empresas, senhas, ficheiros
carregados, mensagens de chat, PDFs de fatura. Se isto correr na mesma base
de dados que virá a ser a produção definitiva, ficas com duas escolhas más
mais tarde — apagar tudo (incluindo contas que talvez queiras manter) ou
lançar a produção real já com "lixo" de teste lá dentro (empresas fictícias,
faturas de ensaio com numeração AGT gasta). Um projeto Supabase e um serviço
Render **novos e separados** custam zero a mais no plano gratuito e resolvem
isto de raiz: quando o piloto terminar, decides o que aproveitar (nada é
obrigatório) e a produção arranca de uma base limpa.

## 1. Criar a infraestrutura de teste (mesma receita do DEPLOY.md, duplicada)

1. **Supabase**: cria um **novo projeto** (ex. `kixima-teste`). Não uses o
   projeto de produção. Guarda a Database password.
2. **Render**: **New → Blueprint**, aponta para este repositório (mesma
   branch ou uma branch de teste), mas dá ao serviço um **nome diferente**
   do de produção (ex. `kixima-teste`). Isto dá-te um URL próprio, do tipo
   `https://kixima-teste.onrender.com`.
3. Segue os passos 3–4 do `DEPLOY.md` (`DATABASE_URL`/`DIRECT_URL` do pooler
   do **novo** projeto Supabase, deploy, baseline automático das migrações).

O resultado são duas coisas completamente independentes: a app de teste não
sabe que a de produção existe, e vice-versa.

## 2. Variáveis de ambiente — o que muda num piloto real

A tabela de variáveis do `DEPLOY.md` aplica-se toda. Estas são as que
merecem uma escolha deliberada **porque é um piloto com pessoas reais**, não
uma demonstração para ti próprio:

| Variável | Recomendação no piloto | Porquê |
|---|---|---|
| `LOAD_DEMO_CATALOG` | **não definir** | Confirmaste ambiente vazio: cada um dos 50 regista a sua empresa e o seu catálogo do zero, tal como em produção. Definir isto colocaria um fornecedor fictício "Catálogo KIXIMA (Demonstração)" visível a todos. |
| `EMAIL_PROVIDER` | `brevo` (não `console`) | Sem isto, convites de colaborador e recuperação de senha ficam só no log do servidor — os 50 utilizadores reais nunca recebem o email e ficam bloqueados sem perceberem porquê. Ver secção 2 do `DEPLOY.md` para criar a conta Brevo (grátis até 300 emails/dia — sobra para 50 pessoas). |
| `APP_URL` | o URL do **serviço de teste** (`https://kixima-teste.onrender.com` ou o teu domínio de teste) | É a partir daqui que saem os links de convite e recuperação de senha. Se ficar por preencher ou apontar para produção, os links dados às pessoas de teste não funcionam ou levam ao sítio errado. |
| `KIXIMA_BANCO_IBAN` (+ titular/nome/swift) | uma conta bancária real ou claramente identificada como "conta de testes" | Só o IBAN é obrigatório para não dar erro; mas se algum dos 50 testers **realmente** transferir dinheiro para testar o plano PRO (que só aceita transferência manual), tem de cair nalgum lado que controles. Evita usar aqui uma conta de produção viva. |
| `MFA_ENFORCE_FROM` | data **bem à frente**, ou omitir | Obrigar 2FA a meio de um piloto curto de 50 pessoas é fricção extra sem benefício de segurança relevante nesta fase; deixa para quando decidires lançar a sério. |
| `STORAGE_PROVIDER=s3` + bucket Supabase | recomendado, mesmo em teste | Sem isto, logótipos e fotos de produto carregados pelos testers desaparecem a cada redeploy do Render (disco efémero) — no meio de um piloto isso lê-se como um bug ("a minha imagem sumiu"), quando é só a normal falta de armazenamento persistente. |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | recomendado | É exatamente para um piloto que interessa saber, em tempo real, se algum dos 50 bateu num erro — sem depender de ninguém reportar. |

Todas as restantes variáveis (taxa KIXIMA, planos, SLA de pagamento, etc.)
podem ficar nos valores por omissão do `render.yaml` — são as mesmas regras
de negócio que a produção usará.

## 3. Não precisas de tocar nos limites de tráfego

O limitador de pedidos (`backend/src/middleware/rateLimit.js`) já foi
dimensionado para o cenário típico angolano de **um escritório inteiro a
sair para a internet por um único endereço IP**: 600 pedidos/15min por
pessoa ou IP (endpoints normais), 60 tentativas/15min de login por IP (o
bloqueio real por conta é outro mecanismo, este é só anti-inundação), 30
pedidos/15min para registo/aceitação de convite. Para 50 pessoas isto chega
com folga, mesmo que várias estejam na mesma rede. Só ajustes se, a meio do
piloto, a página de erro mencionar `RATE_LIMITED` — nesse caso sobe
`API_RATE_LIMIT`/`AUTH_RATE_LIMIT` no Environment do Render.

## 4. Criar a tua conta de Administrador do Sistema

Este é o único "seed" que o ambiente de teste leva — a tua própria conta,
para poderes aprovar as empresas que os 50 utilizadores forem registando:

No Render → Shell do serviço de teste (precisa de plano pago; no plano
`free` corre isto localmente, ligado à `DIRECT_URL` do Supabase de teste):
```bash
cd backend
ADMIN_EMAIL="o-teu-email@..." ADMIN_PASSWORD="uma-senha-forte" ADMIN_NAME="Administrador KIXIMA" npm run seed
```
É idempotente — corre outra vez sempre que precisares de mudar a senha.

**Não uses `npm run seed:demo`** neste ambiente: esse script cria uma
empresa cliente, uma fornecedora e 5 utilizadores fictícios com a senha
`Kixima@123` publicada no próprio repositório — é para a suite de testes
automatizados, nunca para um ambiente onde pessoas reais vão entrar.

## 5. O que vais ter de fazer manualmente durante o piloto

Ao contrário de um ambiente com dados pré-carregados, aqui **cada empresa
regista-se e fica pendente até seres tu a aprovar** — é a mesma regra que
valerá em produção (secção 4.1 da especificação: due diligence documental).
Concretamente, por cada uma das ~50 pessoas/empresas:

1. A pessoa regista a empresa em `/registar` (cliente ou fornecedor),
   submete os documentos exigidos (certidão comercial + alvará; fornecedor
   acrescenta licença ANPG) — a empresa fica em estado **PENDENTE**.
2. **Só para empresas fornecedoras**: têm ainda de submeter a apólice
   Fornecedor→KIXIMA (ecrã da própria empresa) — sem isso, o passo seguinte
   recusa-se, de propósito (é condição de credenciamento, não uma
   formalidade).
3. Entras como Admin do Sistema → **Cadastro & Empresas** → revês os
   documentos e **aprovas ou rejeitas** cada empresa. Só depois de aprovada
   é que a empresa consegue operar (publicar catálogo, pedir cotações,
   emitir/aceitar ordens de compra).

Para um piloto de 50, isto é ~50 aprovações manuais espalhadas pelos dias em
que as pessoas se forem registando — não é um passo que se salte, é
exatamente o que estás a testar (o due diligence é uma peça central do
produto, não um obstáculo de ambiente).

## 6. Confirmar que está tudo a postos

Entra como Admin do Sistema → **Configurações e Suporte → Prontidão para
produção**. Esta página lê a configuração viva do processo (não apenas o
que puseste no `.env`) e diz exactamente o que falta: email, armazenamento,
cópias de segurança, IBAN, canais de pagamento automático (EMIS/PayPay/
bancos, se os fores configurar), 2FA. Corre-a antes de convidar os 50
testers — poupa-te a descobrir a meio do piloto que os emails nunca saíram.

## 7. No fim do piloto

- **Se vais reaproveitar o ambiente como produção**: rever/rodar
  `JWT_SECRET` (termina todas as sessões dos testers) e a senha da base de
  dados, tal como o `DEPLOY.md` recomenda antes de abrir a operadoras a
  sério; considerar `MFA_ENFORCE_FROM` para uma data próxima.
- **Se vais começar a produção do zero**: não precisas de fazer nada ao
  ambiente de teste — fica isolado no seu próprio projeto Supabase/serviço
  Render, e o novo ambiente de produção nasce limpo, seguindo o
  `DEPLOY.md` normalmente.
