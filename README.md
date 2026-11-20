# DevOps: індивідуальний проєкт

Репозиторій створено з шаблону [Max-K44/devops-template](https://github.com/Max-K44/devops-template).
Уся робота лежить у папці [`students/evanedroid2008-glitch`](students/evanedroid2008-glitch).

## Що це

**Weather Station** - застосунок метеостанції: приймає температуру, вологість і тиск,
показує вебдашборд, віддає JSON API і має `/health` для перевірки стану.

Навколо застосунку зібрано повний цикл постачання:

- контейнеризація (Docker, три стадії, non-root, healthcheck);
- інфраструктура як код (Terraform: EC2, Security Group, SSH-ключ, user_data з Docker);
- CI/CD (GitHub Actions: тести, збірка й пуш образу в Docker Hub, деплой на EC2).

## Структура

```
.github/workflows/ci-cd.yml     пайплайн (GitHub читає лише цей шлях)
students/evanedroid2008-glitch/ код застосунку, Dockerfile, Terraform, документація
.gitignore                      що не потрапляє в репозиторій
README.md                       цей файл
```

## Документація

Призначення застосунку, локальний запуск, змінні середовища, таблиця секретів,
схема пайплайна та опис інфраструктури: [students/evanedroid2008-glitch/README.md](students/evanedroid2008-glitch/README.md).

## Швидкий старт

```bash
cd students/evanedroid2008-glitch
npm ci
npm test
docker build -t weather-station:local .
docker run --rm -p 3000:3000 weather-station:local
```

Інфраструктура:

```bash
cd students/evanedroid2008-glitch/infra
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform validate
terraform plan
terraform apply
terraform destroy   # після завершення роботи
```
