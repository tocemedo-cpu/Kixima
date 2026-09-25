// Porta directa de temSessao/marcarSessao em frontend/src/api/client.js. A
// mesma nota de segurança aplica-se: isto NÃO é a sessão (que é o cookie
// httpOnly, invisível a este código) — é só uma marca para a interface
// decidir se vale a pena perguntar /api/auth/me.
import { Injectable } from '@angular/core';

const MARCA_DE_SESSAO = 'kixima_tem_sessao';

@Injectable({ providedIn: 'root' })
export class SessionMarkerService {
  temSessao(): boolean {
    try {
      return localStorage.getItem(MARCA_DE_SESSAO) === '1';
    } catch {
      return false;
    }
  }

  marcarSessao(ativa: boolean): void {
    try {
      if (ativa) localStorage.setItem(MARCA_DE_SESSAO, '1');
      else localStorage.removeItem(MARCA_DE_SESSAO);
    } catch {
      // Armazenamento indisponível (privado/bloqueado) — sem sessão persistida
      // entre recargas, mas o pedido a /api/auth/me continua a decidir certo.
    }
  }
}
