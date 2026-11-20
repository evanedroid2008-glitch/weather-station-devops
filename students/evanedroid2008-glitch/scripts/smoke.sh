#!/usr/bin/env bash
# Локальна перевірка запущеного застосунку.
# Використання: ./scripts/smoke.sh [базовий URL]
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:3000}"

echo "1. Перевірка /health"
curl -fsS "${BASE_URL}/health"
echo

echo "2. Додавання вимірювання"
curl -fsS -X POST "${BASE_URL}/api/measurements" \
  -H "Content-Type: application/json" \
  -d '{"temperature":21.5,"humidity":48,"pressure":1013,"station":"smoke"}'
echo

echo "3. Читання статистики"
curl -fsS "${BASE_URL}/api/measurements"
echo

echo "4. Перевірка дашборда"
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" "${BASE_URL}/"

echo "Перевірка завершена"
