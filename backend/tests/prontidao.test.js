// tests/prontidao.test.js
// Prontidão para produção.
//
// O que estes testes protegem é a razão de a página existir: as definições que
// protegem a plataforma vivem em variáveis de ambiente noutro sítio, e uma que
// falte NÃO dá erro — a aplicação arranca e parece estar tudo bem. Se este
// diagnóstico der "ok" a um ambiente mal configurado, é pior do que não existir:
// passa a ser uma garantia falsa.
//
// E há uma regra que não se negoceia: nunca devolver o valor de um segredo.
const request = require('supertest');
const app = require('../src/app');
const { loginAll, auth } = require('./helpers');
const prontidao = require('../src/services/prontidaoService');
const backupJob = require('../src/jobs/backupJob');
const config = require('../src/config/env');

describe('Prontidão para produção', () => {
  let tokens;
  beforeAll(async () => { tokens = await loginAll(); });

  describe('acesso', () => {
    test('só o Admin do Sistema vê o estado do ambiente', async () => {
      expect((await auth(tokens.adminSistema).get('/api/admin/prontidao')).status).toBe(200);
      expect((await auth(tokens.comprador).get('/api/admin/prontidao')).status).toBe(403);
      expect((await auth(tokens.companyAdmin).get('/api/admin/prontidao')).status).toBe(403);
      expect((await request(app).get('/api/admin/prontidao')).status).toBe(401);
    });

    test('e só ele pode mandar fazer uma cópia ou enviar um email de teste', async () => {
      expect((await auth(tokens.comprador).post('/api/admin/backup')).status).toBe(403);
      expect((await request(app).post('/api/admin/backup')).status).toBe(401);
      expect((await auth(tokens.comprador).post('/api/admin/email-teste')).status).toBe(403);
      expect((await request(app).post('/api/admin/email-teste')).status).toBe(401);
    });
  });

  // O ponto mais importante do ficheiro.
  test('NUNCA devolve o valor de um segredo', async () => {
    const res = await auth(tokens.adminSistema).get('/api/admin/prontidao');
    const texto = JSON.stringify(res.body);

    // Os segredos que este processo tem carregados não podem aparecer no corpo.
    const segredos = [
      config.auth.jwtSecret,
      config.storage.secretKey,
      config.storage.accessKey,
      config.email.brevoApiKey,
      process.env.DATABASE_URL,
      process.env.DIRECT_URL,
    ].filter((s) => s && String(s).length >= 8);

    for (const s of segredos) expect(texto).not.toContain(String(s));
    // Nem a senha da base, que vive dentro do URL de ligação.
    expect(texto).not.toMatch(/postgres(ql)?:\/\/[^"]*:[^"@]+@/);
  });

  test('diz o host e a porta da base, que não são segredo e são o que se precisa', async () => {
    const res = await auth(tokens.adminSistema).get('/api/admin/prontidao');
    const db = res.body.grupos.find((g) => g.grupo === 'Base de dados');
    expect(db.checks.map((c) => c.id)).toEqual(['db-url', 'db-direct']);
  });

  test('cada problema traz o que fazer, não só o que está mal', async () => {
    const res = await auth(tokens.adminSistema).get('/api/admin/prontidao');
    const problemas = res.body.grupos.flatMap((g) => g.checks).filter((c) => c.estado !== 'ok');
    expect(problemas.length).toBeGreaterThan(0); // o ambiente de teste não é produção
    for (const p of problemas) expect(String(p.acao || '').length).toBeGreaterThan(20);
  });

  test('o resumo bate certo com as verificações', async () => {
    const { resumo, grupos } = (await auth(tokens.adminSistema).get('/api/admin/prontidao')).body;
    const todos = grupos.flatMap((g) => g.checks);
    expect(resumo.total).toBe(todos.length);
    expect(resumo.ok + resumo.avisos + resumo.falhas).toBe(resumo.total);
  });

  test('assinala o ambiente de teste como não estando pronto para produção', async () => {
    const r = await prontidao.verificar();
    // Sem S3, sem email a sério e sem cópias — tem de dar por isso.
    const ids = r.grupos.flatMap((g) => g.checks).filter((c) => c.estado === 'falha').map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['storage', 'email', 'backup-cron', 'backup-bucket']));
  });
});

