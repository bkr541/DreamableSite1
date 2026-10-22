// Usage: ADMIN_PASSWORD='…' node --env-file=.env.local prisma/create-admin.mjs <email> "<Full Name>"
// Creates the user, or promotes + resets the password of an existing one. Same scrypt format as lib/auth.ts.
import { PrismaClient } from '@prisma/client';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const [emailArg, name] = process.argv.slice(2);
const password = process.env.ADMIN_PASSWORD;

if (!emailArg || !name || !password) {
  console.error('Usage: ADMIN_PASSWORD=… node --env-file=.env.local prisma/create-admin.mjs <email> "<Full Name>"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

const email = emailArg.toLowerCase().trim();
const salt = randomBytes(16).toString('hex');
const passwordHash = `${salt}:${(await scryptAsync(password, salt, 64)).toString('hex')}`;

const prisma = new PrismaClient();
try {
  const user = await prisma.user.upsert({
    where: { email },
    update: { admin: true, passwordHash, status: 'ACTIVE' },
    create: { email, name, passwordHash, admin: true, role: 'ADMIN', status: 'ACTIVE' },
    select: { id: true, email: true, admin: true },
  });
  console.log('Admin ready:', user);
} finally {
  await prisma.$disconnect();
}
