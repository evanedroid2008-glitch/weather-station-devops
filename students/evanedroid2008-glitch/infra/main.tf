terraform {
  required_version = ">= 1.10.0"

  # Стан зберігається у S3, а не на раннері GitHub: інакше кожен запуск
  # починається з порожнього стану і Terraform створює дублікати ресурсів.
  # Ім'я бакета передається під час init: -backend-config="bucket=..."
  backend "s3" {
    key          = "weather-station/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
    }
  }
}

# ---------------------------------------------------------------- мережа ---
data "aws_vpc" "default" {
  default = true
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ------------------------------------------------------------- ssh-ключі ---
resource "tls_private_key" "deploy" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "deploy" {
  key_name   = "${var.project_name}-deploy"
  public_key = tls_private_key.deploy.public_key_openssh
}

# Приватний ключ не пишеться у файл ресурсом Terraform: на чистому раннері
# такого файлу немає, а стан його вже містить. Замість цього ключ віддається
# через output (sensitive) і записується у кроці деплою.

# --------------------------------------------------------- security group ---
resource "aws_security_group" "app" {
  name        = "${var.project_name}-sg"
  description = "HTTP for the weather station and SSH for deployment"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Application HTTP port"
    from_port   = var.app_port
    to_port     = var.app_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH for GitHub Actions deployment"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  egress {
    description = "Outgoing traffic for image pulls and updates"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-sg" }
}

# -------------------------------------------------------------- інстанс ---
resource "aws_instance" "app" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  key_name                    = aws_key_pair.deploy.key_name
  vpc_security_group_ids      = [aws_security_group.app.id]
  associate_public_ip_address = true

  # Docker ставиться під час першого запуску, щоб пайплайну було куди деплоїти.
  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail
    apt-get update -y
    apt-get install -y ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io
    systemctl enable --now docker
    usermod -aG docker ubuntu
    echo "Deployment target is ready"
  EOF

  root_block_device {
    volume_size = var.disk_size_gb
    volume_type = "gp3"
  }

  tags = { Name = "${var.project_name}-app" }
}
