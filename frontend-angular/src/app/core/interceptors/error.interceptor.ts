// Normaliza toda a resposta de erro do backend (Node ou Java — ambos usam o
// MESMO envelope { error: { code, message, details } }, ver
// backend/src/middleware/errorHandler.js e o GlobalExceptionHandler Java) num
// ApiError com os mesmos campos que o React lia (message, code, details,
// status, rawMessage) — ver frontend/src/api/client.js, função request().
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiError, ApiErrorBody } from '../models/api-error.model';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const body = (err.error ?? null) as ApiErrorBody | null;
        const rawMessage = body?.error?.message ?? null;
        const message = rawMessage ?? `Erro ${err.status} ao contactar a API.`;
        return throwError(() => new ApiError(message, err.status, body?.error?.code, body?.error?.details, rawMessage));
      }
      return throwError(() => err);
    }),
  );
