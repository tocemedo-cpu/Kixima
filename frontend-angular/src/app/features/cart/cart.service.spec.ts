import { TestBed } from '@angular/core/testing';
import { CartService } from './cart.service';
import { ProductDto } from '../../core/models/product.model';

function produto(id: string, unitPrice = '1000'): ProductDto {
  return {
    id, supplierId: 's1', name: `Produto ${id}`, category: 'Válvulas', unitPrice, currency: 'AOA',
    kind: 'PRODUTO', certifications: [], tags: [], active: true, reviewCount: 0, viewCount: 0,
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    localStorage.removeItem('kixima_cart');
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
  });

  it('começa vazio quando não há nada guardado', () => {
    expect(service.items()).toEqual([]);
    expect(service.total()).toBe(0);
    expect(service.count()).toBe(0);
  });

  it('addItem soma a quantidade quando o produto já está na cesta', () => {
    const p = produto('p1');
    service.addItem(p, 2);
    service.addItem(p, 3);
    expect(service.items().length).toBe(1);
    expect(service.items()[0].quantity).toBe(5);
    expect(service.count()).toBe(5);
    expect(service.total()).toBe(5000);
  });

  it('updateQuantity remove o item quando a quantidade cai a zero ou menos — mesma regra do CartContext.jsx', () => {
    const p = produto('p1');
    service.addItem(p, 1);
    service.updateQuantity('p1', 0);
    expect(service.items()).toEqual([]);
  });

  it('removeItem tira só o produto indicado', () => {
    service.addItem(produto('p1'), 1);
    service.addItem(produto('p2'), 1);
    service.removeItem('p1');
    expect(service.items().map((i) => i.product.id)).toEqual(['p2']);
  });

  it('clear esvazia a cesta', () => {
    service.addItem(produto('p1'), 1);
    service.clear();
    expect(service.items()).toEqual([]);
  });

  it('persiste em localStorage sob a chave kixima_cart', () => {
    service.addItem(produto('p1', '2500'), 2);
    const guardado = JSON.parse(localStorage.getItem('kixima_cart')!);
    expect(guardado.length).toBe(1);
    expect(guardado[0].quantity).toBe(2);
  });

  it('carrega o estado inicial a partir do localStorage já preenchido', () => {
    localStorage.setItem('kixima_cart', JSON.stringify([{ product: produto('p9', '500'), quantity: 4 }]));
    const novoServico = TestBed.runInInjectionContext(() => new CartService());
    expect(novoServico.items().length).toBe(1);
    expect(novoServico.total()).toBe(2000);
  });
});
