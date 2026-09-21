// tests/agt-serie-payload.test.js
// GET /api/faturacao/agt-serie-payload — "Solicitar Série" (AGT DS.120, 4.5).
// Constrói e assina o pedido (agtSeriesService.construirPedidoSerie), depois
// SUBMETE-O mesmo à AGT via agtSeriesService.solicitarSerie(), que reaproveita
// agtSandboxClient.js como transporte — mockado aqui (não há rede real nos
// testes; agtSandboxClient.js já tem os seus próprios testes de transporte).
//
// POR EMPRESA FORNECEDORA: o ecrã indica `supplierCompanyId`, ano e
// tipoDocumento — o NIF vem do `Company.taxId` dessa empresa (nunca de uma
// conta partilhada — ver o comentário em faturacaoRoutes.js sobre a recusa
// real da AGT quando o NIF do pedido de série e o NIF do documento
// divergiam). O estabelecimento continua a vir de AGT_ESTABLISHMENT_NUMBER
// (nunca um valor fixo no código — ver o comentário sobre o erro real "E99"
// que um "1" adivinhado causou), e o indicador de contingência é sempre "N"
// (único valor usado neste ambiente). "1" aqui em baixo é só o valor de
// TESTE atribuído a AGT_ESTABLISHMENT_NUMBER, não um valor fixo no código de
// produção.
//
// Mesmo cuidado de agt-payload.test.js: a configuração (chave privada RSA) é
// lida UMA VEZ ao carregar os módulos, por isso é injetada em process.env
// ANTES de qualquer require dos serviços.
const crypto = require('crypto');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.AGT_JWS_PRIVATE_KEY_BASE64 = Buffer.from(privateKey).toString('base64');
process.env.AGT_SOFTWARE_VALIDATION_NUMBER = 'FE/00/2025/AGT-TESTE';
process.env.AGT_NIF = '5001636863';
process.env.AGT_ESTABLISHMENT_NUMBER = '1';
process.env.AGT_SANDBOX_USERNAME = 'ws.hml.teste';
process.env.AGT_SANDBOX_PASSWORD = 'senha-teste';

jest.mock('../src/services/agtSandboxClient');

const agtSandboxClient = require('../src/services/agtSandboxClient');
const { request, app, auth, prisma, loginAll } = require('./helpers');

