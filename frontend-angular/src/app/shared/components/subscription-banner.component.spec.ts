import { SubscriptionBannerComponent } from './subscription-banner.component';
import { AssinaturaEstado } from '../../core/models/assinatura.model';

function estado(overrides: Partial<AssinaturaEstado> = {}): AssinaturaEstado {
  return {
    empresa: { id: 'c1', name: 'Petro Angola' },
    banco: { iban: 'AO06...', moeda: 'USD', configurado: true },
    planoAtual: 'CORE',
    validoAte: null,
    diasAteExpirar: null,
    expirada: false,
    estadoSubscricao: 'ATIVA',
    graceDiasRestantes: null,
    lugaresOcupados: 3,
    lugaresIncluidos: 10,
    emAberto: null,
    historico: [],
    opcoes: [],
    ...overrides,
  };
}

describe('SubscriptionBannerComponent', () => {
  it('texto fica vazio sem dados', () => {
    const c = new SubscriptionBannerComponent();
    expect(c.texto).toBe('');
  });

  it('A_EXPIRAR mostra os dias restantes e o plano, classe warn', () => {
    const c = new SubscriptionBannerComponent();
    c.data = estado({ estadoSubscricao: 'A_EXPIRAR', diasAteExpirar: 5, planoAtual: 'CORE' });
    expect(c.texto).toContain('5 dias');
    expect(c.texto).toContain('CORE');
    expect(c.classe).toBe('warn');
  });

  it('GRACE explica que os dados continuam seguros, classe danger', () => {
    const c = new SubscriptionBannerComponent();
    c.data = estado({ estadoSubscricao: 'GRACE' });
    expect(c.texto).toContain('Os seus dados continuam seguros');
    expect(c.classe).toBe('danger');
  });

  it('RESTRITA avisa sobre recursos pagos bloqueados, classe danger', () => {
    const c = new SubscriptionBannerComponent();
    c.data = estado({ estadoSubscricao: 'RESTRITA' });
    expect(c.texto).toContain('bloqueados');
    expect(c.classe).toBe('danger');
  });
});
