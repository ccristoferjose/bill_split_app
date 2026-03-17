variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "billsplit"
}

# ── Lightsail ──────────────────────────────────────────────────
variable "instance_name" {
  description = "Lightsail instance name"
  type        = string
  default     = "billsplit-prod"
}

variable "instance_bundle" {
  description = "Lightsail plan: small_3_0=$12/mo, micro_3_0=$7/mo, nano_3_0=$5/mo"
  type        = string
  default     = "small_3_0"
}

variable "github_repo" {
  description = "GitHub repository URL to clone on the instance"
  type        = string
  default     = "https://github.com/ccristoferjose/bill_split_app.git"
}

# ── Domain ────────────────────────────────────────────────────
variable "domain_name" {
  description = "Root domain managed in Squarespace"
  type        = string
  default     = "spend-sync.com"
}

variable "api_subdomain" {
  description = "Subdomain for the backend API"
  type        = string
  default     = "api"
}

variable "app_subdomain" {
  description = "Subdomain for the frontend app"
  type        = string
  default     = "app"
}

# ── Cognito ───────────────────────────────────────────────────
variable "cognito_user_pool_id" {
  description = "Existing Cognito User Pool ID (do NOT recreate)"
  type        = string
  default     = "us-west-1_a48MtZvaJ"
}

variable "cognito_client_id" {
  description = "Existing Cognito App Client ID"
  type        = string
  default     = "3a7rsjmnhbq48h95663q4vu4bq"
}

# ── Secrets (set in terraform.tfvars — never commit) ──────────
variable "db_password" {
  description = "MySQL root password"
  type        = string
  sensitive   = true
}

variable "ses_smtp_user" {
  description = "AWS SES SMTP username"
  type        = string
  sensitive   = true
}

variable "ses_smtp_password" {
  description = "AWS SES SMTP password"
  type        = string
  sensitive   = true
}

variable "ses_from_email" {
  description = "Verified SES sender email"
  type        = string
  default     = "mail@spend-sync.com"
}
