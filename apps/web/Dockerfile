FROM oven/bun:1.3.9 AS build
WORKDIR /app
COPY package.json bun.lock .
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN bun install --frozen-lockfile
COPY . .
WORKDIR /app/apps/web
RUN bun run build

FROM oven/bun:1.3.9 AS runtime
WORKDIR /app/apps/web
COPY --from=build /app/apps/web/.output ./.output
COPY --from=build /app/node_modules /app/node_modules
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
