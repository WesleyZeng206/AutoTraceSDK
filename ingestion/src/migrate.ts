import runner from 'node-pg-migrate';
import { Pool } from 'pg';

async function migrate() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });
  let tries = 30;

  while (tries > 0) {
    try {
      await pool.query('SELECT 1');
      console.log('Database is ready');
      break;
    } catch {
      tries--;
      console.log(`Waiting for database... (${tries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  await pool.end();

  if (tries === 0) {
    console.error('Database connection timed out');
    process.exit(1);
  }

  await runner({
    databaseUrl: dbUrl,
    migrationsTable: 'pgmigrations',
    dir: 'src/db/migrations',
    direction: 'up',
    log: console.log,
  });

  console.log('Migrations completed successfully');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
