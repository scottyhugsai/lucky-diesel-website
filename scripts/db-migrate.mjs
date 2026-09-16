#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql in filename order, once each, inside a
 * transaction per file. Usage: node --env-file=.env.local scripts/db-migrate.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const url = process.env.POSTGRES_URL_NON_POOLING;
if (!url) {
  console.error('POSTGRES_URL_NON_POOLING is not set. Run with --env-file=.env.local');
  process.exit(1);
}

const dir = path.resolve('supabase/migrations');
const sql = postgres(url, { ssl: 'require', max: 1, onnotice: () => {} });

try {
  await sql`create schema if not exists ops`;
  await sql`create table if not exists ops._migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql`select name from ops._migrations`).map((row) => row.name));
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const body = await readFile(path.join(dir, file), 'utf8');
    process.stdout.write(`applying ${file} … `);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into ops._migrations (name) values (${file})`;
    });
    console.log('ok');
  }
  console.log('migrations up to date');
} catch (error) {
  console.error('\nmigration failed:', error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
