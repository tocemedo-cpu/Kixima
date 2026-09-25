import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { of } from 'rxjs';
import { SupplierCompareComponent } from './supplier-compare.component';
import { MarketplaceService } from './marketplace.service';
import { CompareResponse } from '../../core/models/marketplace-extra.model';

function resposta(): CompareResponse {
  return {
    base: { name: 'Válvula de Esfera', unspscTitle: 'Válvulas', unspscCode: '4012345' },
    count: 2,
    offers: [
      { id: 'o1', unitPrice: '1000', currency: 'AOA', leadTimeDays: 10, supplier: { id: 's1', name: 'Alfa, Lda' } },
      { id: 'o2', unitPrice: '900', promoPrice: '850', currency: 'AOA', leadTimeDays: 5, supplier: { id: 's2', name: 'Beta SA' } },
    ],
  };
}

function montar(productId: string | null = 'p1') {
  const marketplaceService = jasmine.createSpyObj<MarketplaceService>('MarketplaceService', ['compare']);
  marketplaceService.compare.and.returnValue(of(resposta()));
  const route = { snapshot: { queryParamMap: { get: () => productId } } } as unknown as ActivatedRoute;
  const location = jasmine.createSpyObj<Location>('Location', ['back']);
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(
    () => new SupplierCompareComponent(route, marketplaceService, location),
  );
  return { componente, marketplaceService, location };
}

describe('SupplierCompareComponent', () => {
  it('carrega a comparação pelo productId do endereço', () => {
    const { componente, marketplaceService } = montar('p1');
    expect(marketplaceService.compare).toHaveBeenCalledWith('p1');
    expect(componente.offers().length).toBe(2);
    expect(componente.itemName()).toBe('Válvulas');
  });

  it('assinala erro quando não há productId no endereço', () => {
    const { componente, marketplaceService } = montar(null);
    expect(marketplaceService.compare).not.toHaveBeenCalled();
    expect(componente.error()).toBe('Produto não indicado.');
  });

  it('bestPrice() é o menor preço efectivo (promoPrice quando existir)', () => {
    const { componente } = montar('p1');
    expect(componente.bestPrice()).toBe(850);
  });

  it('bestLead() é o menor prazo entre as ofertas', () => {
    const { componente } = montar('p1');
    expect(componente.bestLead()).toBe(5);
  });

  it('precoItens() marca a melhor oferta de preço', () => {
    const { componente } = montar('p1');
    const melhor = componente.precoItens().find((i) => i.id === 'o2');
    expect(melhor?.best).toBeTrue();
  });

  it('voltar() delega no Location.back()', () => {
    const { componente, location } = montar('p1');
    componente.voltar();
    expect(location.back).toHaveBeenCalled();
  });
});
