# Página de lançamento de kixima.net

**Estado actual: LIGADA** (`"enabled": true`) — a raiz de kixima.net mostra a página de lançamento a quem não tem sessão. Para voltar ao site de sempre, põe `false`.

Enquanto estiver ligada, quem abre **kixima.net** (a raiz `/`) sem sessão vê
"Estamos a chegar… Brevemente!" em vez da home corporativa. Tudo o resto fica
como está: login, cadastro, planos, termos, notícias, a API, o WebSocket e todas
as páginas da aplicação continuam acessíveis pelos seus endereços directos, e
quem já tem sessão continua a ir para o seu dashboard. Não envolve DNS.

## Ligar / desligar

Um único ficheiro: [`frontend/public/launch.json`](frontend/public/launch.json)

```json
{ "enabled": true }    // página de lançamento na raiz
{ "enabled": false }   // site corporativo de sempre
```

Altera o valor e faz deploy (o ficheiro vai em `/launch.json`, que o backend
serve com `max-age=0`: a mudança vê-se logo no pedido seguinte ao deploy, sem
limpar cache). Só o booleano `true` liga a página; apagar o ficheiro, um valor
diferente ou qualquer erro a ler `/launch.json` deixam o site de sempre.

> O `frontend/dist` é versionado neste repositório. No deploy por Docker
> (`render.yaml`) o frontend é compilado de novo, por isso basta o commit do
> `launch.json`; num deploy que sirva o `dist` já commitado, faz `npm run build`
> e commita também o `dist`.

## Endereços fixos (independentes do interruptor)

| Endereço | O que mostra |
|---|---|
| `/em-breve` | a página de lançamento (para a rever com o interruptor desligado) |
| `/institucional` | a home corporativa (para a rever com o interruptor ligado) |

## Notas

- Aplica-se à raiz e a endereços desconhecidos (que antes também mostravam a
  home corporativa). Não se aplica à app nativa (Capacitor), que não teria forma
  de iniciar sessão a partir da raiz.
- Os links do menu corporativo para secções da home (`/#sobre`, …) vão para a
  raiz; com a página ligada aterram nela. Em `/institucional` ficam na própria
  rota.
- Pré-visualizações de link (WhatsApp, LinkedIn) não correm JavaScript, por isso
  continuam a usar o título e a descrição de `index.html`.
- Código: `src/launch/launch.js` (interruptor), `src/pages/corporate/ComingSoon.jsx`
  e `coming-soon.css` (página), `Landing` em `src/App.jsx` (decisão).
  Testes: `src/launch/launch.test.js` e `src/App.launch.test.jsx`.
