# Modo de lançamento de kixima.net

Enquanto [`frontend/public/launch.json`](frontend/public/launch.json) tiver `"enabled": true`,
**qualquer endereço de kixima.net mostra apenas a página "Estamos a chegar… Brevemente!"**:
`/`, `/login`, `/cadastro`, dashboards, páginas administrativas, rotas desconhecidas — para toda a
gente, incluindo quem já tem sessão. Com `"enabled": false` tudo funciona normalmente.

```json
{ "enabled": true }    // só a página de lançamento
{ "enabled": false }   // tudo normal
```

Alterar o valor e fazer deploy chega: não há DNS, rotas nem código a tocar. Só o booleano `true`
liga; apagar o ficheiro, `"true"` em texto, `1`, JSON inválido ou um erro a ler o ficheiro deixam o
site normal.

## Como é imposto (sem forma de contornar)

1. **No servidor** (a garantia). Os dois backends servem o SPA e aplicam o interruptor antes de
   qualquer ficheiro ou rota: com o modo ligado, **todo o pedido de página** (GET/HEAD sem extensão ou
   `.html` — incluindo `/`, `/index.html`, maiúsculas, `//login`, `/%6cogin`, `;x=1`, ficheiros
   antigos que já não existem) recebe `launch.html`, uma página **estática, sem React**, com
   `Cache-Control: no-store`. A aplicação nunca chega ao browser.
   - Node: `backend/src/middleware/frontend.js` (`montarFrontend`, chamado em `app.js`).
   - Java: `ModoLancamento` + `SpaHandlerMapping` (`backend-java/.../frontend/`).
   - O ficheiro é relido quando muda, sem reiniciar. Sem `launch.html` no `dist` o servidor avisa uma
     vez e serve a app (a guarda do SPA, abaixo, assume).
2. **No SPA** (defesa em profundidade). `App.jsx` lê `/launch.json` acima de todas as rotas: com
   `true` mostra só `ComingSoon`, e nenhuma rota é montada. Cobre separadores que já estavam abertos
   (volta a ler quando a janela recupera o foco e de 5 em 5 minutos) e o servidor de desenvolvimento.

## O que NÃO é bloqueado

- A API (`/api/**`), o `/health`, o `/ready`, o `/socket.io`/`/ws`, o actuator e tudo o que os
  backends registam antes do SPA (webhooks, etc.) — nada disto é "página".
- Ficheiros estáticos (`/assets/**`, imagens, vídeos, `/launch.json`) — são ficheiros, não páginas.
- Outros métodos que não GET/HEAD.
- A app nativa (Capacitor) traz o seu próprio build e não é kixima.net: nunca mostra a página.

Consequência a ter presente: com o modo ligado **ninguém consegue usar o site pelo browser**, nem
administradores. A API continua a responder, por isso integrações, webhooks e sondas não são afectadas.

## Rever a página com o modo desligado

`/em-breve` mostra sempre a página de lançamento (só quando o modo está desligado — ligado, todos os
endereços já a mostram).

## Desenvolvimento e testes e2e

No `vite dev`, `/launch.json` responde sempre `{"enabled": false}` (plugin em `vite.config.js`), para o
servidor de dev e os testes Playwright não ficarem presos na página. `LAUNCH_DEV=on npm run dev` usa o
ficheiro verdadeiro. Os testes e2e contra um ambiente já publicado (`E2E_BASE_URL`) precisam dele com
`"enabled": false`.

## Deploy

- Docker (`render.yaml`): o frontend é compilado de novo, por isso basta o commit de `launch.json`.
- O `frontend/dist` é versionado e está desfasado do código; num deploy que sirva o `dist` já commitado
  é preciso `npm run build` e commitar o `dist` (traz `launch.html` e `launch.json`). Sem `launch.json`
  no `dist`, os servidores não aplicam nada.
- Pré-visualizações de link (WhatsApp, LinkedIn) usam o título e a descrição de `launch.html` (ligado)
  ou de `index.html` (desligado).

## Código e testes

| | |
|---|---|
| Interruptor | `frontend/public/launch.json`, `frontend/src/launch/launch.js` |
| Página | `frontend/launch.html` + `src/launch/launch-page.js` (estática) · `src/pages/corporate/ComingSoon.jsx` (no SPA) · `coming-soon.css` |
| Servidor Node | `backend/src/middleware/frontend.js` · teste `backend/tests/lancamento.test.js` |
| Servidor Java | `ModoLancamento.java`, `SpaHandlerMapping.java` · teste `ModoLancamentoTest.java` |
| SPA | `App.jsx` · testes `src/App.launch.test.jsx`, `src/launch/*.test.js` |
