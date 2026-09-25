import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CobrancasComponent } from './cobrancas.component';
import { AssinaturaService } from '../company-admin/assinatura.service';
import { AddonsService } from './addons.service';
import { AddonCobrancaDto, AssinaturaFila, AddonsFila, PlanoCobrancaDto } from '../../core/models/assinatura.model';
import { ApiError } from '../../core/models/api-error.model';

function cobranca(overrides: Partial<PlanoCobrancaDto> = {}): PlanoCobrancaDto {
  return {
    id: 'cob1', referencia: 'SUB-001', companyId: 'c1', planoAtual: 'CORE', planoNovo: 'PRO',
    valorUsd: '5000', periodo: 'ANUAL', meses: 12, status: 'PENDENTE',
    createdById: 'u1', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    company: { id: 'c1', name: 'Petro Angola' },
    ...overrides,
  };
}

function addonCobranca(overrides: Partial<AddonCobrancaDto> = {}): AddonCobrancaDto {
  return {
    id: 'add1', referencia: 'ADD-001', companyId: 'c1', addonKey: 'PO_ROBOT',
    valorUsd: '200', periodo: 'MENSAL', meses: 1, status: 'PENDENTE',
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    company: { id: 'c1', name: 'Petro Angola' },
    ...overrides,
  };
}

function fila(overrides: Partial<AssinaturaFila> = {}): AssinaturaFila {
  return {
    emAberto: [cobranca({ status: 'COMPROVATIVO_ENVIADO' }), cobranca({ id: 'cob2', status: 'PENDENTE' })],
    vencidas: [],
    emGrace: [{ id: 'e1', name: 'Empresa Grace', plan: 'CORE', planoValidoAte: '2026-01-01', diasVencida: 3, estadoSubscricao: 'GRACE' }],
    restritas: [{ id: 'e2', name: 'Empresa Restrita', plan: 'BASE', planoValidoAte: '2025-12-01', diasVencida: 30, estadoSubscricao: 'RESTRITA' }],
    porConfirmar: 1,
    porPagar: 1,
    ...overrides,
  };
}

function addonsFila(overrides: Partial<AddonsFila> = {}): AddonsFila {
  return {
    emAberto: [addonCobranca({ status: 'COMPROVATIVO_ENVIADO' }), addonCobranca({ id: 'add2', status: 'PENDENTE' })],
    porConfirmar: 1,
    porPagar: 1,
    ...overrides,
  };
}

function montar() {
  const assinaturaService = jasmine.createSpyObj<AssinaturaService>('AssinaturaService', ['fila', 'confirmar', 'cancelar']);
  const addonsService = jasmine.createSpyObj<AddonsService>('AddonsService', ['catalogo', 'fila', 'confirmar', 'cancelar']);
  assinaturaService.fila.and.returnValue(of(fila()));
  addonsService.fila.and.returnValue(of(addonsFila()));
  addonsService.catalogo.and.returnValue(of([{ addonKey: 'PO_ROBOT', label: 'Automatic PO Robot', requerPlano: 'PRO', preco: { valorUsd: 200, periodo: 'MENSAL', meses: 1, porMesUsd: 200 } }]));
  TestBed.configureTestingModule({});
  const componente = TestBed.runInInjectionContext(() => new CobrancasComponent(assinaturaService, addonsService));
  return { componente, assinaturaService, addonsService };
}

