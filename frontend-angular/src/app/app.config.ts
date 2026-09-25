import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // withComponentInputBinding: liga `data`/params de rota directamente a
    // @Input()s do componente (ex.: PendingPageComponent.titulo) sem cada
    // componente ter de injectar ActivatedRoute manualmente.
    provideRouter(routes, withComponentInputBinding()),
    // Ordem importa: credenciais primeiro (aplica-se ao pedido de saída),
    // erro depois (intercepta a resposta em qualquer pedido, já com cookie).
    provideHttpClient(withInterceptors([credentialsInterceptor, errorInterceptor])),
  ],
};
