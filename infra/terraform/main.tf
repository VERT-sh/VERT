data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "demo" {
  name     = "${var.name_prefix}-rg"
  location = var.location
  tags     = var.tags
}

resource "azurerm_container_app_environment" "demo" {
  name                = "${var.name_prefix}-env"
  location            = azurerm_resource_group.demo.location
  resource_group_name = azurerm_resource_group.demo.name
  tags                = var.tags

  # Omit Log Analytics to keep idle demo costs down. Container logs are still
  # available through the live log stream.
}

resource "azurerm_container_app" "demo" {
  name                         = "${var.name_prefix}-app"
  container_app_environment_id = azurerm_container_app_environment.demo.id
  resource_group_name          = azurerm_resource_group.demo.name
  revision_mode                = "Single"
  tags                         = var.tags

  template {
    min_replicas = 0
    max_replicas = 1

    container {
      name   = "vert"
      image  = var.initial_image
      cpu    = 0.25
      memory = "0.5Gi"
    }
  }

  ingress {
    external_enabled = true
    target_port      = 80
    transport        = "http"

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

resource "azuread_application" "github_actions" {
  display_name = "${var.name_prefix}-github-actions"
}

resource "azuread_service_principal" "github_actions" {
  client_id = azuread_application.github_actions.client_id
}

resource "azuread_application_federated_identity_credential" "github_main" {
  application_id = azuread_application.github_actions.id
  display_name   = "github-${var.github_branch}"
  description    = "GitHub Actions deployment for ${var.github_repository} (${var.github_branch})"
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://token.actions.githubusercontent.com"
  subject        = "repo:${var.github_repository}:ref:refs/heads/${var.github_branch}"
}

# The deployment identity can update resources only inside this demo resource
# group. It cannot create or modify resources elsewhere in the subscription.
resource "azurerm_role_assignment" "github_actions" {
  scope                = azurerm_resource_group.demo.id
  role_definition_name = "Contributor"
  principal_id         = azuread_service_principal.github_actions.object_id
  principal_type       = "ServicePrincipal"
}
