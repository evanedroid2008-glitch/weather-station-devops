# ---------- Етап 1. Залежності ----------
# Застосунок не має сторонніх бібліотек, тому цей етап лише готує робочу копію
# та перевіряє, що package.json валідний. Він відокремлений, щоб кеш не ламався
# при зміні коду в src/.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"

# ---------- Етап 2. Тести ----------
# Тести виконуються під час збірки: якщо вони падають, образ не збирається.
FROM deps AS test
COPY src ./src
COPY pages ./pages
COPY test ./test
RUN node --test test/server.test.js

# ---------- Етап 3. Фінальний образ ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Лише те, що потрібно для запуску: без тестів, без dev-залежностей.
COPY --from=test /app/package.json ./package.json
COPY --from=test /app/src ./src
COPY --from=test /app/pages ./pages

# Процес не працює від root.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
