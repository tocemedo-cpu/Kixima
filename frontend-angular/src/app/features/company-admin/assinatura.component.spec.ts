import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AssinaturaComponent } from './assinatura.component';
import { AssinaturaService } from './assinatura.service';
import { AuthService } from '../../core/services/auth.service';
import { AssinaturaEstado, OpcaoPlano, PlanoCobrancaDto } from '../../core/models/assinatura.model';
import { KiximaUser, PersonaRole } from '../../core/models/user.model';
import { ApiError } from '../../core/models/api-error.model';

function utilizador(role: PersonaRole): KiximaUser {
  return { id: 'u1', name: 'Ana', email: 'a@a.co.ao', role, adminAreas: [], companyId: 'c1', companyType: 'CLIENTE', avatarUrl: null };
}

function estado(overrides: Partial<AssinaturaEstado> = {}): AssinaturaEstado {
  return {
    empresa: { id: 'c1', name: 'Petro Angola' },
    banco: { iban: 'AO06...', moeda: 'USD', configurado: true },
    planoAtual: 'CORE',
    validoAte: '2026-12-01T00:00:00Z',
    diasAteExpirar: 60,
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

function cobranca(overrides: Partial<PlanoCobrancaDto> = {}): PlanoCobrancaDto {
  return {
    id: 'cob1', referencia: 'ASS-001', companyId: 'c1', planoAtual: 'CORE', planoNovo: 'PRO',
    valorUsd: '5000', periodo: 'ANUAL', meses: 12, status: 'PENDENTE',
    createdById: 'u1', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...overrides,
  };
}

function montar(role: PersonaRole = 'COMPANY_ADMIN') {
  // Alguns testes montam mais do que um componente na mesma função `it`
  // (ex.: podeEscolherPlano compara dois papéis) — sem isto, a segunda
  // chamada a configureTestingModule falha porque o TestBed já foi
  // instanciado pela primeira.
  TestBed.resetTestingModule();
  const assinaturaService = jasmine.createSpyObj<AssinaturaService>('AssinaturaService', [
    'estado', 'canais', 'pedir', 'pagarCom', 'comprovativo', 'cancelar',
  ]);
  assinaturaService.estado.and.returnValue(of(estado()));
  assinaturaService.canais.and.returnValue(of({}));
  const auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
  auth.user.and.returnValue(utilizador(role));
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new AssinaturaComponent(auth, assinaturaService));
  return { componente, assinaturaService };
}

describe('AssinaturaComponent', () => {
  it('carrega o estado e os canais ao construir', () => {
    const { componente, assinaturaService } = montar();
    expect(assinaturaService.estado).toHaveBeenCalled();
    expect(assinaturaService.canais).toHaveBeenCalled();
    expect(componente.data()?.planoAtual).toBe('CORE');
  });

  it('podeEscolherPlano é true só para COMPANY_ADMIN', () => {
    expect(montar('COMPANY_ADMIN').componente.podeEscolherPlano).toBeTrue();
    expect(montar('FINANCEIRO').componente.podeEscolherPlano).toBeFalse();
  });

  it('regista o erro quando GET /api/assinatura falha', () => {
    const assinaturaService = jasmine.createSpyObj<AssinaturaService>('AssinaturaService', [
      'estado', 'canais', 'pedir', 'pagarCom', 'comprovativo', 'cancelar',
    ]);
    assinaturaService.estado.and.returnValue(throwError(() => new ApiError('Falha ao carregar.', 500)));
    assinaturaService.canais.and.returnValue(of({}));
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    auth.user.and.returnValue(utilizador('COMPANY_ADMIN'));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(() => new AssinaturaComponent(auth, assinaturaService));
    expect(componente.error()).toBe('Falha ao carregar.');
  });

  it('quando canais() falha, cai num objeto vazio (canais em falta não travam a página)', () => {
    const assinaturaService = jasmine.createSpyObj<AssinaturaService>('AssinaturaService', [
      'estado', 'canais', 'pedir', 'pagarCom', 'comprovativo', 'cancelar',
    ]);
    assinaturaService.estado.and.returnValue(of(estado()));
    assinaturaService.canais.and.returnValue(throwError(() => new ApiError('boom', 500)));
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    auth.user.and.returnValue(utilizador('COMPANY_ADMIN'));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(() => new AssinaturaComponent(auth, assinaturaService));
    expect(componente.canais()).toEqual({});
  });

  it('pedir() sem perdas não pede confirmação', () => {
    const { componente, assinaturaService } = montar();
    assinaturaService.pedir.and.returnValue(of(cobranca({ referencia: 'ASS-002' })));
    spyOn(window, 'confirm');
    const opcao: OpcaoPlano = { plano: 'PRO', preco: { valorUsd: 5000, periodo: 'ANUAL', meses: 12, porMesUsd: 416.67 }, features: {} as never, atual: false, direcao: 'SUBIR' };
    componente.pedirComAviso(opcao);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(assinaturaService.pedir).toHaveBeenCalledWith({ plano: 'PRO', aceitaPerdas: false });
    expect(componente.aviso()).toBe('Cobrança ASS-002 emitida. Faça a transferência e carregue o comprovativo aqui.');
  });

  it('pedir() com perdas só avança se a pessoa confirmar, e envia aceitaPerdas=true', () => {
    const { componente, assinaturaService } = montar();
    assinaturaService.pedir.and.returnValue(of(cobranca()));
    spyOn(window, 'confirm').and.returnValue(true);
    const opcao: OpcaoPlano = {
      plano: 'BASE', preco: { valorUsd: 100, periodo: 'MENSAL', meses: 1, porMesUsd: 100 },
      features: {} as never, atual: false, direcao: 'DESCER',
      perdas: [{ label: 'utilizadores', quantidade: 5, consequencia: 'serão desativados' }],
    };
    componente.pedirComAviso(opcao);
    expect(window.confirm).toHaveBeenCalled();
    expect(assinaturaService.pedir).toHaveBeenCalledWith({ plano: 'BASE', aceitaPerdas: true });
  });

  it('pedir() com perdas não avança se a pessoa cancelar a confirmação', () => {
    const { componente, assinaturaService } = montar();
    spyOn(window, 'confirm').and.returnValue(false);
    const opcao: OpcaoPlano = {
      plano: 'BASE', preco: { valorUsd: 100, periodo: 'MENSAL', meses: 1, porMesUsd: 100 },
      features: {} as never, atual: false, direcao: 'DESCER',
      perdas: [{ label: 'utilizadores', quantidade: 5, consequencia: 'serão desativados' }],
    };
    componente.pedirComAviso(opcao);
    expect(assinaturaService.pedir).not.toHaveBeenCalled();
  });

  it('pagarComGateway() pede telemóvel para EMIS_MULTICAIXA e envia no pedido', () => {
    const { componente, assinaturaService } = montar();
    assinaturaService.pagarCom.and.returnValue(of(cobranca({ canal: 'EMIS_MULTICAIXA' })));
    spyOn(window, 'prompt').and.returnValue('923456789');
    componente.pagarComGateway('cob1', 'EMIS_MULTICAIXA');
    expect(window.prompt).toHaveBeenCalled();
    expect(assinaturaService.pagarCom).toHaveBeenCalledWith('cob1', { canal: 'EMIS_MULTICAIXA', telemovel: '923456789' });
  });

  it('pagarComGateway() não chama o serviço se a pessoa cancelar o prompt do telemóvel', () => {
    const { componente, assinaturaService } = montar();
    spyOn(window, 'prompt').and.returnValue(null);
    componente.pagarComGateway('cob1', 'EMIS_MULTICAIXA');
    expect(assinaturaService.pagarCom).not.toHaveBeenCalled();
  });

  it('pagarComGateway() não pede telemóvel para canais bancários (BAI/BFA)', () => {
    const { componente, assinaturaService } = montar();
    assinaturaService.pagarCom.and.returnValue(of(cobranca({ canal: 'BAI' })));
    spyOn(window, 'prompt');
    componente.pagarComGateway('cob1', 'BAI');
    expect(window.prompt).not.toHaveBeenCalled();
    expect(assinaturaService.pagarCom).toHaveBeenCalledWith('cob1', { canal: 'BAI', telemovel: undefined });
  });

  it('pagarComGateway() mostra uma mensagem amigável quando o gateway devolve 500 (sem credenciais configuradas)', () => {
    const { componente, assinaturaService } = montar();
    assinaturaService.pagarCom.and.returnValue(throwError(() => new ApiError('Internal Server Error', 500, 'INTERNAL_ERROR')));
    spyOn(window, 'prompt').and.returnValue('923456789');
    componente.pagarComGateway('cob1', 'EMIS_MULTICAIXA');
    expect(componente.error()).toBe('Não foi possível iniciar o pagamento por este canal agora. Tente novamente mais tarde ou pague por transferência bancária.');
  });

  it('pagarComGateway() mostra a mensagem real do servidor para erros que não sejam 500', () => {
    const { componente, assinaturaService } = montar();
    assinaturaService.pagarCom.and.returnValue(throwError(() => new ApiError('Cobrança já confirmada.', 409)));
    spyOn(window, 'prompt').and.returnValue('923456789');
    componente.pagarComGateway('cob1', 'EMIS_MULTICAIXA');
    expect(componente.error()).toBe('Cobrança já confirmada.');
  });

  it('cancelar() pede o motivo e só cancela se for indicado', () => {
    const { componente, assinaturaService } = montar();
    assinaturaService.cancelar.and.returnValue(of(cobranca({ status: 'CANCELADA' })));
    spyOn(window, 'prompt').and.returnValue('Pedido por engano');
    componente.cancelar('cob1');
    expect(assinaturaService.cancelar).toHaveBeenCalledWith('cob1', { motivo: 'Pedido por engano' });
  });

  it('cancelar() não chama o serviço se o motivo ficar vazio', () => {
    const { componente, assinaturaService } = montar();
    spyOn(window, 'prompt').and.returnValue(null);
    componente.cancelar('cob1');
    expect(assinaturaService.cancelar).not.toHaveBeenCalled();
  });

  it('textoImpedimento() monta a frase de DIMENSAO_EXIGE_PLANO', () => {
    const { componente } = montar();
    const opcao: OpcaoPlano = {
      plano: 'PRO', preco: { valorUsd: 5000, periodo: 'ANUAL', meses: 12, porMesUsd: 416.67 },
      features: {} as never, atual: false, direcao: 'SUBIR',
      impedimento: { codigo: 'DIMENSAO_EXIGE_PLANO', dimensao: 'GRANDE', minimo: 'PRO' },
    };
    expect(componente.textoImpedimento(opcao)).toBe('Empresas de dimensão GRANDE têm de subscrever o plano PRO.');
  });

  it('textoImpedimento() monta a frase de lugares insuficientes para outros códigos', () => {
    const { componente } = montar();
    const opcao: OpcaoPlano = {
      plano: 'BASE', preco: { valorUsd: 100, periodo: 'MENSAL', meses: 1, porMesUsd: 100 },
      features: {} as never, atual: false, direcao: 'DESCER',
      impedimento: { codigo: 'LUGARES_INSUFICIENTES', plano: 'BASE', lugares: 3, ocupados: 5 },
    };
    expect(componente.textoImpedimento(opcao)).toContain('3 lugares');
    expect(componente.textoImpedimento(opcao)).toContain('5');
  });

  it('documentosLabel() usa singular quando documentosPorItem é 1', () => {
    const { componente } = montar();
    const opcao = { features: { imagensPorItem: 5, documentosPorItem: 1 } } as OpcaoPlano;
    expect(componente.documentosLabel(opcao)).toBe('5 imagens e 1 documento por item');
  });

  it('documentosLabel() usa plural quando documentosPorItem é diferente de 1', () => {
    const { componente } = montar();
    const opcao = { features: { imagensPorItem: 5, documentosPorItem: 3 } } as OpcaoPlano;
    expect(componente.documentosLabel(opcao)).toBe('5 imagens e 3 documentos por item');
  });
});
