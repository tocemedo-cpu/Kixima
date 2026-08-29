// src/services/assinaturaService.js
// Subscrição: pedir um plano, pagar (por transferência ou por um canal
// automático), o plano ativa-se.
//
// DOIS CAMINHOS DE PAGAMENTO, DUAS FORMAS DE CONFIRMAR. Em Angola, no B2B, o
// pagamento entre empresas é normalmente transferência bancária com
// comprovativo — é assim que já funciona o pagamento das faturas nesta
// plataforma (paymentService.processPayment exige o comprovativo e recusa
// sem ele), e a subscrição sempre teve exatamente esse caminho: um humano da
// KIXIMA confirma (confirmar()), porque sem gateway não há outra forma de
// saber que o dinheiro chegou.
//
// Os planos BASE e CORE (nunca o PRO — fica só na transferência, por ser o
// contrato de maior valor) podem ALTERNATIVAMENTE ser pagos por um canal
// automático — EMIS Multicaixa Express, PayPay, ou a API de um banco (BAI,
// BFA, Standard Bank Angola) — em que o próprio gateway confirma o
// pagamento, e o plano ativa-se sozinho (confirmarViaGateway(), chamada pela
// rota de webhook, nunca por um humano). Ver canaisPagamentoService.js: cada
// adaptador RECUSA-SE A FINGIR — sem credenciais reais, nenhum canal
// automático funciona, e a página de planos só mostra os que estiverem
// configurados.
//
// AS DUAS REGRAS QUE GOVERNAM ESTE FICHEIRO, em qualquer dos dois caminhos:
//
//   1. O PLANO SÓ MUDA NA CONFIRMAÇÃO. Entre pedir e confirmar não muda nada.
//      Quem pedisse o Pro e ficasse logo com o Pro tinha o plano de graça
//      enquanto a transferência não chegasse — ou nunca chegasse.
//
//   2. O PREÇO CONGELA NO PEDIDO. A cobrança guarda o valor, o período e os
//      meses. Se a tabela mudar amanhã, esta cobrança continua a valer o que
//      foi acordado: uma cobrança que muda de valor sozinha não é uma cobrança.
const prisma = require('../config/database');
const planService = require('./planService');
const storageService = require('./storageService');
const auditService = require('./auditService');
const notificationService = require('./notificationService');
const canaisPagamentoService = require('./canaisPagamentoService');
const { nextReference } = require('../utils/reference');
const {
  NotFoundError, ForbiddenError, ValidationError, ConflictError, BusinessRuleError,
} = require('../utils/errors');

// Estados em que uma cobrança ainda está viva (a empresa deve dinheiro ou
// aguarda confirmação). Só pode haver uma de cada vez por empresa.
const EM_ABERTO = ['PENDENTE', 'COMPROVATIVO_ENVIADO'];

const DIA_MS = 24 * 60 * 60 * 1000;

// Funcionalidades que deixam RASTO na base de dados: quem desce de plano
// perde-as, e perder em silêncio uma coisa que se está a usar é a pior forma
// de descobrir que se desceu de plano. Cada entrada sabe contar o que existe.
const FUNCIONALIDADES_COM_USO = [
  {
    feature: 'apiCatalogo',
    label: 'chaves de API do catálogo ativas',
    contar: (companyId) => prisma.apiKey.count({ where: { companyId, revogadaEm: null } }),
    consequencia: 'as chaves deixam de autenticar e qualquer integração que as use pára',
  },
  {
    feature: 'kits',
    label: 'kits publicados',
    // `supplierId` e não `companyId`: os kits são do fornecedor que os publica.
    contar: (companyId) => prisma.kit.count({ where: { supplierId: companyId } }),
    consequencia: 'os kits deixam de estar visíveis no marketplace',
  },
  {
    feature: 'frameworkContracts',
    label: 'contratos-quadro',
    contar: (companyId) => prisma.contract.count({
      where: { OR: [{ supplierCompanyId: companyId }, { clientCompanyId: companyId }], status: 'ATIVO' },
    }),
    consequencia: 'não poderá criar novos contratos-quadro',
  },
];

