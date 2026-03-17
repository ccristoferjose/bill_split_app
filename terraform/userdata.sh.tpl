#!/bin/bash
set -e
exec > /var/log/bootstrap.log 2>&1

export DEBIAN_FRONTEND=noninteractive

echo "[1/7] Updating system..."
apt-get update -y && apt-get upgrade -y

echo "[2/7] Installing Docker..."
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu
systemctl enable docker

echo "[3/7] Installing Nginx + Certbot + Git..."
apt-get install -y nginx certbot python3-certbot-nginx git
systemctl enable nginx

echo "[4/7] Cloning repository..."
cd /opt
git clone ${github_repo} bill_split_app
chown -R ubuntu:ubuntu /opt/bill_split_app

echo "[5/7] Creating .env..."
cat > /opt/bill_split_app/.env << 'ENV'
PORT=5001
NODE_ENV=production
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=${db_password}
DB_NAME=work_db
COGNITO_USER_POOL_ID=${cognito_pool_id}
COGNITO_CLIENT_ID=${cognito_client}
COGNITO_REGION=us-west-1
SES_SMTP_HOST=email-smtp.us-west-1.amazonaws.com
SES_SMTP_PORT=587
SES_SMTP_USER=${ses_smtp_user}
SES_SMTP_PASSWORD=${ses_smtp_pass}
SES_FROM_EMAIL=${ses_from_email}
SES_FROM_NAME=BillSplit App
FRONTEND_URL=${frontend_url},http://localhost:5173
APP_NAME=BillSplit
ENV
chmod 600 /opt/bill_split_app/.env

echo "[6/7] Starting containers..."
cd /opt/bill_split_app
docker compose up -d --build

echo "[7/7] Configuring Nginx..."
cat > /etc/nginx/sites-available/api.conf << 'NGINX'
upstream billsplit_backend {
    server 127.0.0.1:5001;
    keepalive 64;
}
server {
    listen 80;
    listen [::]:80;
    server_name api.${domain_name};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location /socket.io/ {
        proxy_pass http://billsplit_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }
    location / {
        proxy_pass http://billsplit_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10m;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/api.conf /etc/nginx/sites-enabled/api.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo "Bootstrap complete!"
