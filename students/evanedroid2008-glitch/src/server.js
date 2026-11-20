'use strict';

/**
 * Weather Station API.
 *
 * Застосунок для індивідуального проєкту: зберігає показники метеостанції
 * (температура, вологість, тиск) і віддає їх як HTML-дашборд та JSON API.
 *
 * Залежностей немає: лише стандартна бібліотека Node.js, тому образ
 * збирається швидко і не тягне node_modules у контейнер.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const APP_VERSION = process.env.APP_VERSION || 'dev';

// Стан у пам'яті: для проєкту достатньо, щоб показати роботу пайплайна.
const measurements = [];
let nextId = 1;

const LIMITS = {
  temperature: { min: -60, max: 60 },
  humidity: { min: 0, max: 100 },
  pressure: { min: 800, max: 1100 },
};

function addMeasurement({ temperature, humidity, pressure, station }) {
  const record = {
    id: nextId++,
    temperature,
    humidity,
    pressure,
    station: station || 'default',
    recordedAt: new Date().toISOString(),
  };
  measurements.push(record);
  // Тримаємо останні 200 записів, щоб пам'ять не росла безмежно.
  if (measurements.length > 200) measurements.shift();
  return record;
}

function validate(payload) {
  const errors = [];
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['Тіло запиту має бути JSON-об\'єктом'];
  }

  for (const field of Object.keys(LIMITS)) {
    const value = payload[field];
    if (value === undefined) {
      errors.push(`Поле "${field}" обов'язкове`);
      continue;
    }
    if (typeof value !== 'number' || Number.isNaN(value)) {
      errors.push(`Поле "${field}" має бути числом`);
      continue;
    }
    const { min, max } = LIMITS[field];
    if (value < min || value > max) {
      errors.push(`Поле "${field}" має бути в межах ${min}..${max}`);
    }
  }

  if (payload.station !== undefined && typeof payload.station !== 'string') {
    errors.push('Поле "station" має бути рядком');
  }

  return errors;
}

function stats() {
  if (measurements.length === 0) {
    return { count: 0, temperature: null, humidity: null, pressure: null };
  }
  const avg = (key) =>
    Number(
      (
        measurements.reduce((sum, item) => sum + item[key], 0) /
        measurements.length
      ).toFixed(2)
    );
  return {
    count: measurements.length,
    temperature: avg('temperature'),
    humidity: avg('humidity'),
    pressure: avg('pressure'),
  };
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendFile(res, fileName, contentType) {
  const filePath = path.join(__dirname, '..', 'pages', fileName);
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Не вдалося прочитати сторінку');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length,
    });
    res.end(data);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      // Захист від надто великих тіл: 32 КБ більш ніж достатньо.
      if (raw.length > 32 * 1024) {
        reject(new Error('Тіло запиту завелике'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (raw.trim() === '') {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Некоректний JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = `${req.method} ${url.pathname}`;

  try {
    if (route === 'GET /health') {
      json(res, 200, { status: 'ok', version: APP_VERSION, uptime: process.uptime() });
      return;
    }

    if (route === 'GET /api/measurements') {
      json(res, 200, { items: measurements, stats: stats() });
      return;
    }

    if (route === 'POST /api/measurements') {
      const payload = await readJson(req);
      const errors = validate(payload);
      if (errors.length > 0) {
        json(res, 400, { errors });
        return;
      }
      const record = addMeasurement(payload);
      json(res, 201, record);
      return;
    }

    if (route === 'DELETE /api/measurements') {
      measurements.length = 0;
      nextId = 1;
      json(res, 200, { status: 'cleared', stats: stats() });
      return;
    }

    if (route === 'GET /') {
      sendFile(res, 'index.html', 'text/html; charset=utf-8');
      return;
    }

    if (route === 'GET /style.css') {
      sendFile(res, 'style.css', 'text/css; charset=utf-8');
      return;
    }

    json(res, 404, { error: 'Маршрут не знайдено' });
  } catch (error) {
    json(res, 400, { error: error.message });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Weather Station API v${APP_VERSION} listening on http://${HOST}:${PORT}`);
  });
}

module.exports = { server, addMeasurement, validate, stats, measurements, LIMITS };
