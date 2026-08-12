// tests/migrations.test.js
// Guarda-costas do histórico de migrações.
//
// Existe por causa de uma avaria real: uma migração já aplicada em produção foi
// editada para lhe acrescentar duas colunas. O `migrate deploy` salta as
// migrações que já constam do registo, por isso essas colunas nunca chegaram a
// ser criadas — a aplicação passou a rebentar com «column does not exist» e nada
// no log das migrações denunciava o problema.
const { diff } = require('../scripts/migration-lock');

describe('Histórico de migrações', () => {
  const { alteradas, removidas, novas } = diff();

  test('nenhuma migração já publicada foi alterada', () => {
    // Se falhar: reponha o ficheiro como estava e ponha a alteração numa
    // migração NOVA. As bases que já aplicaram esta nunca a voltam a correr.
    expect(alteradas).toEqual([]);
  });

  test('nenhuma migração já publicada foi removida', () => {
    expect(removidas).toEqual([]);
  });

  test('as migrações novas estão registadas (npm run migrations:lock)', () => {
    expect(novas).toEqual([]);
  });
});
