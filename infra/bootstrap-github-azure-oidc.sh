#!/usr/bin/env bash
set -euo pipefail

# One-time bootstrap for GitHub Actions -> Azure OIDC.
# Run this from Azure Cloud Shell (or any machine with az CLI) while signed in
# as an identity allowed to create Entra applications and Azure role assignments.

REPO="${REPO:-dansofrank97/atlas-android-test}"
GITHUB_ENVIRONMENT="${GITHUB_ENVIRONMENT:-production}"
RESOURCE_GROUP="${RESOURCE_GROUP:-atlas-cloud-prod-rg}"
LOCATION="${LOCATION:-southafricanorth}"
APP_DISPLAY_NAME="${APP_DISPLAY_NAME:-atlas-github-deploy}"

command -v az >/dev/null 2>&1 || { echo 'Azure CLI (az) is required.' >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo 'curl is required.' >&2; exit 1; }

SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-$(az account show --query id -o tsv)}"
TENANT_ID="$(az account show --query tenantId -o tsv)"

if [[ -z "$SUBSCRIPTION_ID" || -z "$TENANT_ID" ]]; then
  echo 'No active Azure subscription/tenant was found. Run az login and select the intended subscription.' >&2
  exit 1
fi

az account set --subscription "$SUBSCRIPTION_ID"
echo "Using subscription: $SUBSCRIPTION_ID"
echo "Using tenant:       $TENANT_ID"

# Create the production resource group up front so GitHub can be scoped to it,
# rather than receiving subscription-wide Contributor access.
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
RG_ID="$(az group show --name "$RESOURCE_GROUP" --query id -o tsv)"

APP_ID="$(az ad app list --display-name "$APP_DISPLAY_NAME" --query '[0].appId' -o tsv 2>/dev/null || true)"
if [[ -z "$APP_ID" ]]; then
  APP_ID="$(az ad app create --display-name "$APP_DISPLAY_NAME" --query appId -o tsv)"
  echo "Created Entra application: $APP_DISPLAY_NAME"
else
  echo "Reusing Entra application: $APP_DISPLAY_NAME"
fi

OBJECT_ID="$(az ad app show --id "$APP_ID" --query id -o tsv)"
SP_OBJECT_ID="$(az ad sp list --filter "appId eq '$APP_ID'" --query '[0].id' -o tsv 2>/dev/null || true)"
if [[ -z "$SP_OBJECT_ID" ]]; then
  SP_OBJECT_ID="$(az ad sp create --id "$APP_ID" --query id -o tsv)"
  echo 'Created service principal.'
else
  echo 'Reusing service principal.'
fi

# Resource creation/updates inside the production resource group.
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope "$RG_ID" \
  --output none 2>/dev/null || true

# Atlas foundation creates an AcrPull role assignment for its managed identity.
# This scoped RBAC role permits GitHub to create/delete role assignments only
# within this production resource group.
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role 'Role Based Access Control Administrator' \
  --scope "$RG_ID" \
  --output none 2>/dev/null || true

OWNER="${REPO%%/*}"
REPO_NAME="${REPO#*/}"
REPO_JSON="$(curl -fsSL -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/${REPO}")"
OWNER_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["owner"]["id"])' <<<"$REPO_JSON")"
REPO_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<<"$REPO_JSON")"

# GitHub repositories created after July 15, 2026 use immutable OIDC subject
# claims containing both owner ID and repository ID. Atlas uses that format.
IMMUTABLE_SUBJECT="repo:${OWNER}@${OWNER_ID}/${REPO_NAME}@${REPO_ID}:environment:${GITHUB_ENVIRONMENT}"
IMMUTABLE_CREDENTIAL_NAME="atlas-github-${GITHUB_ENVIRONMENT}-immutable"

EXISTING_IMMUTABLE="$(az ad app federated-credential list --id "$OBJECT_ID" --query "[?name=='$IMMUTABLE_CREDENTIAL_NAME'].name | [0]" -o tsv 2>/dev/null || true)"
if [[ -z "$EXISTING_IMMUTABLE" ]]; then
  TMP_JSON="$(mktemp)"
  trap 'rm -f "$TMP_JSON"' EXIT
  cat > "$TMP_JSON" <<JSON
{
  "name": "$IMMUTABLE_CREDENTIAL_NAME",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "$IMMUTABLE_SUBJECT",
  "description": "GitHub Actions immutable OIDC subject for Atlas production environment",
  "audiences": ["api://AzureADTokenExchange"]
}
JSON
  az ad app federated-credential create --id "$OBJECT_ID" --parameters "$TMP_JSON" --output none
  echo "Created immutable federated credential for: $IMMUTABLE_SUBJECT"
else
  echo "Immutable federated credential already exists: $IMMUTABLE_CREDENTIAL_NAME"
fi

# Keep the legacy name-based credential too for compatibility with older subject
# formats. Azure can safely hold both credentials on the same application.
LEGACY_SUBJECT="repo:${REPO}:environment:${GITHUB_ENVIRONMENT}"
LEGACY_CREDENTIAL_NAME="atlas-github-${GITHUB_ENVIRONMENT}"
EXISTING_LEGACY="$(az ad app federated-credential list --id "$OBJECT_ID" --query "[?name=='$LEGACY_CREDENTIAL_NAME'].name | [0]" -o tsv 2>/dev/null || true)"
if [[ -z "$EXISTING_LEGACY" ]]; then
  TMP_JSON_LEGACY="$(mktemp)"
  cat > "$TMP_JSON_LEGACY" <<JSON
{
  "name": "$LEGACY_CREDENTIAL_NAME",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "$LEGACY_SUBJECT",
  "description": "GitHub Actions legacy OIDC subject for Atlas production environment",
  "audiences": ["api://AzureADTokenExchange"]
}
JSON
  az ad app federated-credential create --id "$OBJECT_ID" --parameters "$TMP_JSON_LEGACY" --output none
  rm -f "$TMP_JSON_LEGACY"
  echo "Created legacy federated credential for: $LEGACY_SUBJECT"
else
  echo "Legacy federated credential already exists: $LEGACY_CREDENTIAL_NAME"
fi

cat <<EOF

Atlas GitHub -> Azure OIDC bootstrap complete.

Add these three values to the GitHub 'production' environment secrets:

AZURE_CLIENT_ID=$APP_ID
AZURE_TENANT_ID=$TENANT_ID
AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID

Then add the Atlas provider secrets:
ATLAS_AI_BASE_URL=<your model provider base URL>
ATLAS_AI_API_KEY=<server-side provider key>
ATLAS_AI_MODEL=<deployed model name>
ATLAS_MOBILE_SHARED_TOKEN=<random value of at least 24 characters>

Immutable federated subject:
$IMMUTABLE_SUBJECT

Legacy federated subject retained for compatibility:
$LEGACY_SUBJECT

No Azure client secret was created.
EOF
