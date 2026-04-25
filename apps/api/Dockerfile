FROM oven/bun:1.3.9 AS base
WORKDIR /app
COPY package.json bun.lock .
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN bun install --frozen-lockfile
COPY . .
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["bun", "run", "start"]
