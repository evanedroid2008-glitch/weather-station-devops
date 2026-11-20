# Weather Station: індивідуальний проєкт DevOps

Застосунок для індивідуального проєкту курсу «Системне адміністрування та технології DevOps».

## Призначення

**Weather Station** приймає показники метеостанції (температура, вологість, тиск)
і показує їх на вебдашборді. Це не приклад із лекцій, а власний застосунок:
окремі маршрути, валідація діапазонів, статистика середніх значень, health-check.

| Маршрут | Метод | Що робить |
| --- | --- | --- |
| `/` | GET | HTML-дашборд зі статистикою та таблицею вимірювань |
| `/style.css` | GET | Стилі дашборда |
| `/health` | GET | Стан застосунку: статус, версія, uptime |
| `/api/measurements` | GET | Список вимірювань і середні значення |
| `/api/measurements` | POST | Додати вимірювання |
| `/api/measurements` | DELETE | Очистити історію |

Стек: Node.js 20, стандартна бібліотека (`node:http`, `node:test`). Сторонніх
залежностей немає, тому образ маленький і збирається швидко.

## Структура

```
students/evanedroid2008-glitch/
├── src/server.js               код застосунку (роутинг, валідація, статистика)
├── pages/index.html            дашборд
├── pages/style.css             стилі
├── test/server.test.js         14 тестів на node:test
├── scripts/smoke.sh            локальна перевірка запущеного застосунку
├── infra/                      Terraform: EC2, Security Group, SSH-ключ
├── .github/workflows/ci-cd.yml пайплайн GitHub Actions
├── Dockerfile                  три стадії: deps -> test -> runtime
├── .dockerignore
├── .gitignore
├── .env.example
├── package.json
└── README.md
```

## Локальний запуск

### Без Docker

```bash
cd students/evanedroid2008-glitch
npm ci
npm test          # 14 тестів
npm start         # http://127.0.0.1:3000
```

### У Docker (як вимагає ТЗ: спершу локально, потім деплой)

```bash
cd students/evanedroid2008-glitch

docker build -t weather-station:local .
docker run --rm -p 3000:3000 -e APP_VERSION=local weather-station:local

curl http://127.0.0.1:3000/health
curl -X POST http://127.0.0.1:3000/api/measurements \
     -H "Content-Type: application/json" \
     -d '{"temperature":21.5,"humidity":48,"pressure":1013,"station":"lab-1"}'
```

Швидка перевірка запущеного сервера:

```bash
./scripts/smoke.sh http://127.0.0.1:3000
```

Перевірка через Docker:

```bash
docker ps                                   # контейнер запущений
docker logs weather-station                 # лог старту
docker inspect --format '{{.State.Health.Status}}' weather-station
```

## Змінні середовища

| Змінна | За замовчуванням | Призначення |
| --- | --- | --- |
| `PORT` | `3000` | Порт, який слухає застосунок |
| `HOST` | `0.0.0.0` | Адреса прив'язки (у контейнері обов'язково `0.0.0.0`) |
| `APP_VERSION` | `dev` | Версія, яку показує `/health` (у пайплайні - короткий SHA коміту) |

Приклад лежить у `.env.example`. Справжній `.env` у репозиторій не потрапляє.

## GitHub Secrets

Налаштовуються в `Settings -> Secrets and variables -> Actions`.

| Секрет | Для чого |
| --- | --- |
| `DOCKER_USERNAME` | Логін Docker Hub |
| `DOCKER_TOKEN` | Access token Docker Hub (не пароль) |
| `AWS_ACCESS_KEY_ID` | Ключ AWS для Terraform |
| `AWS_SECRET_ACCESS_KEY` | Секретний ключ AWS |
| `EC2_SSH_KEY_B64` | Приватний SSH-ключ у Base64, якщо ключ створений заздалегідь |

