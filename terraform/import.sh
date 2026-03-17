#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  Import existing AWS resources into Terraform state
#  Run this ONCE to bring current infra under Terraform control
#  Usage: bash import.sh
# ─────────────────────────────────────────────────────────────

set -e

echo "Initializing Terraform..."
terraform init

echo ""
echo "Importing Lightsail instance..."
terraform import aws_lightsail_instance.backend billsplit-prod

echo ""
echo "Importing Lightsail static IP..."
terraform import aws_lightsail_static_ip.backend billsplit-prod-ip

echo ""
echo "Importing static IP attachment..."
terraform import aws_lightsail_static_ip_attachment.backend billsplit-prod-ip

echo ""
echo "Importing Lightsail firewall ports..."
terraform import aws_lightsail_instance_public_ports.backend billsplit-prod

echo ""
echo "Importing Amplify app..."
terraform import aws_amplify_app.frontend dmjz21vvfgf08

echo ""
echo "Importing Amplify branch..."
terraform import aws_amplify_branch.main dmjz21vvfgf08/main

echo ""
echo "Importing Amplify domain association..."
terraform import aws_amplify_domain_association.frontend dmjz21vvfgf08/spend-sync.com

echo ""
echo "Done! Run 'terraform plan' to verify state matches reality."
