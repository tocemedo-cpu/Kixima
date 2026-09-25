// Mesmas fontes do frontend React (main.jsx) — importadas via CSS em
// src/styles.css (o pipeline CSS do Angular sabe copiar os ficheiros de
// fonte referenciados por url(); importá-las aqui como módulo JS/TS fazia o
// esbuild tentar processar .woff/.woff2 como código, sem loader configurado).
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
