import { DataSource } from 'typeorm';
import dataSource from './data-source';

async function runMigrations() {
  try {
    console.log('Initializing data source...');
    await dataSource.initialize();

    console.log('Running migrations...');
    const migrations = await dataSource.runMigrations();

    if (migrations.length === 0) {
      console.log('No pending migrations.');
    } else {
      console.log(`✅ Ran ${migrations.length} migration(s):`);
      migrations.forEach((migration) => {
        console.log(`   - ${migration.name}`);
      });
    }

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
