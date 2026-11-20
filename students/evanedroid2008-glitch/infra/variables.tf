variable "aws_region" {
  description = "Регіон AWS, у якому створюються ресурси"
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Префікс для назв усіх ресурсів"
  type        = string
  default     = "weather-station"
}

variable "instance_type" {
  description = "Тип EC2-інстансу"
  type        = string
  default     = "t3.micro"
}

variable "disk_size_gb" {
  description = "Розмір кореневого диска, ГБ"
  type        = number
  default     = 8
}

variable "app_port" {
  description = "Порт, на якому працює контейнер"
  type        = number
  default     = 3000
}

variable "ssh_allowed_cidr" {
  description = "Діапазон IP, яким дозволений SSH. Для навчального проєкту 0.0.0.0/0, для реального - адреси GitHub Actions"
  type        = string
  default     = "0.0.0.0/0"
}
