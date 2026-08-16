// tests/alerta-operacional.test.js
// Quando um trabalho automático falha, alguém é avisado.
//
// O QUE ISTO CORRIGE. Os quatro trabalhos agendados já tratavam os seus erros —
// escreviam no registo e deixavam rasto na auditoria — e nenhum AVISAVA
// ninguém. O painel de Prontidão marca falha quando a última cópia tem mais de
// 48 horas, mas é um sinal pendurado à espera de que alguém passe por lá. Entre
// a cópia parar e alguém abrir o painel podem passar semanas, e é nesse
// intervalo que a cópia faz falta.
//
// O QUE ESTES TESTES PROTEGEM é sobretudo o ARREFECIMENTO. Enviar o email é a
// parte fácil; não enviar quarenta e oito emails iguais por dia é a parte que
// se estraga sozinha. Quarenta e oito avisos idênticos leem-se como zero.

const { prisma } = require('./helpers');
const alerta = require('../src/services/alertaOperacionalService');
const config = require('../src/config/env');
const notificationService = require('../src/services/notificationService');

const ASSUNTO = 'TESTE_ALERTA';

async function limpar() {
  await prisma.auditLog.deleteMany({ where: { action: alerta.ACAO, entityRef: { startsWith: 'TESTE_' } } });
}

beforeEach(limpar);
afterAll(async () => { await limpar(); await prisma.$disconnect(); });

describe('Sem email configurado', () => {
  test('não rebenta — diz porque não enviou', async () => {
    // Em testes o provider é 'console'. O painel de Prontidão já assinala esta
    // configuração em falta com muito mais contexto do que este aviso daria.
    const r = await alerta.avisarFalha(ASSUNTO, 'teste', 'detalhe');
    expect(r.enviado).toBe(false);
    expect(r.motivo).toMatch(/email/i);
  });
});

describe('Com email configurado', () => {
  let original;
  let espia;

  beforeEach(() => {
    original = { apenasLog: config.email.apenasLog, missing: config.email.missing };
    config.email.apenasLog = false;
    config.email.missing = [];
    espia = jest.spyOn(notificationService, 'enviarEmailDireto').mockResolvedValue({ provider: 'teste' });
  });
  afterEach(() => {
    config.email.apenasLog = original.apenasLog;
    config.email.missing = original.missing;
    espia.mockRestore();
  });

  test('avisa TODOS os administradores do sistema ativos', async () => {
    const quantos = await prisma.user.count({ where: { role: 'ADMIN_SISTEMA', active: true } });
    expect(quantos).toBeGreaterThan(0);

    const r = await alerta.avisarFalha(ASSUNTO, 'a cópia falhou', 'sem espaço em disco');
    expect(r.enviado).toBe(true);
    expect(espia).toHaveBeenCalledTimes(quantos);

    // O assunto do email tem de dizer o que aconteceu, não só "KIXIMA".
    const [, assuntoEmail, corpo] = espia.mock.calls[0];
    expect(assuntoEmail).toMatch(/cópia falhou/);
    expect(corpo).toMatch(/sem espaço em disco/);
  });

  test('o SEGUNDO aviso do mesmo assunto não sai', async () => {
    // A verificação de atraso da cópia corre de trinta em trinta minutos. Sem
    // isto, uma falha persistente daria 48 emails por dia.
    await alerta.avisarFalha(ASSUNTO, 'primeira', 'detalhe');
    espia.mockClear();

    const segunda = await alerta.avisarFalha(ASSUNTO, 'segunda', 'detalhe');
    expect(segunda.enviado).toBe(false);
    expect(segunda.motivo).toMatch(/avisado/i);
    expect(espia).toHaveBeenCalledTimes(0);
  });

  test('assuntos DIFERENTES não se silenciam um ao outro', async () => {
    // A cópia de segurança falhar não pode esconder que a retenção também
    // falhou — são problemas distintos, com respostas distintas.
    await alerta.avisarFalha('TESTE_A', 'a', 'detalhe');
    espia.mockClear();

    const outro = await alerta.avisarFalha('TESTE_B', 'b', 'detalhe');
    expect(outro.enviado).toBe(true);
    expect(espia).toHaveBeenCalled();
  });

  test('o arrefecimento sobrevive a um reinício do processo', async () => {
    // É por isto que o registo vive na BASE e não numa variável do processo: no
    // plano gratuito o contentor reinicia sozinho, e um contador em memória
    // reiniciava com ele — devolvendo a enxurrada que se queria evitar.
    await alerta.avisarFalha(ASSUNTO, 'antes', 'detalhe');

    // Simula o reinício: recarrega o módulo com o registo intacto na base.
    jest.resetModules();
    const recarregado = require('../src/services/alertaOperacionalService');

    const depois = await recarregado.avisarFalha(ASSUNTO, 'depois', 'detalhe');
    expect(depois.enviado).toBe(false);
    expect(depois.motivo).toMatch(/avisado/i);
  });

  test('se o email falhar, NÃO conta como avisado', async () => {
    // Gravar o arrefecimento antes de o email sair faria o silêncio começar a
    // contar por um aviso que ninguém recebeu — exatamente o pior resultado.
    espia.mockRejectedValueOnce(new Error('Brevo recusou'));
    const r = await alerta.avisarFalha(ASSUNTO, 'falha', 'detalhe');
    expect(r.enviado).toBe(false);

    const registos = await prisma.auditLog.count({ where: { action: alerta.ACAO, entityRef: ASSUNTO } });
    expect(registos).toBe(0);
  });

  test('falhar a avisar não propaga exceção para quem chamou', async () => {
    // O trabalho que falhou já falhou. Rebentar aqui acrescentaria um segundo
    // problema por cima do primeiro, e apagaria o registo do primeiro.
    espia.mockRejectedValueOnce(new Error('rede em baixo'));
    await expect(alerta.avisarFalha(ASSUNTO, 'x', 'y')).resolves.toBeDefined();
  });
});
