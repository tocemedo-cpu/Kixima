// jest.config.js
module.exports = {
  testEnvironment: 'node',
  // env.js corre em cada worker antes dos módulos da app serem importados.
  setupFiles: ['<rootDir>/tests/env.js'],
  // globalSetup prepara a base de dados de teste uma única vez.
  globalSetup: '<rootDir>/tests/globalSetup.js',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 30000,
  // A app abre uma ligação Prisma; fechamos em afterAll, mas forceExit garante
  // que handles residuais (ex.: cron) não travam o processo de teste.
  forceExit: true,
  // Correr os ficheiros de teste em série: partilham a mesma base de dados.
  maxWorkers: 1,
};
