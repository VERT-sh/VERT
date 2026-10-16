variable "subscription_id" {
  description = "Azure subscription where the demo environment will be created."
  type        = string
}

variable "location" {
  description = "Azure region for the demo resources."
  type        = string
  default     = "polandcentral"
}

variable "name_prefix" {
  description = "Short prefix used for Azure resource names."
  type        = string
  default     = "vert-demo"
}

variable "github_repository" {
  description = "GitHub owner and repository, used to scope the OIDC trust."
  type        = string
  default     = "JakubMadro/VERT"
}

variable "github_branch" {
  description = "Branch allowed to authenticate to Azure using GitHub OIDC."
  type        = string
  default     = "main"
}

variable "initial_image" {
  description = "Public placeholder image used until the first GitHub Actions deployment."
  type        = string
  default     = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
}

variable "tags" {
  description = "Tags applied to Azure resources."
  type        = map(string)
  default = {
    project     = "vert"
    environment = "demo"
    managed-by  = "terraform"
  }
}
