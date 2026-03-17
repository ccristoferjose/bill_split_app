output "instance_ip" {
  description = "Lightsail static IP — add as A record in Squarespace: api → this IP"
  value       = aws_lightsail_static_ip.backend.ip_address
}

output "amplify_default_url" {
  description = "Amplify default URL (works immediately, no DNS needed)"
  value       = "https://main.${aws_amplify_app.frontend.id}.amplifyapp.com"
}

output "amplify_app_id" {
  description = "Amplify app ID (needed to re-deploy frontend zip)"
  value       = aws_amplify_app.frontend.id
}

output "frontend_url" {
  description = "Custom frontend URL (after DNS + Amplify domain verified)"
  value       = "https://${var.app_subdomain}.${var.domain_name}"
}

output "api_url" {
  description = "Backend API URL (after DNS + SSL via Certbot)"
  value       = "https://${var.api_subdomain}.${var.domain_name}"
}

output "dns_records_to_add" {
  description = "DNS records to configure in Squarespace"
  value = {
    api_A_record  = "${var.api_subdomain} → A → ${aws_lightsail_static_ip.backend.ip_address}"
    app_CNAME     = "${var.app_subdomain} → CNAME → main.${aws_amplify_app.frontend.id}.amplifyapp.com"
  }
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i LightsailKey.pem ubuntu@${aws_lightsail_static_ip.backend.ip_address}"
}

output "ssl_command" {
  description = "Run this after DNS propagates to install SSL"
  value       = "sudo certbot --nginx -d ${var.api_subdomain}.${var.domain_name} --non-interactive --agree-tos -m admin@${var.domain_name}"
}
