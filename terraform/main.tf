terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ─── Providers ────────────────────────────────────────────────
# Lightsail control plane always uses us-east-1
provider "aws" {
  alias  = "lightsail"
  region = "us-east-1"
}

# Everything else (Amplify, Cognito) in us-west-1
provider "aws" {
  alias  = "main"
  region = "us-west-1"
}

# ─────────────────────────────────────────────────────────────
#  LIGHTSAIL
# ─────────────────────────────────────────────────────────────

resource "aws_lightsail_instance" "backend" {
  provider          = aws.lightsail
  name              = var.instance_name
  availability_zone = "us-east-1a"
  blueprint_id      = "ubuntu_22_04"
  bundle_id         = var.instance_bundle

  # Bootstrap script — installs Docker, Nginx, clones repo, starts containers
  user_data = templatefile("${path.module}/userdata.sh.tpl", {
    github_repo      = var.github_repo
    db_password      = var.db_password
    ses_smtp_user    = var.ses_smtp_user
    ses_smtp_pass    = var.ses_smtp_password
    ses_from_email   = var.ses_from_email
    cognito_pool_id  = var.cognito_user_pool_id
    cognito_client   = var.cognito_client_id
    frontend_url     = "https://${var.app_subdomain}.${var.domain_name}"
  })

  tags = {
    Project     = var.project_name
    Environment = "production"
  }
}

resource "aws_lightsail_static_ip" "backend" {
  provider = aws.lightsail
  name     = "${var.instance_name}-ip"
}

resource "aws_lightsail_static_ip_attachment" "backend" {
  provider       = aws.lightsail
  static_ip_name = aws_lightsail_static_ip.backend.name
  instance_name  = aws_lightsail_instance.backend.name
}

# Firewall ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)
resource "aws_lightsail_instance_public_ports" "backend" {
  provider      = aws.lightsail
  instance_name = aws_lightsail_instance.backend.name

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
  }

  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
  }

  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
  }
}

# ─────────────────────────────────────────────────────────────
#  AMPLIFY — Frontend
# ─────────────────────────────────────────────────────────────

resource "aws_amplify_app" "frontend" {
  provider    = aws.main
  name        = "${var.project_name}-frontend"
  description = "${var.project_name} React frontend"

  # SPA redirect rule — required for React Router
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }

  environment_variables = {
    VITE_API_URL               = "https://${var.api_subdomain}.${var.domain_name}"
    VITE_COGNITO_USER_POOL_ID  = var.cognito_user_pool_id
    VITE_COGNITO_CLIENT_ID     = var.cognito_client_id
  }
}

resource "aws_amplify_branch" "main" {
  provider    = aws.main
  app_id      = aws_amplify_app.frontend.id
  branch_name = "main"
  stage       = "PRODUCTION"
}

resource "aws_amplify_domain_association" "frontend" {
  provider    = aws.main
  app_id      = aws_amplify_app.frontend.id
  domain_name = var.domain_name

  sub_domain {
    prefix      = var.app_subdomain
    branch_name = aws_amplify_branch.main.branch_name
  }
}
