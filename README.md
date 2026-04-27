# Orbit

Self-hostable FiveM admin panel.

## Quick Start

The recommended setup is Docker Compose with the published images.

1. Copy the self-host env file:

```bash
cp .env.selfhost.example .env.selfhost
```

2. Edit `.env.selfhost` and set:

- `POSTGRES_PASSWORD`
- `ORBIT_PUBLIC_WEB_URL`
- `ORBIT_PUBLIC_API_URL`
- `ORBIT_COOKIE_DOMAIN` if you use subdomains like `app.example.com` and `api.example.com`

3. Start Orbit:

```bash
docker compose -f docker-compose.selfhost.yml --env-file .env.selfhost up -d
```

4. Open `ORBIT_PUBLIC_WEB_URL`.

5. Click `Login / setup`, choose the master admin password, and let Orbit finish setup.

On a fresh install Orbit now:

- checks the database connection
- runs auth migrations automatically
- creates the built-in recovery admin
- signs you in

You do not need to `docker compose exec` into the container to run migrations.

## First Login

The first-run flow creates a fixed local recovery account named `admin`.

Use it as the break-glass account for the instance. After setup, you can add your normal admin account through OAuth or other auth flows and keep `admin` for recovery only.

## Required Environment

Start from [.env.selfhost.example](./.env.selfhost.example).

Required:

- `POSTGRES_PASSWORD`
- `ORBIT_PUBLIC_WEB_URL`
- `ORBIT_PUBLIC_API_URL`

Usually needed:

- `ORBIT_COOKIE_DOMAIN=.example.com` when web and api are on sibling subdomains

Optional:

- `ORBIT_API_IMAGE`
- `ORBIT_WEB_IMAGE`
- OAuth provider credentials

`ORBIT_INTERNAL_JWT_SECRET` and `BETTER_AUTH_SECRET` do not need to be set for the Docker setup. Orbit generates them automatically and persists them in the shared runtime volume.

## Compose Files

- `docker-compose.selfhost.yml`: recommended self-host setup with published images
- `docker-compose.yml`: local image build workflow
- `docker-compose.images.yml`: image-only compose for testing alternate image tags

## OAuth

Google, GitHub, Discord, and Cfx.re are optional. Leave those variables empty if you only want the local recovery admin during initial setup.

## Local Development

1. Install dependencies:

```bash
bun install
```

2. Create app env files from the examples:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

3. Start Postgres and the apps:

```bash
docker compose up -d db
bun run dev
```

The web app runs on `http://localhost:3000` and the API runs on `http://localhost:3001`.

## Monorepo Layout

- `apps/web` — frontend and same-origin proxy routes
- `apps/api` — auth, database, config, and admin APIs
- `packages/shared` — shared schemas and auth helpers
- `packages/config` — shared config resolution

## License

[GPL-3.0](./LICENSE)
