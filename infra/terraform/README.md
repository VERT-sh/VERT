# Azure demo infrastructure

This Terraform configuration creates a low-idle-cost Azure Container Apps demo
and the GitHub Actions OIDC identity used by `.github/workflows/docker.yml`.
The app starts with a public sample image; the next push to `main` replaces it
with the VERT image built and published to GHCR.

The Container App uses Consumption scaling from zero to one replica. Its
environment streams logs without creating a Log Analytics workspace.

## Requirements

- Terraform 1.6 or newer
- Azure CLI logged in to the target subscription (`az login`)
- Permissions to create resource groups, Container Apps resources, Entra ID
  application registrations/service principals, and role assignments
- GitHub repository `JakubMadro/VERT` (or update `github_repository`)

## Plan and apply

From this directory:

```sh
az account show --query id -o tsv
terraform init
terraform plan -var="subscription_id=$(az account show --query id -o tsv)"
terraform apply -var="subscription_id=$(az account show --query id -o tsv)"
```

Review the plan before applying. The apply creates Azure resources and may
incur usage charges. It does not configure GitHub repository variables or
secrets automatically.

## Connect GitHub Actions

After applying, copy these Terraform outputs into GitHub repository **Settings
→ Secrets and variables → Actions → Variables**:

| GitHub variable | Terraform output |
| --- | --- |
| `AZURE_CLIENT_ID` | `github_actions_client_id` |
| `AZURE_TENANT_ID` | `azure_tenant_id` |
| `AZURE_SUBSCRIPTION_ID` | `azure_subscription_id` |
| `AZURE_RESOURCE_GROUP` | `resource_group_name` |
| `AZURE_CONTAINER_APP_NAME` | `container_app_name` |

Add `GHCR_PULL_USERNAME` and `GHCR_PULL_TOKEN` as repository secrets. The token
must be a GitHub classic personal access token with `read:packages` access to
the VERT package. The workflow updates the Container App's GHCR credentials on
each deployment. Alternatively, make the GHCR package public and remove that
credential step from the workflow.

## State

Terraform uses local state by default. Keep `terraform.tfstate` private and out
of Git. For shared or company use, configure an encrypted remote state backend
before applying from more than one machine.

To remove the demo later, run `terraform destroy` with the same
`subscription_id`; this deletes the resource group and the GitHub Actions Entra
application created by this configuration.
