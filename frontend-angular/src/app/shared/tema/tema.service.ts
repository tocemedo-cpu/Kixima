// Porta de frontend/src/tema/TemaContext.jsx (TemaProvider/useTema) para um
// serviço Angular com signals. Mesma chave de localStorage (`kixima.tema`),
// mesmos três fundos, mesma regra: sem escolha guardada, segue o sistema
// (prefers-color-scheme) em tempo real; a escolha fica em <html data-tema>.
import { Injectable, computed, signal } from '@angular/core';

export const CHAVE = 'kixima.tema';

export interface TemaOpcao {
  id: 'claro' | 'escuro-1' | 'escuro-2';
  label: string;
  titulo: string;
}

export const TEMAS: TemaOpcao[] = [
  { id: 'claro', label: 'Claro', titulo: 'Marfim do manual' },
  { id: 'escuro-1', label: 'Escuro 1', titulo: 'O mesmo sistema invertido, com os neutros quentes do manual' },
  { id: 'escuro-2', label: 'Escuro 2', titulo: 'Aproximado à proposta 02: casco, âmbar de segurança e ciano de instrumento' },
];

const IDS = new Set(TEMAS.map((t) => t.id));

function lerGuardado(): TemaOpcao['id'] | null {
  try {
    const v = window.localStorage.getItem(CHAVE);
    return v && IDS.has(v as TemaOpcao['id']) ? (v as TemaOpcao['id']) : null;
  } catch {
    return null;
  }
}

function doSistema(): TemaOpcao['id'] {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro-1' : 'claro';
  } catch {
    return 'claro';
  }
}

@Injectable({ providedIn: 'root' })
export class TemaService {
  readonly TEMAS = TEMAS;
  private readonly escolha = signal<TemaOpcao['id'] | null>(lerGuardado());
  private readonly sistema = signal<TemaOpcao['id']>(doSistema());

  readonly tema = computed(() => this.escolha() || this.sistema());
  readonly escolhido = computed(() => Boolean(this.escolha()));

  constructor() {
    this.aplicarNaRaiz(this.escolha());
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', () => this.sistema.set(mq.matches ? 'escuro-1' : 'claro'));
    } catch {
      // matchMedia indisponível (SSR/teste) — fica no valor inicial.
    }
  }

  setTema(id: string): void {
    if (!IDS.has(id as TemaOpcao['id'])) return;
    this.escolha.set(id as TemaOpcao['id']);
    this.aplicarNaRaiz(id as TemaOpcao['id']);
    try {
      window.localStorage.setItem(CHAVE, id);
    } catch {
      // Sem armazenamento: fica só nesta sessão, tal como no React.
    }
  }

  private aplicarNaRaiz(id: string | null): void {
    const raiz = document.documentElement;
    if (id) raiz.setAttribute('data-tema', id);
    else raiz.removeAttribute('data-tema');
  }
}
