#!/bin/bash

# Create database script
# Usage: ./scripts/create-database.sh

DB_NAME="${DATABASE_NAME:-api_db}"
DB_USER="${DATABASE_USER:-postgres}"
DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"

echo "Creating database: $DB_NAME"

# Try to create database using psql
PGPASSWORD="${DATABASE_PASSWORD:-postgres}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "Database '$DB_NAME' created successfully!"
else
    echo "Failed to create database. Trying alternative method..."

    # Alternative: Use docker exec if postgres is in docker
    docker exec -i $(docker ps -qf "ancestor=postgres") psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null

    if [ $? -eq 0 ]; then
        echo "Database '$DB_NAME' created successfully via Docker!"
    else
        echo "Please create the database manually:"
        echo "  psql -U $DB_USER -c 'CREATE DATABASE $DB_NAME;'"
        echo ""
        echo "Or start services with docker-compose:"
        echo "  docker-compose up -d postgres"
        echo "  docker-compose exec postgres psql -U postgres -c 'CREATE DATABASE $DB_NAME;'"
    fi
fi

