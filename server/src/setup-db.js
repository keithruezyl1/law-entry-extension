import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Read and execute SQL files
    const sqlFiles = [
      join(__dirname, '../sql/001_init.sql'),
      join(__dirname, '../sql/002_match_fn.sql')
    ];

    for (const sqlFile of sqlFiles) {
      try {
        const sql = readFileSync(sqlFile, 'utf8');
        await client.query(sql);
        console.log(`Executed ${sqlFile}`);
      } catch (error) {
        // Ignore errors for existing objects
        if (error.message.includes('already exists')) {
          console.log(`Skipped ${sqlFile} - objects already exist`);
        } else {
          console.error(`Error executing ${sqlFile}:`, error.message);
        }
      }
    }

    console.log('Database setup completed');
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase();
}

