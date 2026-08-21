// src/domain.test.js
import { describe, test, expect } from 'vitest';
import {
  formatMoney, computeCartTotals, IVA_RATE, WITHHOLDING_RATE,
  ROLE_HOME, PO_STATUS, resolverDestinoNotificacao,
} from './domain';

describe('formatMoney', () => {
  test('mostra o Kwanza como "Kz" com 2 casas decimais', () => {
    const out = formatMoney(1250000, 'AOA');
    expect(out).toMatch(/Kz$/);
    expect(out).toMatch(/,00/); // duas casas decimais
    expect(out.replace(/\s| /g, '')).toMatch(/1.?250.?000,00Kz/);
  });
  test('null/undefined → 0,00 Kz', () => {
    expect(formatMoney(null)).toMatch(/0,00 Kz/);
    expect(formatMoney(undefined)).toMatch(/0,00 Kz/);
  });
  test('outra moeda usa o próprio código', () => {
    expect(formatMoney(100, 'USD')).toMatch(/USD$/);
  });
});

describe('taxas (modelo fiscal Angola)', () => {
  test('IVA 14% e retenção na fonte 6,5%', () => {
    expect(IVA_RATE).toBe(0.14);
    expect(WITHHOLDING_RATE).toBe(0.065);
  });
  // A Taxa KIXIMA é cobrada ao FORNECEDOR e calculada no servidor. Não entra na
  // cesta do comprador — nem como linha, nem no total.
  test('computeCartTotals soma só o IVA, sem Taxa KIXIMA', () => {
    const r = computeCartTotals(1000000);
    expect(r.iva).toBe(140000);
    expect(r.total).toBe(1140000);
    expect(r).not.toHaveProperty('fee');
  });
});

describe('mapas de domínio', () => {
  test('cada papel tem uma home', () => {
    for (const role of ['COMPRADOR', 'COMPANY_ADMIN', 'FORNECEDOR', 'FINANCEIRO', 'ADMIN_SISTEMA']) {
      expect(typeof ROLE_HOME[role]).toBe('string');
      expect(ROLE_HOME[role].startsWith('/')).toBe(true);
    }
  });
  test('estados da PO têm rótulo', () => {
    expect(PO_STATUS.PAGA).toBeTruthy();
  });
});