function base64urlParaBuffer(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verificarJWS(jws) {
  const [h, p, s] = jws.split('.');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`, 'utf8'), publicKey, base64urlParaBuffer(s));
  return { ok, payload: JSON.parse(base64urlParaBuffer(p).toString('utf8')) };
}

// Formato REAL confirmado em produção (HML) — a AGT devolve resultCode=1
// (não "0") mesmo quando aceita; o sucesso vem de seriesFEResult.seriesCode
// existir (ver agtSandboxClient.solicitarSerie()). agtSandboxClient está
// mockado neste ficheiro, por isso este RESPOSTA_AGT só precisa de refletir
// a forma real — o predicado de sucesso em si já tem os seus próprios
// testes em agt-sandbox-client.test.js.
const RESPOSTA_AGT = {
  resultCode: 1,
  errorList: [''],
  seriesFEResult: {
    seriesCode: 'FT-2026-01', authorizedQuantity: '999999999999', firstDocumentNo: '1', lastDocumentNo: '999999999999',
  },
};

let tokens;
let supplierCompanyId;
let taxIdOriginal;

beforeAll(async () => {
  tokens = await loginAll();
  // A série pertence ao NIF da empresa fornecedora — usa-se a do fixture de
  // testes (fornecedor@kianda.co.ao), com o NIF temporariamente ajustado para
  // o valor que este ficheiro já assertava em todo o lado ('5001636863'),
  // restaurado no fim.
  const user = await prisma.user.findUnique({ where: { email: 'fornecedor@kianda.co.ao' } });
  supplierCompanyId = user.companyId;
  const empresa = await prisma.company.findUnique({ where: { id: supplierCompanyId }, select: { taxId: true } });
  taxIdOriginal = empresa.taxId;
  await prisma.company.update({ where: { id: supplierCompanyId }, data: { taxId: '5001636863' } });
});

afterAll(async () => {
  await prisma.company.update({ where: { id: supplierCompanyId }, data: { taxId: taxIdOriginal } });
  await prisma.$disconnect();
});

beforeEach(() => {
  agtSandboxClient.disponivel.mockReturnValue(true);
  agtSandboxClient.emFalta.mockReturnValue([]);
  agtSandboxClient.solicitarSerie.mockResolvedValue(RESPOSTA_AGT);
});

function pedir(token, params) {
  return auth(token).get('/api/faturacao/agt-serie-payload').query(params);
}

const PARAMS_VALIDOS = () => ({ ano: '2026', tipoDocumento: 'FT', supplierCompanyId });

describe('GET /api/faturacao/agt-serie-payload — RBAC', () => {
  test('só o Admin do Sistema pode pedir — Fornecedor é recusado', async () => {
    const res = await pedir(tokens.fornecedor, PARAMS_VALIDOS());
    expect(res.status).toBe(403);
  });

  test('Comprador é recusado', async () => {
    const res = await pedir(tokens.comprador, PARAMS_VALIDOS());
    expect(res.status).toBe(403);
  });

  test('sem sessão é recusado', async () => {
    const res = await request(app).get('/api/faturacao/agt-serie-payload').query(PARAMS_VALIDOS());
    expect(res.status).toBe(401);
  });
});

describe('GET /api/faturacao/agt-serie-payload — validação', () => {
  test('sem ano', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS(), ano: undefined });
    expect(res.status).toBe(422);
  });

  test('ano não numérico', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS(), ano: 'abc' });
    expect(res.status).toBe(422);
  });

  test('sem tipoDocumento', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS(), tipoDocumento: undefined });
    expect(res.status).toBe(422);
  });

  test('sem supplierCompanyId — a série pertence a um NIF específico, não a uma conta partilhada', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS(), supplierCompanyId: undefined });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/empresa fornecedora/);
    expect(agtSandboxClient.solicitarSerie).not.toHaveBeenCalled();
  });

  test('empresa fornecedora inexistente', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS(), supplierCompanyId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
    expect(agtSandboxClient.solicitarSerie).not.toHaveBeenCalled();
  });
});

describe('GET /api/faturacao/agt-serie-payload — configuração da Sandbox em falta', () => {
  test('sem credenciais da Sandbox, devolve 503 com o que falta (não um 500 genérico)', async () => {
    agtSandboxClient.disponivel.mockReturnValue(false);
    agtSandboxClient.emFalta.mockReturnValue(['AGT_SANDBOX_USERNAME', 'AGT_SANDBOX_PASSWORD']);

    const res = await pedir(tokens.adminSistema, PARAMS_VALIDOS());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICO_INDISPONIVEL');
    expect(agtSandboxClient.solicitarSerie).not.toHaveBeenCalled();
  });
});

describe('GET /api/faturacao/agt-serie-payload — sucesso', () => {
  test('constrói o pedido com o NIF real do fornecedor, assinado, estabelecimento "1" e indicador "N", e submete-o à AGT', async () => {
    const res = await pedir(tokens.adminSistema, PARAMS_VALIDOS());
    expect(res.status).toBe(200);

    const { pedido, resposta } = res.body;
    expect(pedido.taxRegistrationNumber).toBe('5001636863');
    expect(pedido.seriesYear).toBe(2026);
    expect(pedido.documentType).toBe('FT');
    expect(pedido.establishmentNumber).toBe('1');
    expect(pedido.seriesContingencyIndicator).toBe('N');
    expect(typeof pedido.submissionUUID).toBe('string');
    expect(pedido.submissionUUID.length).toBeGreaterThan(0);
    expect(pedido.softwareInfo?.softwareInfoDetail).toBeTruthy();

    const { ok, payload } = verificarJWS(pedido.jwsSignature);
    expect(ok).toBe(true);
    expect(payload).toEqual({
      taxRegistrationNumber: '5001636863',
      seriesYear: 2026,
      documentType: 'FT',
      establishmentNumber: '1',
      seriesContingencyIndicator: 'N',
    });

    expect(resposta).toEqual(RESPOSTA_AGT);
    expect(agtSandboxClient.solicitarSerie).toHaveBeenCalledTimes(1);
    expect(agtSandboxClient.solicitarSerie).toHaveBeenCalledWith(pedido);
  });

  test('tipoDocumento em minúsculas é normalizado para maiúsculas', async () => {
    const res = await pedir(tokens.adminSistema, { ...PARAMS_VALIDOS(), tipoDocumento: 'nc' });
    expect(res.status).toBe(200);
    expect(res.body.pedido.documentType).toBe('NC');
  });

  test('duas chamadas seguidas geram submissionUUID diferentes (não há reaproveitamento acidental)', async () => {
    const r1 = await pedir(tokens.adminSistema, PARAMS_VALIDOS());
    const r2 = await pedir(tokens.adminSistema, PARAMS_VALIDOS());
    expect(r1.body.pedido.submissionUUID).not.toBe(r2.body.pedido.submissionUUID);
  });
});

describe('GET /api/faturacao/agt-serie-payload — histórico (agtSeriesFe)', () => {
  test('pedido aceite pela AGT fica gravado com o seriesFEResult completo e quem pediu', async () => {
    const res = await pedir(tokens.adminSistema, PARAMS_VALIDOS());
    expect(res.status).toBe(200);

    const linha = await prisma.agtSeriesFe.findFirst({ where: { submissionUUID: res.body.pedido.submissionUUID } });
    expect(linha).toBeTruthy();
    expect(linha.ano).toBe(2026);
    expect(linha.tipoDocumento).toBe('FT');
    expect(linha.establishmentNumber).toBe('1');
    expect(linha.taxRegistrationNumber).toBe('5001636863');
    expect(linha.seriesCode).toBe('FT-2026-01');
    expect(linha.authorizedQuantity).toBe('999999999999');
    expect(linha.firstDocumentNo).toBe('1');
    expect(linha.lastDocumentNo).toBe('999999999999');
    expect(linha.requestID).toBeNull(); // não vem no formato real de solicitarSerie
    // resultCode gravado tal como veio (1) — não é um sinal de sucesso/recusa
    // aqui (ver comentário em agtSandboxClient.solicitarSerie()), só é
    // guardado para auditoria de exatamente o que a AGT respondeu.
    expect(linha.resultCode).toBe('1');
    expect(linha.solicitadoPorId).toBeTruthy();
  });

  test('resposta da AGT sem seriesFEResult grava a linha na mesma, com os campos todos null (nunca inventados)', async () => {
    agtSandboxClient.solicitarSerie.mockResolvedValue({ resultCode: 1, errorList: [''] });

    const res = await pedir(tokens.adminSistema, PARAMS_VALIDOS());
    const linha = await prisma.agtSeriesFe.findFirst({ where: { submissionUUID: res.body.pedido.submissionUUID } });
    expect(linha.seriesCode).toBeNull();
    expect(linha.authorizedQuantity).toBeNull();
    expect(linha.firstDocumentNo).toBeNull();
    expect(linha.lastDocumentNo).toBeNull();
  });
});

describe('GET /api/faturacao/agt-serie-payload — recusa da AGT', () => {
  test('quando a AGT recusa o pedido (resultCode != "0"), devolve 502 com o motivo (não um 500 genérico)', async () => {
    // jest.mock() automocka a classe (instanceof continua a funcionar, mas o
    // construtor mockado não corre a lógica real que atribui os campos) — por
    // isso atribuem-se aqui explicitamente, tal como agtSeriesService.js os lê.
    const erro = new agtSandboxClient.AgtApiError('solicitarSerie', '1', [{ code: 'E001', message: 'NIF inválido para esta série.' }]);
    erro.endpoint = 'solicitarSerie';
    erro.resultCode = '1';
    erro.errorList = [{ code: 'E001', message: 'NIF inválido para esta série.' }];
    erro.message = 'A AGT recusou o pedido de série.';
    agtSandboxClient.solicitarSerie.mockRejectedValue(erro);

    const res = await pedir(tokens.adminSistema, PARAMS_VALIDOS());
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AGT_RECUSOU');
    expect(res.body.error.details?.resultCode).toBe('1');
    expect(res.body.error.details?.errorList).toEqual([{ code: 'E001', message: 'NIF inválido para esta série.' }]);

    // O pedido construído (o mesmo que agtSandboxClient.solicitarSerie foi
    // chamado com) viaja em details.pedido — sem isto, uma recusa só dava a
    // ver o motivo, nunca os dados que o causaram (ver SolicitarSerie.jsx,
    // que passou a mostrar "Dados assinados" também neste caso).
    const { pedido } = res.body.error.details;
    expect(pedido.taxRegistrationNumber).toBe('5001636863');
    expect(pedido.establishmentNumber).toBe('1');
    expect(agtSandboxClient.solicitarSerie).toHaveBeenCalledWith(pedido);

    // Uma recusa não atribui série nenhuma — nada fica gravado em
    // agtSeriesFe para este pedido.
    const linha = await prisma.agtSeriesFe.findFirst({ where: { submissionUUID: pedido.submissionUUID } });
    expect(linha).toBeNull();
  });
});
