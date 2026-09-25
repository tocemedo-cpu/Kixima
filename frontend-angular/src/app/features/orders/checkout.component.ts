// Porta de frontend/src/pages/comprador/Checkout.jsx. Mesma regra de
// negócio: os itens são agrupados por fornecedor e é criada UMA Ordem de
// Compra (POST /api/purchase-orders) POR fornecedor — nunca uma PO
// multi-fornecedor, porque o backend não a aceitaria (createPurchaseOrder
// recusa itens de fornecedores diferentes).
import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CartService, CartLine } from '../cart/cart.service';
import { OrdersService } from './orders.service';
import { ApiError } from '../../core/models/api-error.model';
import { CompanyRef } from '../../core/models/purchase-order.model';
import { IVA_RATE, formatMoney } from '../../shared/domain';
import { CrumbsComponent } from '../../shared/buyer-ui/crumbs.component';
import { BuyerPageHeadComponent } from '../../shared/buyer-ui/page-head.component';
import { IconComponent } from '../../shared/components/icon.component';

interface SupplierGroup {
  supplier: CompanyRef;
  items: CartLine[];
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CrumbsComponent, BuyerPageHeadComponent, IconComponent],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
  readonly busy = signal(false);
  readonly error = signal('');
  readonly done = signal<string[] | null>(null);

  formatMoney = formatMoney;

  readonly groups = computed<SupplierGroup[]>(() => {
    const map = new Map<string, SupplierGroup>();
    for (const it of this.cart.items()) {
      const sid = it.product.supplierId;
      if (!map.has(sid)) map.set(sid, { supplier: it.product.supplier as CompanyRef, items: [] });
      map.get(sid)!.items.push(it);
    }
    return [...map.values()];
  });

  readonly subtotal = computed(() => this.cart.items().reduce((s, i) => s + Number(i.product.unitPrice) * i.quantity, 0));
  readonly iva = computed(() => this.subtotal() * IVA_RATE);
  readonly total = computed(() => this.subtotal() + this.iva());

  constructor(
    readonly cart: CartService,
    private readonly ordersService: OrdersService,
    private readonly router: Router,
  ) {}

  groupTotal(g: SupplierGroup): number {
    return g.items.reduce((s, i) => s + Number(i.product.unitPrice) * i.quantity, 0);
  }

  async confirm(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    const created: string[] = [];
    try {
      for (const g of this.groups()) {
        const po = await firstValueFrom(
          this.ordersService.create({
            supplierCompanyId: g.supplier.id,
            items: g.items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          }),
        );
        created.push(po.reference);
      }
      for (const i of this.cart.items()) this.cart.removeItem(i.product.id);
      this.done.set(created);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Não foi possível gerar a(s) Ordem(ns) de Compra.');
    } finally {
      this.busy.set(false);
    }
  }

  irParaOrdens(): void {
    this.router.navigateByUrl('/comprador/ordens');
  }

  voltarParaCesta(): void {
    this.router.navigateByUrl('/comprador/cesta');
  }

  irParaCatalogo(): void {
    this.router.navigateByUrl('/comprador/catalogo');
  }
}