// Evento -> cria notificação -> aparece -> clique -> identifica o tipo ->
// obtém o recurso relacionado -> [marca como lida, feito por quem chama] ->
// navega para a página certa. Esta função só cobre a parte de identificar +
// navegar; cada papel tem a SUA página para o mesmo recurso (ver comentário
// em domain.js) — por isso os testes cobrem papel a papel, não só tipo a tipo.
describe('resolverDestinoNotificacao', () => {
  test('sem notificação ou sem utilizador: null', () => {
    expect(resolverDestinoNotificacao(null, { role: 'COMPRADOR' })).toBeNull();
    expect(resolverDestinoNotificacao({ relatedEntityType: 'PurchaseOrder', relatedEntityId: '1' }, null)).toBeNull();
  });

  describe('PurchaseOrder — mesma PO, página diferente por papel', () => {
    const n = { relatedEntityType: 'PurchaseOrder', relatedEntityId: 'po-1' };
    test('Comprador', () => {
      expect(resolverDestinoNotificacao(n, { role: 'COMPRADOR' })).toBe('/comprador/ordens/po-1');
    });
    test('Company Admin', () => {
      expect(resolverDestinoNotificacao(n, { role: 'COMPANY_ADMIN' })).toBe('/empresa/aprovacoes/po-1');
    });
    test('Fornecedor', () => {
      expect(resolverDestinoNotificacao(n, { role: 'FORNECEDOR' })).toBe('/fornecedor/ordens/po-1');
    });
    test('Financeiro', () => {
      expect(resolverDestinoNotificacao(n, { role: 'FINANCEIRO' })).toBe('/financeiro/ordens/po-1');
    });
    test('Admin do Sistema não participa do ciclo de vida da PO: sem destino', () => {
      expect(resolverDestinoNotificacao(n, { role: 'ADMIN_SISTEMA' })).toBeNull();
    });
    test('sem relatedEntityId: sem destino, mesmo com o tipo certo', () => {
      expect(resolverDestinoNotificacao({ relatedEntityType: 'PurchaseOrder' }, { role: 'COMPRADOR' })).toBeNull();
    });
  });

  test('Invoice: só o Financeiro (comprador) tem destino', () => {
    const n = { relatedEntityType: 'Invoice', relatedEntityId: 'inv-1' };
    expect(resolverDestinoNotificacao(n, { role: 'FINANCEIRO' })).toBe('/financeiro/faturas');
    expect(resolverDestinoNotificacao(n, { role: 'FORNECEDOR' })).toBeNull();
  });

  test('Payment: Fornecedor vai aos pagamentos, Company Admin cai na home', () => {
    const n = { relatedEntityType: 'Payment', relatedEntityId: 'pay-1' };
    expect(resolverDestinoNotificacao(n, { role: 'FORNECEDOR' })).toBe('/fornecedor/pagamentos');
    expect(resolverDestinoNotificacao(n, { role: 'COMPANY_ADMIN' })).toBe('/empresa');
  });

  test('PlanoCobranca: Company Admin e Financeiro vão à assinatura', () => {
    const n = { relatedEntityType: 'PlanoCobranca', relatedEntityId: 'cob-1' };
    expect(resolverDestinoNotificacao(n, { role: 'COMPANY_ADMIN' })).toBe('/empresa/assinatura');
    expect(resolverDestinoNotificacao(n, { role: 'FINANCEIRO' })).toBe('/empresa/assinatura');
    expect(resolverDestinoNotificacao(n, { role: 'COMPRADOR' })).toBeNull();
  });

  test('SupportTicket: abre o chat já no ticket certo', () => {
    const n = { relatedEntityType: 'SupportTicket', relatedEntityId: 'tk-1' };
    expect(resolverDestinoNotificacao(n, { role: 'COMPRADOR' })).toBe('/suporte/chat?ticket=tk-1');
  });

  test('Conversation: abre o chat comercial já na conversa certa', () => {
    const n = { relatedEntityType: 'Conversation', relatedEntityId: 'conv-1' };
    expect(resolverDestinoNotificacao(n, { role: 'FORNECEDOR' })).toBe('/mensagens/chat-comercial?c=conv-1');
  });

  test('SupplierDevRequest: só o Admin do Sistema (único notificado)', () => {
    const n = { relatedEntityType: 'SupplierDevRequest', relatedEntityId: 'sd-1' };
    expect(resolverDestinoNotificacao(n, { role: 'ADMIN_SISTEMA' })).toBe('/sistema/supplier-development');
    expect(resolverDestinoNotificacao(n, { role: 'FORNECEDOR' })).toBeNull();
  });

  describe('tipos sem recurso próprio — cai na página onde o assunto vive', () => {
    test('apólice submetida/aprovada e a expirar', () => {
      for (const type of ['APOLICE_SUBMETIDA_APROVADA', 'APOLICE_A_EXPIRAR']) {
        expect(resolverDestinoNotificacao({ type }, { role: 'COMPANY_ADMIN' })).toBe('/empresa/documentos');
        expect(resolverDestinoNotificacao({ type }, { role: 'FINANCEIRO' })).toBe('/empresa/documentos');
        expect(resolverDestinoNotificacao({ type }, { role: 'COMPRADOR' })).toBeNull();
      }
    });
    test('cadastro de empresa aprovado/rejeitado', () => {
      for (const type of ['CADASTRO_EMPRESA_APROVADO', 'CADASTRO_EMPRESA_REJEITADO']) {
        expect(resolverDestinoNotificacao({ type }, { role: 'COMPANY_ADMIN' })).toBe('/empresa/perfil');
      }
    });
    test('alerta de segurança: só o Admin do Sistema', () => {
      expect(resolverDestinoNotificacao({ type: 'ALERTA_SEGURANCA' }, { role: 'ADMIN_SISTEMA' })).toBe('/sistema/alertas-seguranca');
      expect(resolverDestinoNotificacao({ type: 'ALERTA_SEGURANCA' }, { role: 'COMPANY_ADMIN' })).toBeNull();
    });
    test('tipo desconhecido: null, nunca um erro', () => {
      expect(resolverDestinoNotificacao({ type: 'ALGO_QUE_NAO_EXISTE' }, { role: 'COMPRADOR' })).toBeNull();
    });
  });
});
