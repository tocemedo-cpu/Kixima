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

A identidade é a da **Proposta 04 · Bancada** (Manual v1.0 da KIXIMA), com os
**três fundos** do HTML de referência, cada um com a sua identidade própria:

| Fundo | Carácter | Tokens |
|---|---|---|
| **Claro** | O marfim do manual — o fundo por omissão | F7F3EA · FFFFFF · EBE4D6 · 111111 · B8202E · D99A05 |
| **Escuro 1** | O mesmo sistema invertido, neutros quentes | 131210 · 201E1A · 2A2723 · F2EFE8 · E0656D · E5A821 |
| **Escuro 2** | Casco, âmbar de segurança e ciano de instrumento | 0C1219 · 17222C · 1F2C37 · DCE5EC · F2A007 · 35A7B8 |

- `src/styles/tema.css` — as variáveis dos três fundos, com os valores exactos
  da proposta (`:root`, `prefers-color-scheme: dark` → Escuro 1,
  `html[data-tema="…"]`). As folhas imprimíveis (`.folha-clara`) ficam sempre
  em papel claro.
- `src/styles/global.css` — os tokens históricos (`--brand-*`, `--ink-*`,
  `--paper-*`, `--navy-*`, `--amber-*`, `--teal-*`, `--line`…) lêem agora
  essas variáveis: todos os ecrãs mudam de fundo sem tocar no seu CSS.
- `src/styles/bancada.css` — os componentes da proposta (barra preta com o fio
  Samakaka, lateral branca com o item activo em areia e barra vermelha,
  mosaicos, tabelas com cabeçalho mono, selos `.est`, botões `.bt`, facetas,
  campo de pesquisa) aplicados às classes que a aplicação já usa.
- `src/tema/TemaContext.jsx` — a escolha do fundo (`localStorage`
  `kixima.tema`, aplicada em `index.html` antes do primeiro paint) e o grupo
  de botões **Claro · Escuro 1 · Escuro 2**, presente no menu da conta, no
  login e no cabeçalho do site corporativo.

Tipografia: **Sora** (títulos e números), **Inter** (texto), **IBM Plex Mono**
(referências, rótulos, cabeçalhos de tabela) — self-hosted via @fontsource.
Cantos a 10 px nos cartões e 6 px nos botões, como no manual. O símbolo, o
losango Samakaka e as fotografias/ícones existentes mantêm-se em todos os fundos.

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
