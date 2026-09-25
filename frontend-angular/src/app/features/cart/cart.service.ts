// Porta de frontend/src/pages/comprador/CartContext.jsx (CartProvider/useCart)
// para um serviço Angular com signals. Mesma chave de localStorage
// (`kixima_cart`), mesma forma de item ({ product, quantity }), mesma lógica
// de total/count.
import { Injectable, computed, signal } from '@angular/core';
import { ProductDto } from '../../core/models/product.model';

const STORAGE_KEY = 'kixima_cart';

export interface CartLine {
  product: ProductDto;
  quantity: number;
}

function loadInitial(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly itemsSignal = signal<CartLine[]>(loadInitial());

  readonly items = computed(() => this.itemsSignal());
  readonly total = computed(() =>
    this.itemsSignal().reduce((sum, i) => sum + Number(i.product.unitPrice) * i.quantity, 0),
  );
  readonly count = computed(() => this.itemsSignal().reduce((sum, i) => sum + i.quantity, 0));

  private persistir(items: CartLine[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Armazenamento indisponível/quota esgotada — a cesta fica só em memória.
    }
  }

  addItem(product: ProductDto, quantity = 1): void {
    this.itemsSignal.update((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      const next = existing
        ? prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i))
        : [...prev, { product, quantity }];
      this.persistir(next);
      return next;
    });
  }

  updateQuantity(productId: string, quantity: number): void {
    this.itemsSignal.update((prev) => {
      const next = prev
        .map((i) => (i.product.id === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0);
      this.persistir(next);
      return next;
    });
  }

  removeItem(productId: string): void {
    this.itemsSignal.update((prev) => {
      const next = prev.filter((i) => i.product.id !== productId);
      this.persistir(next);
      return next;
    });
  }

  clear(): void {
    this.itemsSignal.set([]);
    this.persistir([]);
  }
}