У цьому проєкті `EC2_SSH_KEY_B64` не обов'язковий: Terraform сам генерує пару
ключів (`tls_private_key`), кладе публічну частину в `aws_key_pair`, а приватну
зберігає у `infra/deploy_key.pem` (файл у `.gitignore`) і передає далі в кроці
деплою через `terraform output`. Якщо викладач вимагає саме секрет
`EC2_SSH_KEY_B64`, його можна додати й переписати крок `Prepare SSH key` на
`echo "$EC2_SSH_KEY_B64" | base64 -d > ~/.ssh/deploy_key`.

## Пайплайн CI/CD

Файл: `.github/workflows/ci-cd.yml`. Тригер: push у `main` (лише зміни в папці
студента) і pull request.

```
push в main
   │
   ├─ job test              npm ci + npm test (14 тестів)
   │
   ├─ job build-and-push    docker build (3 стадії, тести всередині образу)
   │                        docker push  <DOCKER_USERNAME>/weather-station:latest
   │                                     <DOCKER_USERNAME>/weather-station:<sha7>
   │
   └─ job deploy            terraform init / fmt -check / validate / plan / apply
                            terraform output -> IP інстансу
                            ssh: docker login, pull, rm -f, run, prune
                            smoke test: curl http://<ip>:3000/health
```

Кожен наступний job залежить від попереднього (`needs`). Якщо тести впали,
образ не збирається; якщо образ не запушений, деплой не починається.

Крок `Terraform apply` ідемпотентний: при повторному пуші інфраструктура вже
існує, і Terraform не створює дублікатів.

## Інфраструктура (Terraform)

`infra/main.tf` створює:

- **EC2** `t3.micro` з Ubuntu 22.04 (AMI Canonical шукається через `data.aws_ami`);
- **Security Group**: вхідний `3000` для застосунку і `22` для деплою, вихідний трафік відкритий;
- **SSH-ключ** через `tls_private_key` + `aws_key_pair`;
- **user_data**, який ставить Docker під час першого запуску.

```bash
cd students/evanedroid2008-glitch/infra

terraform init
terraform fmt -check -recursive
terraform validate
terraform plan
terraform apply          # створить інстанс

terraform output app_url # адреса застосунку
terraform destroy        # ПРИБРАТИ РЕСУРСИ ПІСЛЯ ЗДАЧІ
```

`terraform.tfvars` треба створити з прикладу:

```bash
cp infra/terraform.tfvars.example terraform.tfvars
```

Файл `infra/terraform.tfvars` у `.gitignore`, тому власні значення (регіон,
діапазон SSH) залишаються локальними.

Стан Terraform (`terraform.tfstate`) та папка `.terraform/` у репозиторій не
комітяться: вони містять дані про ресурси й можуть містити чутливі значення.

## .gitignore

Виключає:

- `node_modules/`, логи;
- `.terraform/`, `*.tfstate`, `*.tfstate.*`, `*.tfplan`;
- `*.pem`, `*.key`, `terraform.tfvars` (але `terraform.tfvars.example` комітиться);
- `.env` (але `.env.example` комітиться);
- локальні артефакти й налаштування IDE.

## Перевірка, що пайплайн справді працює

1. Push у `main` -> у вкладці Actions зелений запуск із трьома jobs.
2. Docker Hub: теги `latest` і короткий SHA.
3. `curl http://<instance_public_ip>:3000/health` повертає `{"status":"ok"}`.
4. У браузері відкривається дашборд, форма додає вимірювання.

## Обмеження

Дані зберігаються в пам'яті процесу. Після перезапуску контейнера історія
очищається: для навчального проєкту цього достатньо, а для реального
використання слід додати базу даних (RDS або тому Docker).

Контейнер слухає порт `3000` без проміжного nginx, тому в Security Group
відкритий саме цей порт. Якщо потрібен стандартний `80`, його додають у
`var.app_port` і в `docker run -p 80:3000`.
