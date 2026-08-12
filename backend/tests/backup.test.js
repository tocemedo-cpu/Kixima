// tests/backup.test.js
// Cópia de segurança automática.
//
// O ponto que este teste protege: o job RECUSA-SE a correr quando não há
// armazenamento externo. Uma cópia escrita no disco do contentor desaparece com
// o próprio contentor — é pior do que não ter cópia nenhuma, porque dá a
// impressão de se estar protegido e só se descobre o contrário no dia em que é
// precisa.
const cron = require('node-cron');
const config = require('../src/config/env');
const logger = require('../src/config/logger');
const { scheduleBackupJob } = require('../src/jobs/backupJob');

describe('Cópia de segurança automática', () => {
  const originalStorage = { ...config.storage };
  const originalCron = process.env.BACKUP_CRON;
  let agendar; let erro; let info;

  beforeEach(() => {
    agendar = jest.spyOn(cron, 'schedule').mockImplementation(() => ({ stop() {} }));
    erro = jest.spyOn(logger, 'error').mockImplementation(() => {});
    info = jest.spyOn(logger, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    Object.assign(config.storage, originalStorage);
    if (originalCron === undefined) delete process.env.BACKUP_CRON;
    else process.env.BACKUP_CRON = originalCron;
  });

  test('sem BACKUP_CRON não agenda nada — é opt-in', () => {
    delete process.env.BACKUP_CRON;
    scheduleBackupJob();
    expect(agendar).not.toHaveBeenCalled();
    expect(erro).not.toHaveBeenCalled();
  });

  test('recusa-se a correr sem armazenamento externo, e diz porquê', () => {
    process.env.BACKUP_CRON = '0 3 * * *';
    Object.assign(config.storage, { provider: 'local', missing: [] });
    scheduleBackupJob();
    expect(agendar).not.toHaveBeenCalled();
    expect(erro.mock.calls[0][0]).toMatch(/disco do contentor|pior do que não ter cópia/i);
  });

  test('uma expressão inválida não passa em silêncio', () => {
    process.env.BACKUP_CRON = 'todos os dias por favor';
    Object.assign(config.storage, { provider: 's3', bucket: 'b', accessKey: 'k', secretKey: 's', missing: [] });
    scheduleBackupJob();
    expect(agendar).not.toHaveBeenCalled();
    expect(erro.mock.calls[0][0]).toMatch(/BACKUP_CRON inválido/);
  });

  test('com S3 e expressão válida, agenda', () => {
    process.env.BACKUP_CRON = '0 3 * * *';
    Object.assign(config.storage, { provider: 's3', bucket: 'b', accessKey: 'k', secretKey: 's', missing: [] });
    scheduleBackupJob();
    expect(agendar).toHaveBeenCalledTimes(1);
    expect(agendar.mock.calls[0][0]).toBe('0 3 * * *');
    expect(info.mock.calls.some((c) => /agendada/i.test(c[0]))).toBe(true);
  });
});
