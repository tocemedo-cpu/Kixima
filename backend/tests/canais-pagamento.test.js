// tests/canais-pagamento.test.js
// PayPay e os adaptadores bancários (BAI/BFA/Standard Bank Angola) — o mesmo
// contrato que o Multicaixa Express já tem (ver conciliacao.test.js): sem
// credenciais reais, RECUSAM-SE a fingir sucesso.
const paypay = require('../src/services/paypayService');
const bancoGatewayService = require('../src/services/bancoGatewayService');
const canaisPagamentoService = require('../src/services/canaisPagamentoService');

describe('PayPay', () => {
  test('sem credenciais, recusa-se em vez de fingir', async () => {
    expect(paypay.disponivel()).toBe(false);
    await expect(paypay.pedirPagamento({ referencia: 'SUB-TESTE', valor: 1, moeda: 'USD', telemovel: '900000000' }))
      .rejects.toThrow(/não está configurado/i);
  });

  test('diz o que falta, em vez de falhar sem explicação', () => {
    const e = paypay.estado();
    expect(e.disponivel).toBe(false);
    expect(e.emFalta.length).toBeGreaterThan(0);
    expect(e.nota).toMatch(/por confirmar/i);
  });

  test('callback sem identificador de transação é rejeitado antes de chamar a PayPay', async () => {
    // A validação do payload acontece DEPOIS de exigirConfiguracao() — sem
    // credenciais, é sempre essa a primeira a soar, e é o comportamento certo:
    // um canal por ligar não deve sequer tentar interpretar o que recebeu.
    await expect(paypay.confirmarCallback({})).rejects.toThrow(/não está configurado/i);
  });
});

describe('Bancos (BAI, BFA, Standard Bank Angola) — adaptador genérico', () => {
  test.each(['BAI', 'BFA', 'STANDARD_BANK_ANGOLA'])('%s: sem credenciais, recusa-se em vez de fingir', async (codigo) => {
    const adaptador = bancoGatewayService.criarAdaptador(codigo);
    expect(adaptador.disponivel()).toBe(false);
    await expect(adaptador.pedirPagamento({ referencia: 'SUB-TESTE', valor: 1, moeda: 'USD' }))
      .rejects.toThrow(/não está configurado/i);
  });

  test('banco desconhecido é rejeitado explicitamente', () => {
    expect(() => bancoGatewayService.criarAdaptador('BANCO_INVENTADO')).toThrow(/desconhecido/i);
  });

  test('cada banco fica isolado (variáveis de ambiente não se confundem)', () => {
    const bai = bancoGatewayService.criarAdaptador('BAI').estado();
    const bfa = bancoGatewayService.criarAdaptador('BFA').estado();
    expect(bai.canal).toBe('BAI');
    expect(bfa.canal).toBe('BFA');
  });
});

describe('canaisPagamentoService — ponto único de mapeamento', () => {
  test('conhece os cinco canais automáticos, todos indisponíveis sem credenciais', () => {
    const estados = canaisPagamentoService.estados();
    expect(Object.keys(estados).sort()).toEqual(
      ['BAI', 'BFA', 'EMIS_MULTICAIXA', 'PAYPAY', 'STANDARD_BANK_ANGOLA'].sort(),
    );
    for (const canal of canaisPagamentoService.CANAIS_GATEWAY) {
      expect(estados[canal].disponivel).toBe(false);
    }
  });

  test('devolve null para a transferência manual — não passa por nenhum adaptador', () => {
    expect(canaisPagamentoService.adaptador('TRANSFERENCIA_MANUAL')).toBeNull();
  });
});
