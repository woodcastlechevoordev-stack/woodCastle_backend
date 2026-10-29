require('dotenv').config();

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD;
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@woodcastle.local';
  const resetPassword = process.env.SEED_ADMIN_RESET === 'true';

  if (!password) {
    throw new Error('Set SEED_ADMIN_PASSWORD in the environment before seeding.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.upsert({
    where: { username },
    update: resetPassword ? { passwordHash, email } : {},
    create: {
      username,
      email,
      passwordHash,
      role: 'admin',
    },
  });

  const pages = [
    {
      key: 'about',
      title: 'About Woodcastle',
      content: 'Woodcastle crafts quality wood furniture for modern homes.',
    },
    {
      key: 'terms',
      title: 'Terms & Conditions',
      content: 'Update these terms from the admin panel.',
    },
    {
      key: 'contact',
      title: 'Contact',
      content: 'Reach us via the enquiry form or WhatsApp.',
    },
  ];

  for (const page of pages) {
    await prisma.staticPage.upsert({
      where: { key: page.key },
      update: {},
      create: page,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seed complete. Admin user: ${admin.username}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
