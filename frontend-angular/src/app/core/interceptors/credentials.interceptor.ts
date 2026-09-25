// Porta de COM_SESSAO em frontend/src/api/client.js: `credentials: 'include'`
// em TODOS os pedidos — sem isto o browser não envia o cookie httpOnly de
// sessão (kixima_sessao) para outra origem (relevante em desenvolvimento,
// onde o Angular corre num processo e a API noutro, mesmo com proxy).
import { HttpInterceptorFn } from '@angular/common/http';

export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: true }));
