import runner from 'node-pg-migrate';
import { Pool } from 'pg';
import { config, ConfigError } from './config';

const MAX_TRIES = 30;

async function waitForDatabase(dbUrl: string): Promise<boolean> {
  const pool = new Pool({ connectionString: dbUrl });

  try {
    for (let triesLeft = MAX_TRIES; triesLeft > 0; triesLeft--) {
      try {
        await pool.query('SELECT 1');
        console.log('Database is ready');
        return true;
      } catch {
        console.log(`Waiting for database... (${triesLeft - 1} retries left)`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return false;
  } finally {
    await pool.end();
  }
}

async function migrate() {
  const dbUrl = config.databaseUrl;
  if (!await waitForDatabase(dbUrl)) {
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
  if (err instanceof ConfigError) {
    console.error(err.message);
  } else {
    console.error('Migration failed:', err);
  }

  process.exit(1);
});
