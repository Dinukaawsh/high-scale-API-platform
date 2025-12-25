# Workflow Troubleshooting Guide

## Common Issues and Solutions

### 1. **E2E Tests Failing - Database Connection**

**Error**: `Connection refused` or `database does not exist`

**Solution**: The CI workflow sets up PostgreSQL and Redis services automatically. If tests still fail:

- Check that services are healthy before tests run
- Verify environment variables are set correctly
- Ensure database name matches: `api_test_db`

### 2. **Build Failures**

**Error**: `TypeScript compilation errors` or `Module not found`

**Solution**:

- Run `pnpm install` locally to ensure dependencies are up to date
- Check `package.json` for missing dependencies
- Verify `tsconfig.json` is correct

### 3. **Docker Build Failures**

**Error**: `Docker build failed` or `Cannot find Dockerfile`

**Solution**:

- Ensure `Dockerfile` exists in root directory
- Check Dockerfile syntax
- Verify all required files are in repository

### 4. **Lint/Format Failures**

**Error**: `ESLint errors` or `Prettier formatting issues`

**Solution**:

```bash
# Fix locally
pnpm run lint
pnpm run format
```

### 5. **Test Failures**

**Error**: `Tests failing` or `Timeout`

**Solution**:

- Run tests locally: `pnpm test` and `pnpm test:e2e`
- Check test database is accessible
- Verify Redis connection
- Increase timeout if needed

### 6. **Missing Secrets**

**Error**: `Secret not found` or `Authentication failed`

**Solution**:

- Go to GitHub Settings → Secrets and variables → Actions
- Add required secrets (if deploying to external services)
- For GHCR, `GITHUB_TOKEN` is automatically available

### 7. **Branch Name Mismatch**

**Error**: Workflow not triggering

**Solution**:

- Ensure branch name matches workflow trigger (main/master/develop)
- Check workflow file branch configuration

## Quick Fixes

### Skip E2E Tests Temporarily

If E2E tests are causing issues, you can temporarily disable them:

```yaml
# In ci.yml, comment out the test-e2e job
# test-e2e:
#   ...
```

### Run Only Unit Tests

Modify CI to skip E2E tests:

```yaml
test-e2e:
  if: false # Disable temporarily
```

### Check Workflow Logs

1. Go to GitHub → Actions tab
2. Click on failed workflow
3. Click on failed job
4. Expand error messages to see details

## Getting Help

1. Check workflow logs in GitHub Actions
2. Run commands locally to reproduce errors
3. Check this troubleshooting guide
4. Review workflow configuration files
