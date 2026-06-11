FROM oven/bun:1.3.9 AS base
WORKDIR /app
ARG ORBIT_VERSION=unknown
ARG ORBIT_COMMIT=unknown
COPY package.json bun.lock .
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN echo "==> bun install for api image (first build can take a few minutes)" \
 && bun install --verbose
COPY . .
RUN printf '{"version":"%s","commitHash":"%s"}\n' "$ORBIT_VERSION" "$ORBIT_COMMIT" > /app/build-info.json
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["bun", "run", "start"]