describe('CobrancasComponent', () => {
  it('carrega a fila de assinaturas, de add-ons e o catálogo de add-ons ao arrancar', () => {
    const { componente, assinaturaService, addonsService } = montar();
    expect(assinaturaService.fila).toHaveBeenCalled();
    expect(addonsService.fila).toHaveBeenCalled();
    expect(addonsService.catalogo).toHaveBeenCalled();
    expect(componente.data()?.porConfirmar).toBe(1);
    expect(componente.nomeAddon('PO_ROBOT')).toBe('Automatic PO Robot');
  });

  it('nomeAddon() cai no addonKey quando não está no catálogo', () => {
    const { componente } = montar();
    expect(componente.nomeAddon('DESCONHECIDO')).toBe('DESCONHECIDO');
  });

  it('porConfirmar()/porPagar() dividem emAberto pelo estado', () => {
    const { componente } = montar();
    expect(componente.porConfirmar().length).toBe(1);
    expect(componente.porConfirmar()[0].status).toBe('COMPROVATIVO_ENVIADO');
    expect(componente.porPagar().length).toBe(1);
    expect(componente.porPagar()[0].status).toBe('PENDENTE');
  });

  it('addonsPorConfirmar()/addonsPorPagar() dividem emAberto pelo estado', () => {
    const { componente } = montar();
    expect(componente.addonsPorConfirmar().length).toBe(1);
    expect(componente.addonsPorPagar().length).toBe(1);
  });

  it('confirmar() pede confirmação e nota, depois chama o serviço', () => {
    const { componente, assinaturaService } = montar();
    assinaturaService.confirmar.and.returnValue(of(cobranca({ status: 'CONFIRMADA' })));
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(window, 'prompt').and.returnValue('Confirmado via BAI, 25/09');
    componente.confirmar(cobranca());
    expect(window.confirm).toHaveBeenCalled();
    expect(assinaturaService.confirmar).toHaveBeenCalledWith('cob1', { notas: 'Confirmado via BAI, 25/09' });
    expect(componente.aviso()).toContain('confirmada');
  });

  it('confirmar() não chama o serviço se a pessoa cancelar a confirmação', () => {
    const { componente, assinaturaService } = montar();
    spyOn(window, 'confirm').and.returnValue(false);
    componente.confirmar(cobranca());
    expect(assinaturaService.confirmar).not.toHaveBeenCalled();
  });

  it('cancelar() pede o motivo e chama o serviço', () => {
    const { componente, assinaturaService } = montar();
    assinaturaService.cancelar.and.returnValue(of(cobranca({ status: 'CANCELADA' })));
    spyOn(window, 'prompt').and.returnValue('Pedido por engano');
    componente.cancelar(cobranca());
    expect(assinaturaService.cancelar).toHaveBeenCalledWith('cob1', { motivo: 'Pedido por engano' });
  });

  it('cancelar() não chama o serviço se o motivo ficar vazio', () => {
    const { componente, assinaturaService } = montar();
    spyOn(window, 'prompt').and.returnValue(null);
    componente.cancelar(cobranca());
    expect(assinaturaService.cancelar).not.toHaveBeenCalled();
  });

  it('confirmarAddon() chama AddonsService.confirmar', () => {
    const { componente, addonsService } = montar();
    addonsService.confirmar.and.returnValue(of(addonCobranca({ status: 'CONFIRMADA' })));
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(window, 'prompt').and.returnValue('');
    componente.confirmarAddon(addonCobranca());
    expect(addonsService.confirmar).toHaveBeenCalledWith('add1', { notas: '' });
    expect(componente.aviso()).toContain('Automatic PO Robot');
  });

  it('cancelarAddon() chama AddonsService.cancelar', () => {
    const { componente, addonsService } = montar();
    addonsService.cancelar.and.returnValue(of(addonCobranca({ status: 'CANCELADA' })));
    spyOn(window, 'prompt').and.returnValue('Motivo de teste');
    componente.cancelarAddon(addonCobranca());
    expect(addonsService.cancelar).toHaveBeenCalledWith('add1', { motivo: 'Motivo de teste' });
  });

  it('nomeCanal() traduz o código do canal para o nome comercial', () => {
    const { componente } = montar();
    expect(componente.nomeCanal('EMIS_MULTICAIXA')).toBe('Multicaixa Express');
    expect(componente.nomeCanal('DESCONHECIDO')).toBe('DESCONHECIDO');
  });

  it('regista o erro quando a fila de assinaturas falha', () => {
    const assinaturaService = jasmine.createSpyObj<AssinaturaService>('AssinaturaService', ['fila', 'confirmar', 'cancelar']);
    const addonsService = jasmine.createSpyObj<AddonsService>('AddonsService', ['catalogo', 'fila', 'confirmar', 'cancelar']);
    assinaturaService.fila.and.returnValue(throwError(() => new ApiError('Falha ao carregar.', 500)));
    addonsService.fila.and.returnValue(of(addonsFila()));
    addonsService.catalogo.and.returnValue(of([]));
    TestBed.configureTestingModule({});
    const componente = TestBed.runInInjectionContext(() => new CobrancasComponent(assinaturaService, addonsService));
    expect(componente.error()).toBe('Falha ao carregar.');
  });
});