/**
 * Os dados bancários da KIXIMA, para onde a transferência é feita.
 *
 * Vêm do ambiente e não da base de dados: são UM conjunto de dados, da própria
 * plataforma, e não uma coluna de nenhuma empresa. Mudam quando a KIXIMA muda
 * de banco — não com um deploy.
 *
 * `configurado` existe porque a falha aqui é silenciosa da pior maneira: sem
 * estes valores a página dizia "faça a transferência para os dados bancários da
 * KIXIMA" e não mostrava nenhum. Quem lesse isso não tinha para onde
 * transferir, e a única forma de a KIXIMA descobrir era pelo dinheiro que nunca
 * chegava. Assim o ecrã diz que faltam, e a Prontidão para produção também.
 */
function dadosBancarios() {
  const limpar = (v) => String(v || '').trim() || null;
  const dados = {
    titular: limpar(process.env.KIXIMA_BANCO_TITULAR),
    banco: limpar(process.env.KIXIMA_BANCO_NOME),
    iban: limpar(process.env.KIXIMA_BANCO_IBAN),
    swift: limpar(process.env.KIXIMA_BANCO_SWIFT),
    moeda: limpar(process.env.KIXIMA_BANCO_MOEDA) || 'USD',
  };
  // O IBAN é o único indispensável: sem ele não há transferência possível.
  return { ...dados, configurado: Boolean(dados.iban) };
}

// --- Leitura ----------------------------------------------------------------

function diasAte(data) {
  if (!data) return null;
  return Math.ceil((new Date(data).getTime() - Date.now()) / DIA_MS);
}

/**
 * Lugares ocupados: utilizadores ativos MAIS convites por aceitar. É a mesma
 * conta de companyService.assertLugaresDisponiveis — tem de ser, senão a página
 * de planos diria que cabe e o convite seria recusado a seguir.
 */
async function lugaresOcupados(companyId) {
  const [ativos, convites] = await Promise.all([
    prisma.user.count({ where: { companyId, active: true } }),
    prisma.employeeInvite.count({
      where: { companyId, status: 'PENDENTE', expiresAt: { gt: new Date() } },
    }),
  ]);
  return ativos + convites;
}

/**
 * Porque é que esta empresa NÃO pode passar para este plano — ou null se pode.
 *
 * Devolve os DADOS do impedimento e não a frase já montada. Uma frase montada
 * aqui chega ao ecrã em português e fica em português mesmo com a interface em
 * inglês: o dicionário do frontend só sabe traduzir chaves fixas, e "O plano
 * BASE inclui 2 lugares e a empresa tem 3" só existe depois de já estar
 * escrita. Com o código e os números à parte, a interface monta a frase a
 * partir de uma chave que se pode traduzir.
 *
 * Não é um booleano por outra razão: "não pode" sem dizer porquê deixa a pessoa
 * a olhar para um botão desativado sem saber o que corrigir.
 */
function impedimento(company, planoNovo, ocupados) {
  if (!planService.planAllowed(company.size, planoNovo)) {
    return {
      codigo: 'DIMENSAO_EXIGE_PLANO',
      dimensao: company.size,
      minimo: planService.requiredPlan(company.size),
    };
  }
  // RENOVAR o plano atual nunca se bloqueia por lugares. Uma empresa pode estar
  // acima do limite sem culpa — a KIXIMA baixou-lhe o plano à mão, ou o limite
  // do plano mudou — e nesse estado o teste de lugares bloqueava também o botão
  // de renovar. Ficava presa: não podia subir sem pagar, não podia pagar para
  // ficar onde estava, e a única saída era despedir gente. O limite serve para
  // travar a DESCIDA para um plano que não a comporta, não para impedir alguém
  // de pagar o que já tem.
  if (planService.normalizarPlano(company.plan) === planService.normalizarPlano(planoNovo)) return null;

  const lugares = planService.limite(planoNovo, 'lugaresIncluidos');
  if (lugares !== planService.ILIMITADO && ocupados > lugares) {
    return { codigo: 'LUGARES_INSUFICIENTES', plano: planoNovo, lugares, ocupados };
  }
  return null;
}

/**
 * A mesma coisa em português, para a mensagem de erro do servidor. Sai do mesmo
 * objeto que a interface recebe — as duas não podem divergir porque é uma só
 * fonte.
 */
function impedimentoEmTexto(imp) {
  if (!imp) return null;
  if (imp.codigo === 'DIMENSAO_EXIGE_PLANO') {
    return `Empresas de dimensão ${imp.dimensao} têm de subscrever o plano ${imp.minimo}.`;
  }
  return `O plano ${imp.plano} inclui ${imp.lugares} lugares e a empresa tem ${imp.ocupados} `
    + '(utilizadores ativos mais convites por aceitar). '
    + 'Desative os utilizadores em excesso antes de descer de plano.';
}

