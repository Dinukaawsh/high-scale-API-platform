# CI/CD Pipeline Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline setup for the High-Scale API Platform.

## 🚀 Workflows Overview

### 1. CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**

- **Lint & Format Check**: Runs ESLint and Prettier checks
- **Unit Tests**: Executes Jest unit tests with coverage
- **E2E Tests**: Runs end-to-end tests with PostgreSQL and Redis services
- **Build**: Compiles TypeScript and verifies build artifacts
- **Security Audit**: Runs `pnpm audit` for dependency vulnerabilities

**Services:**

- PostgreSQL 16 (for E2E tests)
- Redis 7 (for E2E tests)

### 2. CD Workflow (`.github/workflows/cd.yml`)

Runs on pushes to `main` branch and version tags (`v*`).

**Jobs:**

- **Build & Push Docker Image**: Builds and pushes Docker image to GitHub Container Registry
- **Deploy to Staging**: Deploys to staging environment (on `main` branch)
- **Deploy to Production**: Deploys to production (on version tags)

**Docker Image Tags:**

- Branch name (e.g., `main`, `develop`)
- Version tags (e.g., `v1.0.0`, `v1.0`)
- SHA-based tags (e.g., `main-abc123`)
- `latest` (for default branch)

### 3. CodeQL Analysis (`.github/workflows/codeql.yml`)

Runs security analysis on:

- Push to `main`/`develop`
- Pull requests
- Weekly schedule (Sundays)

### 4. Release Workflow (`.github/workflows/release.yml`)

Automatically creates GitHub releases when version tags are pushed.

## 📋 Setup Instructions

### Prerequisites

1. **GitHub Repository**: Push your code to GitHub
2. **GitHub Actions**: Enabled by default (no setup needed)
3. **GitHub Container Registry**: Automatically available

### Required Secrets (Optional for Deployment)

If you need to deploy to external services, add these secrets in GitHub Settings → Secrets:

```bash
# For Docker Hub (if not using GHCR)
DOCKER_USERNAME=your-username
DOCKER_PASSWORD=your-password

# For Kubernetes
KUBECONFIG=base64-encoded-kubeconfig

# For AWS
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# For deployment scripts
DEPLOY_KEY=your-ssh-key
```

### Environment Configuration

Configure environments in GitHub Settings → Environments:

1. **Staging Environment**
   - Name: `staging`
   - URL: `https://staging.example.com`
   - Protection rules (optional): Required reviewers

2. **Production Environment**
   - Name: `production`
   - URL: `https://api.example.com`
   - Protection rules: Required reviewers, deployment branches

## 🔧 Customization

### Adding Deployment Steps

Edit `.github/workflows/cd.yml` and add your deployment commands:

```yaml
- name: Deploy to staging
  run: |
    # Example: Kubernetes
    kubectl set image deployment/api api=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} -n staging

    # Example: Docker Compose
    docker-compose -f docker-compose.staging.yml pull
    docker-compose -f docker-compose.staging.yml up -d

    # Example: AWS ECS
    aws ecs update-service --cluster staging --service api --force-new-deployment
```

### Modifying Test Matrix

To test against multiple Node.js versions, update `ci.yml`:

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
```

### Adding Additional Checks

Add new jobs to `ci.yml`:

```yaml
type-check:
  name: TypeScript Type Check
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v2
    - uses: actions/setup-node@v4
    - run: pnpm install --frozen-lockfile
    - run: pnpm exec tsc --noEmit
```

## 📊 Monitoring

### View Workflow Runs

1. Go to your GitHub repository
2. Click **Actions** tab
3. View workflow runs, logs, and artifacts

### Coverage Reports

Coverage reports are uploaded to Codecov (if configured). View at:

- https://codecov.io/gh/YOUR_USERNAME/YOUR_REPO

### Docker Images

View published images at:

- https://github.com/YOUR_USERNAME/YOUR_REPO/pkgs/container/YOUR_REPO

## 🐛 Troubleshooting

### Tests Failing in CI

1. **Database Connection Issues**
   - Check service health checks in workflow
   - Verify environment variables are set correctly

2. **Build Failures**
   - Check Node.js version matches local
   - Verify all dependencies are in `package.json`

3. **Docker Build Failures**
   - Check Dockerfile syntax
   - Verify build context includes all necessary files

### Deployment Failures

1. **Authentication Errors**
   - Verify secrets are set correctly
   - Check permissions for deployment actions

2. **Service Unavailable**
   - Verify target environment is accessible
   - Check network/firewall rules

## 🔐 Security Best Practices

1. **Never commit secrets**: Use GitHub Secrets
2. **Use least privilege**: Grant minimal permissions to workflows
3. **Review dependencies**: Regularly update and audit dependencies
4. **Enable branch protection**: Require PR reviews and status checks
5. **Use environment protection**: Protect production deployments

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)

## 🎯 Next Steps

1. **Configure Environments**: Set up staging/production environments
2. **Add Deployment Scripts**: Customize deployment steps for your infrastructure
3. **Set Up Monitoring**: Integrate with monitoring tools (Datadog, New Relic, etc.)
4. **Configure Notifications**: Add Slack/email notifications for deployments
5. **Add Rollback Strategy**: Implement automated rollback on deployment failures

---

**Note**: The deployment steps in `cd.yml` are placeholders. Customize them based on your infrastructure (Kubernetes, AWS, Azure, etc.).
