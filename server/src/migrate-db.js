import 'dotenv/config';
import { readFileSync } from 'fs';
import { query } from './db.js';

async function runMigration() {
  try {
    console.log('Running database migration...');
    
    // Read and execute the migration SQL
    const migrationSQL = readFileSync('./sql/003_migrate_add_created_by.sql', 'utf8');
    
    // Split the SQL into individual statements and execute them
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        await query(statement);
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
