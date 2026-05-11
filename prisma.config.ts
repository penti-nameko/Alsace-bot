import path from 'path';
import { defineConfig } from '@prisma/config';

const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');

export default defineConfig({
  datasource: {
    url: `file:${dbPath}`,
  }
});