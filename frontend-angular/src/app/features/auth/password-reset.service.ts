// Porta de POST /api/auth/{forgot-password,reset-password} — usado por PasswordReset.jsx.
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

@Injectable({ providedIn: 'root' })
export class PasswordResetService {
  constructor(private readonly api: ApiService) {}

  // Resposta sempre genérica (anti-enumeração) — nunca revela se a conta existe.
  forgotPassword(email: string): Observable<{ ok: true; message: string }> {
    return this.api.post('/api/auth/forgot-password', { email });
  }

  resetPassword(token: string, password: string): Observable<{ ok: true }> {
    return this.api.post('/api/auth/reset-password', { token, password });
  }
}
