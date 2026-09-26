# Atlas Cloud Intelligence — Azure production deployment

Atlas Cloud is deployed to **Azure Container Apps** in `southafricanorth` using GitHub Actions OIDC. The deployment keeps model credentials and the mobile API token on the server; the Android APK receives only the HTTPS Atlas endpoint and a short-lived/authenticated client session in the future production identity flow.

## Production resources

The infrastructure templates create:

- Azure Container Registry with admin access disabled
- User-assigned managed identity for private image pull
- `AcrPull` role assignment scoped to the registry
- Log Analytics workspace
- Azure Container Apps managed environment
- Externally reachable Container App with HTTPS-only ingress on port 8080
- 1–5 replicas with an HTTP concurrency scale rule
- readiness and liveness checks against `/health`

## Required GitHub production-environment secrets

The manual deployment workflow requires these secrets:

- `AZURE_CLIENT_ID` — Microsoft Entra application/client ID for GitHub OIDC
- `AZURE_TENANT_ID` — Entra tenant ID
- `AZURE_SUBSCRIPTION_ID` — Azure subscription ID
- `ATLAS_AI_BASE_URL` — provider base URL, without a trailing `/responses`
- `ATLAS_AI_API_KEY` — server-side model/provider key
- `ATLAS_AI_MODEL` — deployed model name
- `ATLAS_MOBILE_SHARED_TOKEN` — temporary mobile API bearer token, at least 24 characters

The GitHub OIDC federated credential should trust the repository production environment subject:

`repo:dansofrank97/atlas-android-test:environment:production`

The Azure identity used by GitHub needs enough permissions to create resources in the production resource group and submit ACR builds. Do not store an Azure client secret in GitHub.

## Deployment gate

The workflow `.github/workflows/deploy-cloud.yml` runs only through `workflow_dispatch` and requires the explicit `deploy=true` input. Ordinary pushes cannot deploy production.

The workflow performs:

1. Required-secret validation.
2. GitHub → Azure OIDC login.
3. Bicep validation.
4. Resource-group creation.
5. Foundation infrastructure deployment.
6. Immutable container build tagged with the Git commit SHA.
7. Container App deployment.
8. HTTPS `/health` verification.
9. Authenticated `/v1/mobile/ask` smoke test.
10. Publication of the resulting API endpoint in the GitHub Actions summary.

## Android endpoint

After the deployment succeeds, set Atlas Cloud in the Android test app to:

`https://<container-app-fqdn>/v1/mobile/ask`

The current APK keeps the endpoint configurable so a new APK is not required merely to change the service hostname.

## Security note

`ATLAS_MOBILE_SHARED_TOKEN` is a controlled test-stage guard, not the final identity design. Production user access should be upgraded to Entra/OIDC JWT validation with tenant, user, workspace, role and permission claims before Atlas is used as a system of record with real company data.
