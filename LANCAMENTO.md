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

## Acesso da equipa (trabalhar no site com o modo ligado)

Com o modo ligado o público só vê a página em breve. Para a **equipa** trabalhar no site real há um
acesso por **chave secreta**, que nunca vai para o repositório:

1. No Render, em **Environment** de cada serviço (`kixima-vju7`, `kixima-txjr`), cria a variável
   `LAUNCH_BYPASS_KEY` com uma chave longa e aleatória (mínimo 16 caracteres; ex.: `openssl rand -hex 24`)
   e guarda-a num gestor de segredos. Sem esta variável, ou com uma chave curta, o acesso da equipa fica
   **desligado** e o modo é estrito para toda a gente.
2. Cada pessoa da equipa abre **uma vez**, no seu browser, qualquer endereço com a chave:
   `https://kixima.net/login?acesso=<A_CHAVE>`
3. O servidor grava um cookie (`kixima_equipa`, httpOnly, 30 dias) e redirecciona para `/login` **sem** a
   chave no endereço. Daí em diante, nesse browser, o site funciona normalmente (login, dashboards,
   administração). Outros browsers e o público continuam a ver só a página em breve.
4. `https://kixima.net/?acesso=sair` apaga o cookie nesse browser.

**Segurança.** O cookie guarda um HMAC da chave, não a chave. Mudar `LAUNCH_BYPASS_KEY` revoga o acesso de
todos de uma vez. A chave aparece no endereço da primeira visita (e por isso nos registos de pedidos do
Render): trata-a como uma senha e muda-a se for partilhada fora da equipa. Uma chave errada é ignorada em
silêncio. A API nunca depende deste acesso. Código: `acessoEquipa` em `backend/src/middleware/frontend.js` e
`AcessoEquipaFilter.java`; testes em `backend/tests/lancamento.test.js` e `AcessoEquipaFilterTest.java`.

## O que NÃO é bloqueado

- A API (`/api/**`), o `/health`, o `/ready`, o `/socket.io`/`/ws`, o actuator e tudo o que os
  backends registam antes do SPA (webhooks, etc.) — nada disto é "página".
- Ficheiros estáticos (`/assets/**`, imagens, vídeos, `/launch.json`) — são ficheiros, não páginas.
- Outros métodos que não GET/HEAD.
- A app nativa (Capacitor) traz o seu próprio build e não é kixima.net: nunca mostra a página.

Consequência a ter presente: com o modo ligado **o público não consegue usar o site pelo browser**; a equipa usa o acesso da secção anterior. A API continua a responder, por isso integrações, webhooks e sondas não são afectadas.

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
