# KIXIMA — Frontend (MVP)

React + Vite. Consome a API do `kixima-backend` e cobre as telas das 5
personas descritas em `kixima-telas-mvp.md`.

## Stack

- **React 18** + **React Router 6** (sem Redux — estado de servidor vai
  direto para `useState`/`useEffect`; a única exceção é a cesta do
  Comprador, guardada em `CartContext`).
- **Vite** com proxy de `/api` para `http://localhost:4000` em desenvolvimento.
- CSS simples com tokens em `src/styles/global.css` — sem framework de UI.

## Identidade visual

Pensada como uma consola operacional do setor petrolífero, não como um SaaS
genérico: azul petróleo profundo (`--navy-900`) para a navegação, âmbar de
sinalização (`--amber-500`) para ações primárias e estados de energia,
verde-azulado (`--teal-600`) para "pagamento garantido", terracota para
divergências/erros. Tipografia técnica: **Space Grotesk** para display,
**IBM Plex Sans** para o corpo, **IBM Plex Mono** para referências (POs,
faturas, apólices).

**Elemento de assinatura**: o anel de SLA de pagamento
(`src/components/PaymentSlaRing.jsx`) — visualiza a promessa central do
produto (pagamento ao fornecedor em ≤ 7 dias) como um anel que enche e muda
de cor à medida que os dias passam. Aparece no detalhe da PO e nas faturas
pendentes do Financeiro.

## Como correr localmente

```bash
npm install
npm run dev        # http://localhost:5173, com proxy para a API em :4000
```

Certifique-se de que o `kixima-backend` está a correr em `localhost:4000`
(ver README do backend) e que fez `npm run seed` lá para ter os 5
utilizadores de demonstração. A página de login já vem com atalhos para
preencher as credenciais de cada persona.

## Estrutura

```
src/
  api/client.js          # fetch wrapper fino, injeta JWT, normaliza erros
  auth/                  # AuthContext (login/logout/sessão) + guards de rota
  components/             # componentes partilhados (tabela, badge, layout…)
  domain.js                # rótulos PT, mapeamentos de estado -> cor do badge
  navConfig.js              # itens da sidebar por persona
  pages/
    shared/                  # login, cadastro público, notificações, perfil, ajuda,
                              #   e o detalhe de PO (partilhado entre 4 personas)
    comprador/                # catálogo, cesta, ordens
    companyAdmin/               # aprovações, utilizadores, contratos, perfil
    fornecedor/                  # catálogo (gestão), ordens recebidas, faturas,
                                  #   pagamentos, perfil (+ onboarding da apólice)
    financeiro/                   # faturas pendentes, histórico, perfil
    adminSistema/                  # due diligence, gestão de apólices, empresas
```

## Como cada tela liga à especificação

- **`OrderDetail.jsx`** (partilhado) é o coração do produto — mostra os 8
  passos do fluxo principal e expõe só as ações válidas para o estado atual
  e a persona de quem está a ver (aprovar/rejeitar, aceitar/recusar,
  despachar, marcar entregue, confirmar receção/divergência).
- **Call-offs** aparecem com um badge distinto em qualquer lista de POs;
  saltam a aprovação individual porque a decisão de negócio já foi tomada na
  assinatura do contrato.
- **Perfil da Empresa do Fornecedor** funciona também como o formulário de
  Cadastro/Onboarding: enquanto a empresa não estiver aprovada, mostra o
  formulário de submissão da apólice Fornecedor→KIXIMA.
- **Gestão de Apólices** (Admin do Sistema) separa claramente as duas
  apólices: emite/renova KIXIMA→Cliente por empresa cliente aprovada, e
  decide sobre apólices Fornecedor→KIXIMA submetidas.

## Nota sobre o backend

Foi feito um pequeno ajuste no `kixima-backend` (`poService.listPurchaseOrders`
passou a incluir `invoice` + `payment`) para que as telas de Faturas e
Pagamentos Recebidos do Fornecedor tenham os dados que precisam sem chamadas
extra. Sem outras alterações ao backend.

## Contratos-Quadro (Admin do Sistema)

`pages/adminSistema/Contracts.jsx` — a equipa KIXIMA cria contratos-quadro entre
um cliente e um fornecedor aprovados, indicando as categorias cobertas, valor,
periodicidade de faturação, prazo de pagamento próprio e vigência. A partir de um
contrato ativo, qualquer PO elegível do cliente para esse fornecedor vira
automaticamente Call-off (deteção em `poService.createPurchaseOrder`). O Admin do
Sistema vê todos os contratos da plataforma (`GET /api/contracts`).

## Fora de escopo deste MVP

- "Minhas Aprovações" (aprovações delegadas do Comprador) — só relevante se
  houver delegação, que não está no MVP do backend.
- Seleção de empresa no login (para utilizadores com mais de uma empresa) —
  o modelo de dados atual associa um utilizador a uma única empresa.
