import { DataSource } from 'typeorm';
import dataSource from './data-source';

async function showMigrations() {
  try {
    console.log('Initializing data source...');
    await dataSource.initialize();

    // Get all migrations
    const allMigrations = dataSource.migrations;

    // Check which migrations have been executed
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    // Check if migrations table exists
    const migrationsTableExists = await queryRunner.hasTable('migrations');

    let executedMigrations: string[] = [];
    if (migrationsTableExists) {
      const result = await queryRunner.query(
        'SELECT name FROM migrations ORDER BY timestamp',
      );
      executedMigrations = result.map((row: any) => row.name);
    }

    const pendingMigrations = allMigrations.filter((migration) => {
      const name = migration.name;
      return name ? !executedMigrations.includes(name) : true;
    });

    console.log('\n📊 Migration Status:\n');
    console.log('Executed migrations:');
    if (executedMigrations.length === 0) {
      console.log('  (none)');
    } else {
      executedMigrations.forEach((name) => {
        console.log(`  ✅ ${name}`);
      });
    }

    console.log('\nPending migrations:');
    if (pendingMigrations.length === 0) {
      console.log('  (none)');
    } else {
      pendingMigrations.forEach((migration) => {
        const name = migration.name || migration.constructor.name;
        console.log(`  ⏳ ${name}`);
      });
    }

    await queryRunner.release();
    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to show migrations:', error);
    process.exit(1);
  }
}

showMigrations();
