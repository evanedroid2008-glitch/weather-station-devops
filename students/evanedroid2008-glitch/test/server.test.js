'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { server, addMeasurement, validate, measurements, LIMITS } = require('../src/server');

let baseUrl;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test.beforeEach(() => {
  measurements.length = 0;
});

test('GET /health повертає статус ok', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptime, 'number');
});

test('GET / віддає HTML-дашборд', async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(html, /Метеостанція/);
});

test('GET /style.css віддає стилі', async () => {
  const response = await fetch(`${baseUrl}/style.css`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/css/);
});

test('POST /api/measurements зберігає вимірювання', async () => {
  const response = await fetch(`${baseUrl}/api/measurements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ temperature: 21.5, humidity: 48, pressure: 1013, station: 'lab-1' }),
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.temperature, 21.5);
  assert.equal(body.station, 'lab-1');
  assert.ok(body.id > 0);
  assert.ok(Date.parse(body.recordedAt));
});

test('POST без обов\'язкового поля повертає 400', async () => {
  const response = await fetch(`${baseUrl}/api/measurements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ temperature: 20, humidity: 40 }),
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.ok(body.errors.some((message) => message.includes('pressure')));
});

test('POST зі значенням поза межами повертає 400', async () => {
  const response = await fetch(`${baseUrl}/api/measurements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ temperature: 200, humidity: 40, pressure: 1000 }),
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.ok(body.errors.some((message) => message.includes('temperature')));
});

test('POST з некоректним JSON повертає 400', async () => {
  const response = await fetch(`${baseUrl}/api/measurements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ не json',
  });
  assert.equal(response.status, 400);
});

test('GET /api/measurements повертає середні значення', async () => {
  addMeasurement({ temperature: 10, humidity: 40, pressure: 1000 });
  addMeasurement({ temperature: 20, humidity: 60, pressure: 1002 });
  const response = await fetch(`${baseUrl}/api/measurements`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.stats.count, 2);
  assert.equal(body.stats.temperature, 15);
  assert.equal(body.stats.humidity, 50);
  assert.equal(body.stats.pressure, 1001);
});

test('DELETE /api/measurements очищає історію', async () => {
  addMeasurement({ temperature: 10, humidity: 40, pressure: 1000 });
  const response = await fetch(`${baseUrl}/api/measurements`, { method: 'DELETE' });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.stats.count, 0);
});

test('невідомий маршрут повертає 404', async () => {
  const response = await fetch(`${baseUrl}/api/unknown`);
  assert.equal(response.status, 404);
});

test('validate приймає коректні межі', () => {
  assert.deepEqual(validate({ temperature: -60, humidity: 0, pressure: 800 }), []);
  assert.deepEqual(validate({ temperature: 60, humidity: 100, pressure: 1100 }), []);
});

test('validate відхиляє не-об\'єкт', () => {
  assert.equal(validate(null).length, 1);
  assert.equal(validate([1, 2]).length, 1);
});

test('validate відхиляє рядкові числа', () => {
  const errors = validate({ temperature: '20', humidity: 40, pressure: 1000 });
  assert.ok(errors.some((message) => message.includes('числом')));
});

test('межі полів оголошені', () => {
  assert.deepEqual(Object.keys(LIMITS).sort(), ['humidity', 'pressure', 'temperature']);
});
