output "instance_public_ip" {
  description = "Публічна IP-адреса сервера: сюди деплоїть пайплайн"
  value       = aws_instance.app.public_ip
}

output "app_url" {
  description = "Адреса застосунку після першого деплою"
  value       = "http://${aws_instance.app.public_ip}:${var.app_port}"
}

output "ssh_private_key_pem" {
  description = "Приватний ключ для SSH. Читається через terraform output -raw ssh_private_key_pem"
  value       = tls_private_key.deploy.private_key_pem
  sensitive   = true
}

output "ec2_instance_id" {
  description = "Ідентифікатор інстансу для перевірки або видалення"
  value       = aws_instance.app.id
}
