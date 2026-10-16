output "resource_group_name" {
  description = "Set this as the AZURE_RESOURCE_GROUP GitHub repository variable."
  value       = azurerm_resource_group.demo.name
}

output "container_app_name" {
  description = "Set this as the AZURE_CONTAINER_APP_NAME GitHub repository variable."
  value       = azurerm_container_app.demo.name
}

output "container_app_url" {
  description = "Public URL for the demo app."
  value       = "https://${azurerm_container_app.demo.latest_revision_fqdn}"
}

output "github_actions_client_id" {
  description = "Set this as the AZURE_CLIENT_ID GitHub repository variable."
  value       = azuread_application.github_actions.client_id
}

output "azure_tenant_id" {
  description = "Set this as the AZURE_TENANT_ID GitHub repository variable."
  value       = data.azurerm_client_config.current.tenant_id
}

output "azure_subscription_id" {
  description = "Set this as the AZURE_SUBSCRIPTION_ID GitHub repository variable."
  value       = data.azurerm_client_config.current.subscription_id
}
