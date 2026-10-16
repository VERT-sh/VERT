# GitHub Container Registry to Azure Container Apps

The `Docker Image CI` workflow builds the Docker image and publishes it to
GitHub Container Registry (GHCR). On pushes to `main`, it then updates an
existing Azure Container App to use the image tagged with that exact commit
SHA. Pull requests build the image without publishing or deploying it. Version
tags publish images but do not deploy them.

## One-time setup

1. Create an Azure Container Apps environment and Container App. Configure the
   app to listen on port `80`. The workflow updates an existing app; it does
   not create Azure resources.
2. Create an Entra ID application/service principal for GitHub Actions and
   configure a federated identity credential for this repository's `main`
   branch. Grant it Contributor on the resource group containing the Container
   App (or a narrower role that can update the app and its registry settings).
   GitHub's OIDC provider is `https://token.actions.githubusercontent.com`;
   the audience is `api://AzureADTokenExchange` and the subject is
   `repo:OWNER/REPOSITORY:ref:refs/heads/main`.
3. In GitHub repository **Settings → Secrets and variables → Actions**, add
   these repository variables:

   - `AZURE_CLIENT_ID`
   - `AZURE_TENANT_ID`
   - `AZURE_SUBSCRIPTION_ID`
   - `AZURE_RESOURCE_GROUP`
   - `AZURE_CONTAINER_APP_NAME`

4. Add these repository secrets for pulling the private GHCR package:

   - `GHCR_PULL_USERNAME`: GitHub username that can read the package
   - `GHCR_PULL_TOKEN`: a classic personal access token with `read:packages`

   Alternatively, make the GHCR package public and remove the
   **Configure GHCR image pull credentials** step from the workflow.
5. Optionally set `PUB_HOSTNAME`, `PUB_PLAUSIBLE_URL`, `PUB_VERTD_URL`, and
   `PUB_DISABLE_ALL_EXTERNAL_REQUESTS` as repository variables. The external
   request flag defaults to `true` for the airgap-oriented build configuration.
   Set the variable to `false` only if you want to override that default. This
   flag alone does not make the current application fully air-gapped: the
   FFmpeg worker is still fetched from jsDelivr and must be bundled locally
   before an offline deployment.

After setup, every push to `main` publishes `ghcr.io/OWNER/REPOSITORY:sha-<full-commit-sha>`
and deploys that image. The same image can later be exported from GHCR and
imported into a company registry for offline deployment.
