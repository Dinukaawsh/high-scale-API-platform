# GitHub Secrets & Variables Setup Guide

This guide explains what secrets and variables you need to configure in GitHub for CI/CD workflows.

## 🔐 Required Secrets

### For CI/CD Workflows (Currently Used)

**None required!** The workflows use GitHub's built-in `GITHUB_TOKEN` which is automatically available.

### For Production Deployment (When You Deploy)

When you're ready to deploy to production, you'll need to set these secrets:

#### 1. Database Secrets (if using managed database)

```
DATABASE_HOST          # e.g., db.example.com
DATABASE_PORT          # e.g., 5432
DATABASE_USER          # e.g., postgres
DATABASE_PASSWORD      # Your database password
DATABASE_NAME          # e.g., api_db
```

#### 2. Redis Secrets (if using managed Redis)

```
REDIS_HOST            # e.g., redis.example.com
REDIS_PORT            # e.g., 6379
REDIS_PASSWORD        # Your Redis password (leave empty if no password)
```

#### 3. JWT Secrets (REQUIRED for production)

```
JWT_SECRET            # Strong random secret for access tokens
JWT_REFRESH_SECRET    # Strong random secret for refresh tokens
```

**Generate secure secrets:**

```bash
# Generate JWT secrets (use different values for each!)
openssl rand -base64 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 4. Application Secrets (Optional)

```
NODE_ENV              # production
PORT                  # 3000 (or your port)
CORS_ORIGIN           # https://yourdomain.com (comma-separated for multiple)
```

#### 5. Deployment Platform Secrets (if using cloud services)

**For AWS:**

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
```

**For Google Cloud:**

```
GCP_SA_KEY            # Service account JSON key
GCP_PROJECT_ID
```

**For Azure:**

```
AZURE_CLIENT_ID
AZURE_CLIENT_SECRET
AZURE_TENANT_ID
```

**For Kubernetes:**

```
KUBECONFIG            # Base64 encoded kubeconfig file
```

## 📝 How to Set Secrets in GitHub

### Step 1: Navigate to Repository Settings

1. Go to your GitHub repository
2. Click **Settings** (top menu)
3. Click **Secrets and variables** → **Actions** (left sidebar)

### Step 2: Add a New Secret

1. Click **New repository secret**
2. Enter the **Name** (e.g., `JWT_SECRET`)
3. Enter the **Secret** value
4. Click **Add secret**

### Step 3: Verify Secrets

You can verify secrets are set by checking the list (values are hidden for security).

## 🔄 Using Secrets in Workflows

Secrets are accessed in workflows using `${{ secrets.SECRET_NAME }}`:

```yaml
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
```

## 🎯 Environment-Specific Secrets

For different environments (staging/production), you can:

### Option 1: Use Environment Secrets (Recommended)

1. Go to **Settings** → **Environments**
2. Create environments: `staging`, `production`
3. Add secrets to each environment
4. Reference in workflow:

```yaml
jobs:
  deploy:
    environment: production
    steps:
      - name: Deploy
        env:
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### Option 2: Use Prefixes

Use naming conventions:

- `STAGING_JWT_SECRET`
- `PROD_JWT_SECRET`

## 📋 Quick Setup Checklist

### Minimum for CI/CD (Current State)

- ✅ **Nothing needed** - `GITHUB_TOKEN` is automatic

### For Production Deployment

- [ ] `JWT_SECRET` - Generate secure random string
- [ ] `JWT_REFRESH_SECRET` - Generate secure random string
- [ ] `DATABASE_HOST` - Your database hostname
- [ ] `DATABASE_USER` - Database username
- [ ] `DATABASE_PASSWORD` - Database password
- [ ] `DATABASE_NAME` - Database name
- [ ] `REDIS_HOST` - Redis hostname (if using managed Redis)
- [ ] `REDIS_PASSWORD` - Redis password (if required)

## 🔒 Security Best Practices

1. **Never commit secrets to code** - Always use GitHub Secrets
2. **Use different secrets for each environment** - Don't reuse staging secrets in production
3. **Rotate secrets regularly** - Especially JWT secrets
4. **Use strong random secrets** - Use `openssl` or `crypto.randomBytes()`
5. **Limit secret access** - Use environment protection rules
6. **Audit secret usage** - Review who has access to secrets

## 🚨 Important Notes

- Secrets are **encrypted** and only visible to repository admins
- Secrets are **not visible** in workflow logs (they're masked automatically)
- Secrets are **environment-specific** if using GitHub Environments
- Secrets can be **restricted** to specific branches/environments

## 📚 Example: Setting Up Production Secrets

```bash
# 1. Generate JWT secrets
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# 2. Add to GitHub Secrets:
# - Go to Settings → Secrets and variables → Actions
# - Add JWT_SECRET: <paste first value>
# - Add JWT_REFRESH_SECRET: <paste second value>
# - Add DATABASE_HOST: your-db-host.com
# - Add DATABASE_PASSWORD: your-secure-password
# - etc.
```

## 🔍 Current Workflow Status

**CI Workflow** (`ci.yml`):

- ✅ Uses `GITHUB_TOKEN` (automatic)
- ✅ No additional secrets needed

**CD Workflow** (`cd.yml`):

- ✅ Uses `GITHUB_TOKEN` for GHCR (automatic)
- ⚠️ Will need secrets when you add actual deployment steps

**Release Workflow** (`release.yml`):

- ✅ Uses `GITHUB_TOKEN` (automatic)
- ✅ No additional secrets needed

---

**Next Steps:**

1. Set up secrets when you're ready to deploy
2. Configure environment protection rules
3. Add deployment steps to `cd.yml` that use these secrets
