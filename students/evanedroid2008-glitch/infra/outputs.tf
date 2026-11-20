output "instance_public_ip" {
  description = "Публічна IP-адреса сервера: сюди деплоїть пайплайн"
  value       = aws_instance.app.public_ip
}

output "app_url" {
  description = "Адреса застосунку після першого деплою"
  value       = "http://${aws_instance.app.public_ip}:${var.app_port}"
}

output "ssh_private_key_path" {
  description = "Файл із приватним ключем для підключення по SSH (не комітиться)"
  value       = local_sensitive_file.private_key.filename
}

output "ec2_instance_id" {
  description = "Ідентифікатор інстансу для перевірки або видалення"
  value       = aws_instance.app.id
}
