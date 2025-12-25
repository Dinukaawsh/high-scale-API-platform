# Database Migrations Guide

This project uses TypeORM migrations for database schema management.

## Migration Commands

### Create a new migration

```bash
pnpm run migration:create migrations/YourMigrationName
```

### Generate migration from entity changes

```bash
pnpm run migration:generate migrations/YourMigrationName
```

### Run pending migrations

```bash
pnpm run migration:run
```

### Revert last migration

```bash
pnpm run migration:revert
```

### Show migration status

```bash
pnpm run migration:show
```

## Migration Workflow

### Development

1. **Make changes to entities** (e.g., `user.entity.ts`)
2. **Generate migration**:
   ```bash
   pnpm run migration:generate migrations/AddNewFieldToUser
   ```
3. **Review the generated migration** in `migrations/` directory
4. **Run migration**:
   ```bash
   pnpm run migration:run
   ```

### Production

1. **Build the application**:

   ```bash
   pnpm run build
   ```

2. **Run migrations** (before starting the app):

   ```bash
   pnpm run migration:run
   ```

3. **Start the application**:
   ```bash
   pnpm run start:prod
   ```

## Migration Best Practices

1. **Always review generated migrations** before running
2. **Test migrations** in development/staging first
3. **Never edit existing migrations** that have been run in production
4. **Create new migrations** for schema changes
5. **Use transactions** for data migrations
6. **Backup database** before running migrations in production

## Current Migrations

- `1735128000000-CreateUsersTable` - Creates the users table with UUID primary key

## Troubleshooting

### Migration fails

- Check database connection
- Verify environment variables are set
- Check migration file syntax
- Review database logs

### Rollback migration

```bash
pnpm run migration:revert
```

### Manual migration check

```bash
# Connect to database
psql -U postgres -d api_db

# Check migrations table
SELECT * FROM migrations;
```