/**
 * O que esta empresa PERDE ao descer para este plano, com números reais.
 * Vazio quando sobe de plano ou quando não usa nada do que se perde.
 */
async function perdas(company, planoNovo) {
  const fora = FUNCIONALIDADES_COM_USO.filter(
    (f) => planService.hasFeature(company.plan, f.feature) && !planService.hasFeature(planoNovo, f.feature),
  );
  const contagens = await Promise.all(fora.map((f) => f.contar(company.id)));
  return fora
    .map((f, i) => ({ label: f.label, quantidade: contagens[i], consequencia: f.consequencia }))
    .filter((p) => p.quantidade > 0);
}

/**
 * Estado da subscrição para a página da empresa: o plano atual, até quando está
 * pago, a cobrança em aberto (se houver) e a escada toda com preço e o que
 * impede cada degrau.
 */
async function estado(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, size: true, plan: true, planoValidoAte: true },
  });
  if (!company) throw new NotFoundError('Empresa');

  const [ocupados, emAberto, historico] = await Promise.all([
    lugaresOcupados(companyId),
    prisma.planoCobranca.findFirst({
      where: { companyId, status: { in: EM_ABERTO } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.planoCobranca.findMany({
      where: { companyId, status: { notIn: EM_ABERTO } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const atual = planService.normalizarPlano(company.plan);
  const opcoes = await Promise.all(planService.ESCADA.map(async (plano) => ({
    plano,
    preco: planService.preco(plano),
    features: planService.features(plano),
    atual: plano === atual,
    direcao: direcao(atual, plano),
    impedimento: impedimento(company, plano, ocupados),
    perdas: await perdas(company, plano),
  })));

  return {
    empresa: { id: company.id, name: company.name, size: company.size },
    banco: dadosBancarios(),
    planoAtual: atual,
    validoAte: company.planoValidoAte,
    diasAteExpirar: diasAte(company.planoValidoAte),
    // Uma subscrição vencida NÃO desce o plano sozinha: cortar funcionalidades
    // sem aviso a quem talvez já tenha transferido o dinheiro é pior do que
    // cobrar com atraso. Fica visível aqui e na lista do Admin do Sistema.
    expirada: Boolean(company.planoValidoAte && new Date(company.planoValidoAte) < new Date()),
    // Patamar de urgência (ATIVA/A_EXPIRAR/GRACE/RESTRITA) — ver
    // planService.estadoSubscricao. `expirada` acima fica tal como estava
    // (quem já a lê continua a receber o mesmo valor); isto é o que precede
    // os avisos escalonados e o banner do dashboard.
    estadoSubscricao: planService.estadoSubscricao(company),
    graceDiasRestantes: (() => {
      if (!company.planoValidoAte) return null;
      const dias = -diasAte(company.planoValidoAte);
      const restantes = planService.GRACE_PERIOD_DAYS - dias;
      return restantes > 0 ? restantes : 0;
    })(),
    lugaresOcupados: ocupados,
    lugaresIncluidos: planService.limite(atual, 'lugaresIncluidos'),
    emAberto,
    historico,
    opcoes,
  };
}

function direcao(atual, alvo) {
  const a = planService.ESCADA.indexOf(atual);
  const b = planService.ESCADA.indexOf(alvo);
  if (b > a) return 'SUBIR';
  if (b < a) return 'DESCER';
  return 'RENOVAR';
}

// --- Pedir ------------------------------------------------------------------

/**
 * Emite a cobrança de um plano. Não muda o plano — emite a conta.
 *
 * `aceitaPerdas` existe para as descidas: quem desce com kits ou chaves de API
 * em uso tem de dizer que sabe o que vai perder. Sem isso, a plataforma
 * apagava-lhe capacidades a partir de um clique num preço mais baixo.
 */
async function pedir(companyId, planoNovo, userId, { aceitaPerdas = false } = {}, actor = null) {
  const plano = String(planoNovo || '').toUpperCase();
  if (!planService.ESCADA.includes(plano)) {
    throw new ValidationError(`Plano desconhecido: "${planoNovo}". Os planos são ${planService.ESCADA.join(', ')}.`);
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError('Empresa');
  if (company.status !== 'APROVADA') {
    throw new BusinessRuleError('A empresa tem de estar aprovada para subscrever um plano.');
  }

  const aberta = await prisma.planoCobranca.findFirst({
    where: { companyId, status: { in: EM_ABERTO } },
  });
  if (aberta) {
    throw new ConflictError(
      `Já existe a cobrança ${aberta.referencia} por liquidar (${aberta.planoNovo}, ${aberta.valorUsd} USD). `
      + 'Conclua ou cancele essa antes de pedir outra.',
    );
  }

  const ocupados = await lugaresOcupados(companyId);
  const bloqueio = impedimento(company, plano, ocupados);
  if (bloqueio) throw new BusinessRuleError(impedimentoEmTexto(bloqueio));

  const aPerder = await perdas(company, plano);
  if (aPerder.length && !aceitaPerdas) {
    const lista = aPerder.map((p) => `${p.quantidade} ${p.label}`).join('; ');
    throw new BusinessRuleError(
      `Descer para o plano ${plano} faz perder: ${lista}. `
      + 'Confirme que aceita perder isto para continuar.',
    );
  }

  const preco = planService.preco(plano);
  const referencia = await nextReference('SUB', 'planoCobranca', 'referencia');

  const cobranca = await prisma.planoCobranca.create({
    data: {
      referencia,
      companyId,
      planoAtual: company.plan,
      planoNovo: plano,
      // Congelado. Ver a regra 2 no topo do ficheiro.
      valorUsd: preco.valorUsd,
      periodo: preco.periodo,
      meses: preco.meses,
      createdById: userId || null,
    },
  });

  await auditService.recordSafe({
    actor: actor || { actorId: userId },
    action: 'SUBSCRICAO_PEDIDA',
    entityType: 'PlanoCobranca',
    entityId: cobranca.id,
    entityRef: referencia,
    detail: {
      de: company.plan, para: plano, valorUsd: String(preco.valorUsd), periodo: preco.periodo,
      ...(aPerder.length ? { perdasAceites: aPerder.map((p) => `${p.quantidade} ${p.label}`) } : {}),
    },
  });

  return cobranca;
}

// --- Pagar ------------------------------------------------------------------

/**
 * Carrega o comprovativo da transferência. Obrigatório, tal como no pagamento
 * de faturas: sem ele "paguei" é só uma palavra, e quem confirma do lado da
 * KIXIMA não tem nada em que se basear.
 */
async function submeterComprovativo(companyId, cobrancaId, file, actor = null) {
  if (!file) {
    throw new ValidationError('Anexe o comprovativo da transferência (PDF ou imagem) para submeter o pagamento.');
  }

  const cobranca = await prisma.planoCobranca.findUnique({ where: { id: cobrancaId } });
  if (!cobranca) throw new NotFoundError('Cobrança');
  if (cobranca.companyId !== companyId) {
    throw new ForbiddenError('Só pode pagar cobranças da sua própria empresa.');
  }
  if (!EM_ABERTO.includes(cobranca.status)) {
    throw new ConflictError(`A cobrança ${cobranca.referencia} está ${cobranca.status.toLowerCase()} e não aceita comprovativo.`);
  }

  // Upload fora da transação — não é transacional.
  const comprovativoUrl = await storageService.saveFile({
    buffer: file.buffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
    keyHint: `subscricao-${cobranca.referencia}`,
    folder: 'proofs',
  });

  const atualizada = await prisma.planoCobranca.update({
    where: { id: cobrancaId },
    data: { comprovativoUrl, status: 'COMPROVATIVO_ENVIADO', submetidoEm: new Date() },
  });

  await auditService.recordSafe({
    actor: actor || {},
    action: 'SUBSCRICAO_COMPROVATIVO_ENVIADO',
    entityType: 'PlanoCobranca',
    entityId: cobranca.id,
    entityRef: cobranca.referencia,
    detail: { comprovativo: file.originalname || 'comprovativo', valorUsd: String(cobranca.valorUsd) },
  });

  // A KIXIMA tem de saber que há dinheiro à espera de confirmação. Falhar o
  // email não pode desfazer o comprovativo já guardado.
  notificationService.notifyUsersByRole({
    roles: ['ADMIN_SISTEMA'],
    type: 'SUBSCRICAO_COMPROVATIVO',
    title: 'Comprovativo de subscrição recebido',
    message: `${cobranca.referencia}: comprovativo carregado para o plano ${cobranca.planoNovo} `
      + `(${cobranca.valorUsd} USD). Aguarda confirmação.`,
    relatedEntityType: 'PlanoCobranca',
    relatedEntityId: cobranca.id,
  }).catch(() => {});

  return atualizada;
}

// --- Confirmar --------------------------------------------------------------

/**
 * Até quando a subscrição fica paga.
 *
 * Conta a partir do fim da subscrição atual quando esta ainda está em vigor —
 * quem renova antes de expirar não pode perder os dias que já pagou. Se já
 * expirou, conta a partir de hoje: os dias em que esteve por pagar não se
 * compram retroativamente.
 */
function novoValidoAte(validoAtual, meses, agora = new Date()) {
  const base = validoAtual && new Date(validoAtual) > agora ? new Date(validoAtual) : new Date(agora);
  const fim = new Date(base);
  fim.setMonth(fim.getMonth() + meses);
  return fim;
}

/**
 * O único sítio em toda a plataforma onde uma subscrição paga muda o plano —
 * partilhado pelos dois caminhos que chegam aqui: confirmar() (um humano da
 * KIXIMA, depois de ver o comprovativo) e confirmarViaGateway() (o próprio
 * gateway, via webhook). Os dois preenchem `dadosExtra` de forma diferente
 * (confirmadaPor+notas vs. referenciaExterna) mas a ativação do plano — e a
 * auditoria dela — é exatamente a mesma conta.
 */
async function aplicarConfirmacao(cobranca, { dadosExtra = {}, actor, mensagemNotificacao }) {
  const validoAte = novoValidoAte(cobranca.company.planoValidoAte, cobranca.meses);

  const atualizada = await prisma.$transaction(async (tx) => {
    const c = await tx.planoCobranca.update({
      where: { id: cobranca.id },
      data: {
        status: 'CONFIRMADA',
        confirmadaEm: new Date(),
        validoAte,
        ...dadosExtra,
      },
    });

    await tx.company.update({
      where: { id: cobranca.companyId },
      data: {
        plan: cobranca.planoNovo,
        // Derivado do plano. Se ficasse por escrever, uma empresa que pagou o
        // Pro continuaria no fundo da pesquisa — a pagar por algo que não
        // recebia. É o mesmo cuidado de companyService.updatePlan.
        searchRank: planService.rankDoPlano(cobranca.planoNovo),
        planoValidoAte: validoAte,
        // Novo ciclo de pagamento: os avisos de expiração já enviados eram
        // sobre o prazo ANTERIOR. Sem isto, uma empresa que renovasse dias
        // antes do fim do grace period continuava marcada em GRACE_META, e o
        // próximo aviso (quando a nova data se aproximasse) seria descartado
        // por "já avisado neste patamar ou mais urgente".
        ultimoAvisoSubscricaoTier: null,
      },
    });

    // Auditoria DENTRO da transação: um plano que muda sem registo não se
    // consegue explicar a ninguém depois.
    await auditService.record(tx, {
      actor,
      action: 'SUBSCRICAO_CONFIRMADA',
      entityType: 'PlanoCobranca',
      entityId: cobranca.id,
      entityRef: cobranca.referencia,
      detail: {
        empresa: cobranca.company.name,
        de: cobranca.planoAtual,
        para: cobranca.planoNovo,
        valorUsd: String(cobranca.valorUsd),
        canal: cobranca.canal,
        validoAte: validoAte.toISOString(),
      },
    });

    return c;
  });

  notificationService.notifyUsersByRole({
    companyId: cobranca.companyId,
    roles: ['COMPANY_ADMIN', 'FINANCEIRO'],
    type: 'SUBSCRICAO_CONFIRMADA',
    title: `Plano ${cobranca.planoNovo} ativo`,
    message: mensagemNotificacao
      || `A subscrição ${cobranca.referencia} foi confirmada. O plano ${cobranca.planoNovo} `
      + `está ativo até ${validoAte.toISOString().slice(0, 10)}.`,
    relatedEntityType: 'PlanoCobranca',
    relatedEntityId: cobranca.id,
  }).catch(() => {});

  return atualizada;
}

async function confirmar(cobrancaId, adminId, { notas } = {}, actor = null) {
  const cobranca = await prisma.planoCobranca.findUnique({
    where: { id: cobrancaId },
    include: { company: { select: { id: true, name: true, plan: true, planoValidoAte: true } } },
  });
  if (!cobranca) throw new NotFoundError('Cobrança');
  if (cobranca.status === 'CONFIRMADA') {
    throw new ConflictError(`A cobrança ${cobranca.referencia} já foi confirmada.`);
  }
  if (cobranca.status === 'CANCELADA') {
    throw new ConflictError(`A cobrança ${cobranca.referencia} está cancelada.`);
  }
  if (!cobranca.comprovativoUrl) {
    throw new BusinessRuleError(
      `A cobrança ${cobranca.referencia} não tem comprovativo. `
      + 'Confirmar sem ele deixaria a plataforma a afirmar um pagamento que ninguém consegue mostrar.',
    );
  }

  return aplicarConfirmacao(cobranca, {
    dadosExtra: { confirmadaPor: adminId || null, ...(notas ? { notas } : {}) },
    actor: actor || { actorId: adminId },
  });
}

// --- Pagamento automático (EMIS, PayPay, bancos) -----------------------------

// Só BASE e CORE — o PRO, de maior valor, fica exclusivamente na transferência
// manual confirmada por um humano da KIXIMA (ver cabeçalho do ficheiro).
const PLANOS_COM_GATEWAY = ['BASE', 'CORE'];

/**
 * Inicia o pagamento de uma cobrança PENDENTE num canal automático — chama o
 * adaptador do gateway (que se recusa a fingir sem credenciais reais) e
 * guarda a referência externa devolvida, para o webhook a poder encontrar
 * depois. NÃO confirma nada: só o callback confirmado contra o próprio
 * gateway faz isso (ver confirmarViaGateway).
 */
async function iniciarPagamentoGateway(companyId, cobrancaId, { canal, telemovel } = {}, actor = null) {
  if (!canaisPagamentoService.CANAIS_GATEWAY.includes(canal)) {
    throw new ValidationError(`Canal desconhecido: "${canal}". Os canais automáticos são: ${canaisPagamentoService.CANAIS_GATEWAY.join(', ')}.`);
  }

  const cobranca = await prisma.planoCobranca.findUnique({ where: { id: cobrancaId } });
  if (!cobranca) throw new NotFoundError('Cobrança');
  if (cobranca.companyId !== companyId) {
    throw new ForbiddenError('Só pode pagar cobranças da sua própria empresa.');
  }
  if (cobranca.status !== 'PENDENTE') {
    throw new ConflictError(`A cobrança ${cobranca.referencia} está ${cobranca.status.toLowerCase()} e não aceita um novo pagamento.`);
  }
  if (!PLANOS_COM_GATEWAY.includes(cobranca.planoNovo)) {
    throw new BusinessRuleError(
      `O plano ${cobranca.planoNovo} só se paga por transferência bancária. `
      + `Os canais automáticos existem apenas para ${PLANOS_COM_GATEWAY.join('/')}.`,
    );
  }

  const adaptador = canaisPagamentoService.adaptador(canal);
  const resultado = await adaptador.pedirPagamento({
    referencia: cobranca.referencia,
    valor: cobranca.valorUsd,
    moeda: 'USD',
    telemovel,
  });

  const referenciaExterna = String(resultado?.id || resultado?.transactionId || '');
  if (!referenciaExterna) {
    throw new Error(`${canal} não devolveu um identificador de transação — não há forma de confirmar este pagamento depois.`);
  }

  const atualizada = await prisma.planoCobranca.update({
    where: { id: cobrancaId },
    data: { canal, referenciaExterna, telemovel: telemovel || null },
  });

  await auditService.recordSafe({
    actor: actor || {},
    action: 'SUBSCRICAO_PAGAMENTO_INICIADO',
    entityType: 'PlanoCobranca',
    entityId: cobranca.id,
    entityRef: cobranca.referencia,
    detail: { canal, referenciaExterna },
  });

  return atualizada;
}

/**
 * O gateway confirmou — chamado só pela rota de webhook, nunca por um humano.
 * Idempotente: um callback duplicado (os gateways reenviam) não tenta
 * confirmar duas vezes.
 */
async function confirmarViaGateway(cobrancaId, { canal, referenciaExterna }) {
  const cobranca = await prisma.planoCobranca.findUnique({
    where: { id: cobrancaId },
    include: { company: { select: { id: true, name: true, plan: true, planoValidoAte: true } } },
  });
  if (!cobranca) throw new NotFoundError('Cobrança');
  if (cobranca.status === 'CONFIRMADA') return cobranca;
  if (cobranca.status === 'CANCELADA') {
    throw new ConflictError(`A cobrança ${cobranca.referencia} está cancelada — o pagamento chegou tarde de mais.`);
  }
  if (cobranca.canal !== canal || cobranca.referenciaExterna !== referenciaExterna) {
    throw new ConflictError(`O callback de ${canal} (${referenciaExterna}) não corresponde ao pagamento iniciado para ${cobranca.referencia}.`);
  }

  return aplicarConfirmacao(cobranca, {
    dadosExtra: {},
    // Sem adminId — ninguém da KIXIMA carregou em nada. `actorName` diz a
    // verdade em vez de inventar um utilizador "sistema" a quem depois
    // ninguém pede contas (mesmo padrão de conciliacaoService.js).
    actor: { actorId: null, actorName: `Pagamento automático (${canal})`, companyId: cobranca.companyId },
    mensagemNotificacao: `A subscrição ${cobranca.referencia} foi paga via ${canal} e confirmada automaticamente. `
      + `O plano ${cobranca.planoNovo} está ativo.`,
  });
}

/**
 * Cancela uma cobrança em aberto. O motivo é obrigatório: uma cobrança que
 * desaparece sem explicação é uma pergunta que fica sem resposta no dia em que
 * a empresa jurar que transferiu.
 */
async function cancelar(cobrancaId, { motivo, companyId = null } = {}, actor = null) {
  if (!motivo || !String(motivo).trim()) {
    throw new ValidationError('Indique o motivo do cancelamento.');
  }
  const cobranca = await prisma.planoCobranca.findUnique({ where: { id: cobrancaId } });
  if (!cobranca) throw new NotFoundError('Cobrança');
  if (companyId && cobranca.companyId !== companyId) {
    throw new ForbiddenError('Só pode cancelar cobranças da sua própria empresa.');
  }
  if (!EM_ABERTO.includes(cobranca.status)) {
    throw new ConflictError(`A cobrança ${cobranca.referencia} está ${cobranca.status.toLowerCase()}.`);
  }

  const atualizada = await prisma.planoCobranca.update({
    where: { id: cobrancaId },
    data: { status: 'CANCELADA', notas: String(motivo).trim() },
  });

  await auditService.recordSafe({
    actor: actor || {},
    action: 'SUBSCRICAO_CANCELADA',
    entityType: 'PlanoCobranca',
    entityId: cobranca.id,
    entityRef: cobranca.referencia,
    detail: { motivo: String(motivo).trim(), plano: cobranca.planoNovo, valorUsd: String(cobranca.valorUsd) },
  });

  return atualizada;
}

// --- Admin do Sistema -------------------------------------------------------

/**
 * A fila de trabalho da KIXIMA: cobranças em aberto e subscrições vencidas.
 *
 * As vencidas vão JUNTO de propósito. Como o vencimento não desce o plano
 * sozinho, se não aparecessem aqui ninguém saberia que existem — uma empresa
 * podia usar o Pro durante um ano sem pagar e o sistema nunca dizia nada.
 */
async function fila() {
  const [emAberto, vencidasRaw] = await Promise.all([
    prisma.planoCobranca.findMany({
      where: { status: { in: EM_ABERTO } },
      include: { company: { select: { id: true, name: true, plan: true } } },
      orderBy: [{ status: 'desc' }, { createdAt: 'asc' }],
    }),
    prisma.company.findMany({
      where: { planoValidoAte: { lt: new Date() } },
      select: { id: true, name: true, plan: true, planoValidoAte: true },
      orderBy: { planoValidoAte: 'asc' },
    }),
  ]);

  // GRACE (ainda dentro da tolerância) e RESTRITA (já além dela) são
  // trabalhos com urgência diferente para o Admin do Sistema — separados aqui
  // para o ecrã não misturar "ainda há tempo" com "já bloqueado".
  const vencidas = vencidasRaw.map((c) => ({
    ...c,
    diasVencida: -diasAte(c.planoValidoAte),
    estadoSubscricao: planService.estadoSubscricao(c),
  }));

  return {
    emAberto,
    vencidas,
    emGrace: vencidas.filter((c) => c.estadoSubscricao === 'GRACE'),
    restritas: vencidas.filter((c) => c.estadoSubscricao === 'RESTRITA'),
    // Contas separadas: "3 por confirmar" e "3 por pagar" são trabalhos
    // diferentes, e somá-los esconderia qual deles está parado.
    porConfirmar: emAberto.filter((c) => c.status === 'COMPROVATIVO_ENVIADO').length,
    porPagar: emAberto.filter((c) => c.status === 'PENDENTE').length,
  };
}

// --- Avisos escalonados de expiração ----------------------------------------
//
// Patamares por urgência CRESCENTE. O patamar de uma empresa, num dado dia, é
// o ÚLTIMO desta lista cujo limiar já foi ultrapassado — não "o dia exato X".
// Isto importa para um cron que falhou uma corrida ou correu atrasado: no dia
// seguinte avança direto para o patamar CERTO (e avisa uma vez, o mais
// urgente que se aplica), em vez de ou saltar o aviso ou repetir os que já
// passaram.
const PATAMARES_AVISO = [
  { tier: 'D30', limiarDias: 30 },
  { tier: 'D7', limiarDias: 7 },
  { tier: 'D3', limiarDias: 3 },
  { tier: 'D1', limiarDias: 1 },
  { tier: 'D0', limiarDias: 0 },
  { tier: 'GRACE_INICIO', limiarDias: -1 },
  // A meio do período de tolerância — arredondado para cima para nunca cair
  // depois do fim do grace period (ex.: 7 dias de tolerância → aviso ao 4º).
  { tier: 'GRACE_META', limiarDias: -Math.ceil(planService.GRACE_PERIOD_DAYS / 2) },
];

function patamarAtual(diasAteVencer) {
  let atual = null;
  for (const p of PATAMARES_AVISO) {
    if (diasAteVencer <= p.limiarDias) atual = p.tier;
  }
  return atual;
}

/**
 * Envia os avisos de expiração do dia — um por empresa, no máximo, e só
 * quando o patamar SOBE (nunca repete o mesmo, nunca volta atrás). Corre uma
 * vez por dia via subscriptionExpiryJob.js.
 *
 * Empresas já RESTRITAS não recebem mais avisos: passado o período de
 * tolerância o acesso já está bloqueado nos pontos certos (ver
 * planService.assertFeature) — mais um aviso periódico seria ruído sem ação
 * nova possível, e "não criar spam" também vale para quem já sabe.
 */
async function enviarAvisosDeExpiracao() {
  const candidatas = await prisma.company.findMany({
    where: { planoValidoAte: { not: null } },
    select: {
      id: true, name: true, plan: true, planoValidoAte: true, ultimoAvisoSubscricaoTier: true,
    },
  });

  const RANK = Object.fromEntries(PATAMARES_AVISO.map((p, i) => [p.tier, i]));
  let enviados = 0;

  for (const company of candidatas) {
    if (planService.estadoSubscricao(company) === 'RESTRITA') continue; // eslint-disable-line no-continue

    const tier = patamarAtual(diasAte(company.planoValidoAte));
    if (!tier) continue; // eslint-disable-line no-continue — ainda longe (>30 dias), nada a avisar

    const rankAnterior = RANK[company.ultimoAvisoSubscricaoTier] ?? -1;
    if (RANK[tier] <= rankAnterior) continue; // eslint-disable-line no-continue — já avisado neste patamar ou mais urgente

    // eslint-disable-next-line no-await-in-loop
    await notificationService.events.subscricaoAExpirar(company, tier);
    // eslint-disable-next-line no-await-in-loop
    await prisma.company.update({ where: { id: company.id }, data: { ultimoAvisoSubscricaoTier: tier } });
    enviados += 1;
  }

  return enviados;
}

module.exports = {
  estado, pedir, submeterComprovativo, confirmar, cancelar, fila, enviarAvisosDeExpiracao,
  iniciarPagamentoGateway, confirmarViaGateway,
  // Exportados para teste: são as duas contas que decidem dinheiro e acesso.
  novoValidoAte, lugaresOcupados, impedimento, impedimentoEmTexto, dadosBancarios, EM_ABERTO,
  patamarAtual, PATAMARES_AVISO, PLANOS_COM_GATEWAY,
};