// Um BACKUP_CRON mal escrito é a falha mais fácil de ter e a mais difícil de
// ver: no painel do Render o valor "parece" certo, o serviço arranca sem se
// queixar ao utilizador, e a cópia simplesmente nunca corre. O diagnóstico tem
// de nomear a causa concreta — dizer só "inválido" faz a pessoa olhar para um
// valor que lhe parece bem e não ver nada.
describe('Diagnóstico do BACKUP_CRON', () => {
  const original = process.env.BACKUP_CRON;
  afterAll(() => {
    if (original === undefined) delete process.env.BACKUP_CRON;
    else process.env.BACKUP_CRON = original;
  });

  async function verificarCron(valor) {
    if (valor === undefined) delete process.env.BACKUP_CRON;
    else process.env.BACKUP_CRON = valor;
    const r = await prontidao.verificar();
    return r.grupos.find((g) => g.grupo === 'Cópias de segurança').checks.find((c) => c.id === 'backup-cron');
  }

  test('ausente: manda reiniciar, porque a variável só é lida no arranque', async () => {
    const c = await verificarCron(undefined);
    expect(c.estado).toBe('falha');
    expect(c.detalhe).toMatch(/não chegou a este processo/);
    expect(c.acao).toMatch(/reiniciar|Restart|arranque/i);
  });

  // A causa mais comum de todas: copiar o exemplo com as aspas incluídas, ou o
  // rótulo "Value:" do próprio formulário do Render. Passaram a ser tolerados —
  // recusar era tecnicamente correto e inútil na prática.
  test('aspas e o rótulo do painel são tolerados', async () => {
    expect((await verificarCron('"0 3 * * *"')).estado).toBe('ok');
    expect((await verificarCron('Value:\n0 3 * * *')).estado).toBe('ok');
    expect((await verificarCron('  0 3 * * *  ')).estado).toBe('ok');
  });

  test('aspas NO MEIO do valor continuam a ser assinaladas', async () => {
    const c = await verificarCron('0 3 " * *');
    expect(c.estado).toBe('falha');
    expect(c.acao).toMatch(/ASPAS/);
  });

  test('com asterisco trocado por autocorreção: diz que os caracteres não são asteriscos', async () => {
    const c = await verificarCron('0 3 ∗ * *');
    expect(c.estado).toBe('falha');
    expect(c.acao).toMatch(/asteriscos simples/);
  });

  test('@daily não serve — o node-cron rejeita-o', async () => {
    const c = await verificarCron('@daily');
    expect(c.estado).toBe('falha');
    expect(c.acao).toMatch(/@daily/);
  });

  test('cinco campos válidos: agendada', async () => {
    const c = await verificarCron('0 3 * * *');
    expect(c.estado).toBe('ok');
    expect(c.detalhe).toMatch(/^Agendada: 0 3 \* \* \* \(UTC\)/);
    // O agendamento sozinho não chega no plano gratuito — a mensagem tem de
    // dizer que há recuperação, senão promete uma garantia que não dá.
    expect(c.detalhe).toMatch(/recuperação automática/);
  });

  test('seis campos também servem — o node-cron aceita segundos', async () => {
    const c = await verificarCron('0 0 3 * * *');
    expect(c.estado).toBe('ok');
  });
});

describe('Cópia de segurança a pedido', () => {
  let tokens;
  beforeAll(async () => { tokens = await loginAll(); });

  // O botão tem de recusar EXATAMENTE pelas mesmas razões que o agendamento.
  // Se aceitasse condições que o agendamento recusa, seria pior do que não
  // existir: dava por confirmado um caminho que à noite não existe.
  test('recusa-se pelas mesmas razões que o agendamento', async () => {
    const motivo = backupJob.motivoParaNaoCorrer();
    const res = await auth(tokens.adminSistema).post('/api/admin/backup');

    if (motivo) {
      expect(res.status).toBe(422);
      expect(res.body.error.message).toBe(motivo);
    } else {
      expect(res.status).toBe(200);
    }
  });

  test('sem S3 não deixa copiar — uma cópia no disco do contentor desaparece com ele', () => {
    // É o estado do ambiente de teste, e é o mais perigoso: parece funcionar.
    expect(backupJob.motivoParaNaoCorrer()).toMatch(/S3|bucket/i);
  });

  test('o bucket das cópias nunca pode ser o das imagens', () => {
    const anterior = { ...config.storage };
    try {
      // Simula um ambiente com S3 pronto mas o mesmo bucket para as duas coisas.
      config.storage.provider = 's3';
      config.storage.missing = [];
      config.storage.bucket = 'kixima-imagens';
      config.storage.backupBucket = 'kixima-imagens';
      expect(backupJob.motivoParaNaoCorrer()).toMatch(/MESMO bucket/);

      // Um bucket diferente é o único estado em que a cópia pode correr.
      config.storage.backupBucket = 'kixima-copias-privadas';
      expect(backupJob.motivoParaNaoCorrer()).toBeNull();
    } finally {
      Object.assign(config.storage, anterior);
    }
  });
});

// O envio de email é, por desenho, o sítio onde as falhas são engolidas: um
// convite não deve deixar de ser criado porque o servidor de email não
// respondeu. O reverso é que uma chave errada não dá sinal nenhum. O email de
// teste é o único caminho onde o erro tem de vir por inteiro — se também aqui
// fosse engolido, o botão diria "enviado" sem nada ter saído, que é a pior
// resposta possível.
describe('Email de teste', () => {
  let tokens;
  beforeAll(async () => { tokens = await loginAll(); });

  test('com EMAIL_PROVIDER=console recusa em vez de fingir que enviou', async () => {
    expect(config.email.apenasLog).toBe(true); // estado do ambiente de teste
    const res = await auth(tokens.adminSistema).post('/api/admin/email-teste');
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/EMAIL_PROVIDER=brevo/);
  });

  test('com o provider definido mas sem credenciais, diz qual falta', async () => {
    const notificationService = require('../src/services/notificationService');
    const anterior = { ...config.email };
    try {
      config.email.provider = 'brevo';
      config.email.apenasLog = false;
      config.email.missing = ['BREVO_API_KEY'];
      await expect(notificationService.enviarEmailDeTeste('alguem@kixima.co.ao'))
        .rejects.toThrow(/BREVO_API_KEY/);
    } finally {
      Object.assign(config.email, anterior);
    }
  });
});
