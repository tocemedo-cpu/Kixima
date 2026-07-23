// prisma/seed.js
// Seed de PRODUÇÃO: cria (ou atualiza) apenas o Administrador do Sistema KIXIMA.
// Nenhum dado de demonstração é criado aqui.
//
// As credenciais vêm do ambiente (nunca ficam no código/repositório). Defina no
// ficheiro .env do backend:
//   ADMIN_EMAIL=zelyvaldog@gmail.com
//   ADMIN_PASSWORD=a-sua-senha
//   ADMIN_NAME=Administrador KIXIMA   (opcional)
//
// Correr com: npm run seed
// É idempotente — pode correr várias vezes (atualiza a senha/nome se mudar).

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = process.env.ADMIN_NAME || 'Administrador KIXIMA';

  if (!email || !password) {
    throw new Error(
      'Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env antes de correr o seed.'
    );
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD deve ter pelo menos 8 caracteres.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: 'ADMIN_SISTEMA', active: true, companyId: null },
    create: { name, email, passwordHash, role: 'ADMIN_SISTEMA', companyId: null },
  });

  console.log(`Administrador do Sistema pronto: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
