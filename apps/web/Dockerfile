FROM oven/bun:1.3.9 AS build
WORKDIR /app
ARG ORBIT_VERSION=unknown
ARG ORBIT_COMMIT=unknown

COPY package.json bun.lock .
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/upload/package.json apps/upload/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN bun install --verbose

COPY . .
RUN printf '{"version":"%s","commitHash":"%s"}\n' "$ORBIT_VERSION" "$ORBIT_COMMIT" > /app/build-info.json

WORKDIR /app/apps/web
ENV NITRO_PRESET=bun
RUN bun run build

FROM oven/bun:1.3.9 AS runtime
WORKDIR /app/apps/web
COPY --from=build /app/apps/web/.output ./.output
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/build-info.json /app/build-info.json
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]
