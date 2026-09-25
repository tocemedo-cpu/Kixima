// Porta de frontend/src/pages/comprador/Cart.jsx.
import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from './cart.service';
import { IVA_RATE, formatMoney } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { IconComponent } from '../../shared/components/icon.component';
import { StarsComponent } from '../../shared/components/stars.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CrumbsComponent, BuyerPageHeadComponent, IconComponent, StarsComponent],
  templateUrl: './cart.component.html',
})
export class CartComponent {
  readonly toast = signal('');
  readonly Math = Math;

  constructor(
    readonly cart: CartService,
    private readonly router: Router,
  ) {}

  formatMoney = formatMoney;

  get subtotal(): number {
    return this.cart.total();
  }
  get iva(): number {
    return this.subtotal * IVA_RATE;
  }
  get total(): number {
    return this.subtotal + this.iva;
  }

  exportCart(): void {
    const items = this.cart.items();
    const blob = new Blob(
      [JSON.stringify(items.map((i) => ({ name: i.product.name, qty: i.quantity, unitPrice: i.product.unitPrice })), null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cesta-kixima.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  saveCart(): void {
    try {
      localStorage.setItem(
        'kixima_saved_cart',
        JSON.stringify(this.cart.items().map((i) => ({ id: i.product.id, qty: i.quantity }))),
      );
      this.toast.set('Cesta guardada.');
      setTimeout(() => this.toast.set(''), 3000);
    } catch {
      this.toast.set('Não foi possível guardar a cesta neste navegador.');
    }
  }

  irParaCatalogo(): void {
    this.router.navigateByUrl('/comprador/catalogo');
  }

  irParaCheckout(): void {
    this.router.navigateByUrl('/comprador/checkout');
  }

  irParaCotacoes(): void {
    this.router.navigateByUrl('/comprador/cotacoes');
  }
}
