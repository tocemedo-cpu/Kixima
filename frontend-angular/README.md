# KIXIMA — Frontend Angular

Novo frontend do KIXIMA, em Angular 19 + TypeScript, a substituir
progressivamente o frontend React em `../frontend`. O backend de destino é o
**Java/Spring Boot** (`../backend-java`), não o Node — ver
`docs/migracao-angular/PLANO.md` na raiz do repositório para o estado
completo da migração (o que já foi portado, o que falta, e a ordem
recomendada).

## Pré-requisitos

- Node.js **≥ 22.22.3** ou **≥ 24.15.0** (o Angular CLI 19 recusa-se a correr
  numa versão anterior). Se o `node` do sistema for mais antigo, use uma
  instalação alternativa (ex.: `/opt/node22/bin` neste ambiente).
- O backend Java a correr localmente (porta 4001 por omissão) com uma base
  PostgreSQL semeada — ver `../backend-java/README.md` e
  `../backend/prisma/seed.demo.js` para os dados de demonstração.

## Desenvolvimento

```bash
npm install
npm start          # ng serve — http://localhost:4200
```

O proxy de desenvolvimento (`proxy.conf.mjs`) encaminha `/api` e `/ws` para
`http://localhost:4001` (o backend Java) por omissão. Para apontar
temporariamente ao Node durante a transição:

```bash
KIXIMA_API_TARGET=http://localhost:4000 npm start
```

## Testes

```bash
npm run test:ci    # Karma + Jasmine, headless, execução única
```

Este ambiente usa o Chromium já instalado (Playwright) como navegador headless
— ver `karma.conf.js` (`customLaunchers.ChromiumSemSandbox`). Se o `CHROME_BIN`
não estiver definido no seu ambiente, aponte-o para um Chromium instalado:

```bash
CHROME_BIN=/caminho/para/chromium npm run test:ci
```

## Build de produção

```bash
npm run build       # gera dist/frontend-angular
```

## Estrutura

```
src/app/
  core/         # serviços transversais: API, autenticação, guards, interceptors, modelos
  shared/       # componentes reutilizáveis, tema, constantes de domínio
  features/     # um módulo por domínio de negócio (auth, quotes, catalog, shell, …)
```

Ver `docs/migracao-angular/PLANO.md` para o mapeamento completo entre cada
página React (`../frontend/src/pages/**/*.jsx`) e o seu equivalente Angular,
migrado ou pendente.
