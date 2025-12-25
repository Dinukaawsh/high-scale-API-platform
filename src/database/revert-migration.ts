import dataSource from './data-source';

async function revertMigration() {
  try {
    console.log('Initializing data source...');
    await dataSource.initialize();

    console.log('Reverting last migration...');
    await dataSource.undoLastMigration();

    console.log('✅ Migration reverted successfully');

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Revert failed:', error);
    process.exit(1);
  }
}

void revertMigration();
