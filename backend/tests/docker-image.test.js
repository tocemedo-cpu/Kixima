// tests/docker-image.test.js
// Verifica que tudo o que o arranque do contentor invoca chega mesmo à imagem.
//
// Existe por causa de uma avaria real: o comando de arranque passou a chamar
// scripts/migrate-boot.js, mas o Dockerfile só copiava `prisma` e `src`. O
// ficheiro existia no repositório e não no contentor, e o arranque morria com
// «Cannot find module '/app/scripts/migrate-boot.js'» — as migrações nunca
// chegaram a correr, em produção.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');

// Pastas/ficheiros do backend copiados para /app (COPY backend/<origem> ./<destino>).
function copiedPaths() {
  return [...dockerfile.matchAll(/^COPY\s+backend\/(\S+)\s+\.\/(\S+)/gm)].map((m) => ({
    origem: m[1].replace(/\/$/, ''),
    destino: m[2].replace(/^\.\//, '').replace(/\/$/, ''),
  }));
}

// Caminhos .js que o CMD executa: `node <caminho>`.
function cmdScripts() {
  const cmd = dockerfile.match(/^CMD\s+\[(.+)\]/m)?.[1] || '';
  return [...cmd.matchAll(/node\s+((?:\w|[./-])+\.js)/g)].map((m) => m[1]);
}

describe('Imagem Docker', () => {
  const copiados = copiedPaths();

  test('o Dockerfile copia alguma coisa do backend', () => {
    expect(copiados.length).toBeGreaterThan(0);
  });

  test.each(cmdScripts())('o arranque invoca %s — e o ficheiro entra na imagem', (script) => {
    // O ficheiro tem de existir no repositório...
    const noRepo = path.join(__dirname, '..', script);
    expect(fs.existsSync(noRepo)).toBe(true);

    // ...e estar coberto por um COPY que o leve para /app com o mesmo caminho.
    const coberto = copiados.some((c) => c.destino === script.split('/')[0] || c.destino === script);
    expect(coberto).toBe(true);
  });

  test('todas as origens copiadas existem no repositório', () => {
    const emFalta = copiados.filter((c) => !fs.existsSync(path.join(ROOT, 'backend', c.origem)));
    expect(emFalta.map((c) => c.origem)).toEqual([]);
  });
});
