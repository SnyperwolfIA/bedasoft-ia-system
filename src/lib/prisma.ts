import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prismaClientSingleton = () => {
  let dbUrl = process.env.DATABASE_URL;

  if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
    const srcDb = path.join(process.cwd(), 'prisma', 'dev.db');
    const destDb = '/tmp/dev.db';
    
    try {
      const destDir = path.dirname(destDb);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      if (!fs.existsSync(destDb)) {
        if (fs.existsSync(srcDb)) {
          fs.copyFileSync(srcDb, destDb);
          console.log('[Prisma] SQLite database copied from', srcDb, 'to', destDb, 'successfully.');
        } else {
          console.warn('[Prisma] Source SQLite database not found at:', srcDb);
        }
      } else {
        console.log('[Prisma] SQLite database already exists at /tmp/dev.db, skipping copy.');
      }
      // Force Prisma to use the writable database in /tmp
      dbUrl = 'file:/tmp/dev.db';
    } catch (e) {
      console.error('[Prisma] Error copying SQLite database to /tmp:', e);
    }
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
