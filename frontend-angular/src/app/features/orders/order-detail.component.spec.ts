// Testa a MESMA matriz de condições que frontend/src/pages/shared/OrderDetail.jsx
// usa para mostrar/esconder cada botão de acção (canApprove, canAcceptRefuse,
// etc.) — ponto por ponto. Isto é RBAC do lado do CLIENTE (mostrar/esconder);
// o RBAC verdadeiro é sempre imposto pelo servidor (Java), verificado à parte
// via testes de integração e verificação ao vivo (ver relatório final).
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { OrderDetailComponent } from './order-detail.component';
import { OrdersService } from './orders.service';
import { AuthService } from '../../core/services/auth.service';
import { PurchaseOrderDto, PoStatus } from '../../core/models/purchase-order.model';
import { KiximaUser, PersonaRole } from '../../core/models/user.model';

function poBase(overrides: Partial<PurchaseOrderDto> = {}): PurchaseOrderDto {
  return {
    id: 'po1', reference: 'PO-1', buyerCompanyId: 'b1', supplierCompanyId: 's1', createdById: 'u1',
    status: 'AGUARDANDO_APROVACAO', totalAmount: '1000', currency: 'AOA', isCallOff: false, erpManaged: false,
    createdAt: '2026-01-01', updatedAt: '2026-01-01', items: [],
    buyerCompany: { id: 'b1', name: 'Compradora' }, supplierCompany: { id: 's1', name: 'Fornecedora' },
    ...overrides,
  };
}

function utilizador(role: PersonaRole): KiximaUser {
  return { id: 'u1', name: 'Ana', email: 'a@a.co.ao', role, adminAreas: [], companyId: 'c1', companyType: 'CLIENTE', avatarUrl: null };
}

function montar(po: PurchaseOrderDto, role: PersonaRole): OrderDetailComponent {
  // Alguns testes montam mais do que um componente na mesma função `it` (ex.:
  // canCreditNote compara três cenários) — sem isto, a segunda chamada a
  // configureTestingModule falha porque o TestBed já foi instanciado.
  TestBed.resetTestingModule();
  const ordersService = jasmine.createSpyObj<OrdersService>('OrdersService', ['get', 'history']);
  ordersService.get.and.returnValue(of(po));
  ordersService.history.and.returnValue(of([]));
  const auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
  auth.user.and.returnValue(utilizador(role));
  const route = { snapshot: { paramMap: { get: () => po.id } } } as unknown as ActivatedRoute;

  TestBed.configureTestingModule({
    providers: [
      { provide: OrdersService, useValue: ordersService },
      { provide: AuthService, useValue: auth },
      { provide: ActivatedRoute, useValue: route },
    ],
  });
  const router = jasmine.createSpyObj('Router', ['navigateByUrl']);
  return TestBed.runInInjectionContext(() => new OrderDetailComponent(route, auth, ordersService, router));
}

describe('OrderDetailComponent — RBAC do lado do cliente (mostrar/esconder acções)', () => {
  const CENARIOS: Array<{ status: PoStatus; role: PersonaRole; flag: keyof OrderDetailComponent; esperado: boolean; extra?: Partial<PurchaseOrderDto> }> = [
    // canApprove — só COMPANY_ADMIN, só AGUARDANDO_APROVACAO, nunca call-off/erpManaged.
    { status: 'AGUARDANDO_APROVACAO', role: 'COMPANY_ADMIN', flag: 'canApprove', esperado: true },
    { status: 'AGUARDANDO_APROVACAO', role: 'COMPRADOR', flag: 'canApprove', esperado: false },
    { status: 'APROVADA', role: 'COMPANY_ADMIN', flag: 'canApprove', esperado: false },
    { status: 'AGUARDANDO_APROVACAO', role: 'COMPANY_ADMIN', flag: 'canApprove', esperado: false, extra: { isCallOff: true } },
    { status: 'AGUARDANDO_APROVACAO', role: 'COMPANY_ADMIN', flag: 'canApprove', esperado: false, extra: { erpManaged: true } },

    // canAcceptRefuse — só FORNECEDOR, só APROVADA.
    { status: 'APROVADA', role: 'FORNECEDOR', flag: 'canAcceptRefuse', esperado: true },
    { status: 'APROVADA', role: 'COMPRADOR', flag: 'canAcceptRefuse', esperado: false },
    { status: 'AGUARDANDO_APROVACAO', role: 'FORNECEDOR', flag: 'canAcceptRefuse', esperado: false },

    // canReceive — só COMPRADOR, ENTREGUE ou EM_EXECUCAO.
    { status: 'ENTREGUE', role: 'COMPRADOR', flag: 'canReceive', esperado: true },
    { status: 'EM_EXECUCAO', role: 'COMPRADOR', flag: 'canReceive', esperado: true },
    { status: 'ENTREGUE', role: 'FORNECEDOR', flag: 'canReceive', esperado: false },
    { status: 'PAGA', role: 'COMPRADOR', flag: 'canReceive', esperado: false },

    // canResolveDivergence — COMPRADOR ou COMPANY_ADMIN, só RECEBIDA_COM_DIVERGENCIA.
    { status: 'RECEBIDA_COM_DIVERGENCIA', role: 'COMPRADOR', flag: 'canResolveDivergence', esperado: true },
    { status: 'RECEBIDA_COM_DIVERGENCIA', role: 'COMPANY_ADMIN', flag: 'canResolveDivergence', esperado: true },
    { status: 'RECEBIDA_COM_DIVERGENCIA', role: 'FORNECEDOR', flag: 'canResolveDivergence', esperado: false },
    { status: 'RECEBIDA_CONFORME', role: 'COMPRADOR', flag: 'canResolveDivergence', esperado: false },

    // canMarkDelivered — só FORNECEDOR, EM_EXECUCAO e já despachada.
    { status: 'EM_EXECUCAO', role: 'FORNECEDOR', flag: 'canMarkDelivered', esperado: true, extra: { dispatchedAt: '2026-01-02' } },
    { status: 'EM_EXECUCAO', role: 'FORNECEDOR', flag: 'canMarkDelivered', esperado: false }, // sem dispatchedAt
  ];

  for (const c of CENARIOS) {
    it(`status=${c.status} role=${c.role} extra=${JSON.stringify(c.extra || {})} → ${String(c.flag)} deve ser ${c.esperado}`, () => {
      const component = montar(poBase({ status: c.status, ...c.extra }), c.role);
      expect(component[c.flag]).toBe(c.esperado as never);
    });
  }

  it('canCreditNote: FORNECEDOR ou ADMIN_SISTEMA, só quando a PO já tem fatura', () => {
    const semFatura = montar(poBase({ status: 'PAGA' }), 'FORNECEDOR');
    expect(semFatura.canCreditNote).toBeFalse();

    const comFatura = montar(
      poBase({
        status: 'PAGA',
        invoice: {
          id: 'inv1', reference: 'FAT-1', amount: '1000', currency: 'AOA', status: 'PAGA',
          issuedAt: '2026-01-01', dueAt: '2026-01-08', creditNotes: [], lines: [],
        },
      }),
      'FORNECEDOR',
    );
    expect(comFatura.canCreditNote).toBeTrue();

    const compradorComFatura = montar(
      poBase({
        status: 'PAGA',
        invoice: {
          id: 'inv1', reference: 'FAT-1', amount: '1000', currency: 'AOA', status: 'PAGA',
          issuedAt: '2026-01-01', dueAt: '2026-01-08', creditNotes: [], lines: [],
        },
      }),
      'COMPRADOR',
    );
    expect(compradorComFatura.canCreditNote).toBeFalse();
  });
});
