# Orbit

Orbit is a self-hostable FiveM admin panel.

This repository is a monorepo with two deployables:

- `apps/web` — frontend and same-origin proxy layer
- `apps/api` — API, auth, config runtime, and database access

## Recommended deployment

The main supported deployment style is:

- **Linux server**
- **Docker Compose**
- **published Docker images**

In production, normal browser traffic goes to the **web** service.
The web service proxies auth, public config, and admin actions to the **api** service.

For the current auth setup, you should still give the API its own public URL, typically `api.example.com`.

---

## Production self-hosting with Docker

### What you need

- a Linux server
- Docker
- Docker Compose
- a domain name recommended for production
- OAuth credentials if you want social sign-in

### Recommended production layout

Recommended domains:

- `app.example.com` → Orbit web
- `api.example.com` → Orbit API

The API should have its own real public URL because auth and callback flows rely on it.

### Recommended production networking

- expose **web** publicly
- expose **api** publicly behind HTTPS
- keep **postgres** private
- terminate TLS with your reverse proxy

---

## Quick start

Once your Docker images are published, the intended self-host flow is:

```bash
docker compose -f docker-compose.images.yml up -d
```

Then run migrations once:

```bash
docker compose -f docker-compose.images.yml exec api bun run migrate
```

Then open Orbit in your browser, create the first account, and finish setup from the admin dashboard.

The **first created user becomes the admin**.

---

## Localhost test compose using published images

If you want to test Orbit locally with the published images and a bundled Postgres database, use a single compose file like this.

> For the current `0.0` images, set the auth secrets explicitly instead of relying on auto-generation.

### Generate secrets first

Generate two secrets on the host:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Use:

- the first value for `ORBIT_INTERNAL_JWT_SECRET`
- the second value for `BETTER_AUTH_SECRET`

### Example compose

```yml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: orbit
      POSTGRES_USER: orbit
      POSTGRES_PASSWORD: orbit
    volumes:
      - orbit_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orbit -d orbit"]
      interval: 10s
      timeout: 5s
      retries: 10

  api:
    image: ghcr.io/projectkura/orbit-api:0.0
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      ORBIT_APP_NAME: Orbit
      ORBIT_DEPLOYMENT_MODE: selfhosted
      ORBIT_CONFIG_MODE: memory
      ORBIT_API_PORT: 3001
      ORBIT_API_URL: http://localhost:3001
      ORBIT_WEB_URL: http://localhost:3000
      ORBIT_COOKIE_DOMAIN: ""
      ORBIT_INTERNAL_JWT_SECRET: REPLACE_WITH_SHARED_INTERNAL_JWT_SECRET
      BETTER_AUTH_SECRET: REPLACE_WITH_BETTER_AUTH_SECRET
      DATABASE_URL: postgresql://orbit:orbit@db:5432/orbit
      DATABASE_SSL: "false"
      GOOGLE_CLIENT_ID: ""
      GOOGLE_CLIENT_SECRET: ""
      GITHUB_CLIENT_ID: ""
      GITHUB_CLIENT_SECRET: ""
      DISCORD_CLIENT_ID: ""
      DISCORD_CLIENT_SECRET: ""
      CFX_CLIENT_ID: ""
      CFX_CLIENT_SECRET: ""
      CFX_DISCOVERY_URL: ""
      CFX_ISSUER: ""
      CFX_AUTHORIZATION_URL: ""
      CFX_TOKEN_URL: ""
      CFX_USERINFO_URL: ""
      CFX_SCOPES: "openid,profile,email"
    ports:
      - "3001:3001"
    volumes:
      - orbit_runtime:/var/lib/orbit

  web:
    image: ghcr.io/projectkura/orbit-web:0.0
    restart: unless-stopped
    depends_on:
      - api
    environment:
      ORBIT_API_URL: http://api:3001
      ORBIT_INTERNAL_JWT_SECRET: REPLACE_WITH_SHARED_INTERNAL_JWT_SECRET
    ports:
      - "3000:3000"
    volumes:
      - orbit_runtime:/var/lib/orbit

volumes:
  orbit_postgres_data:
  orbit_runtime:
```

### Start it

```bash
docker compose up -d
```

Then run migrations once:

```bash
docker compose exec api bun run migrate
```

If you previously started Orbit with mismatched generated secrets, reset the volumes first:

```bash
docker compose down -v
```

### First login

Open:

- `http://localhost:3000/auth`

On a fresh install, Orbit will ask you to create the emergency local `admin` password there.

If you want OAuth, fill in the relevant provider credentials in the `api` service environment.

---

## Production setup step by step

### 1. Prepare a folder on your server

Example:

```bash
mkdir -p /opt/orbit
cd /opt/orbit
```

Copy into that folder:

- `docker-compose.images.yml`
- `apps/web/.env.example`
- `apps/api/.env.example`

Then create:

```bash
mkdir -p apps/web apps/api
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

### 2. Configure the web env

Edit `apps/web/.env`:

```env
ORBIT_API_URL=http://api:3001
# Optional in Docker: Orbit auto-generates and persists this in /var/lib/orbit.
# ORBIT_INTERNAL_JWT_SECRET=
```

#### Notes

- `ORBIT_API_URL` is the internal server-to-server API URL used by the web container.
- In Docker Compose, `http://api:3001` works because the containers share a network.
- `ORBIT_INTERNAL_JWT_SECRET` can be omitted in Docker; Orbit will generate and persist it in the shared `orbit_runtime` volume.
- This value is **runtime config**, not build-time config.

### 3. Configure the api env

Edit `apps/api/.env`:

```env
ORBIT_APP_NAME=Orbit
ORBIT_DEPLOYMENT_MODE=selfhosted
ORBIT_CONFIG_MODE=memory
ORBIT_API_PORT=3001
ORBIT_API_URL=https://api.example.com
ORBIT_WEB_URL=https://app.example.com
ORBIT_COOKIE_DOMAIN=.example.com
# Optional in Docker: Orbit auto-generates and persists this in /var/lib/orbit.
# ORBIT_INTERNAL_JWT_SECRET=
# Optional in Docker: Orbit auto-generates and persists this in /var/lib/orbit.
# BETTER_AUTH_SECRET=
DATABASE_URL=postgresql://postgres:postgres@db:5432/orbit
DATABASE_SSL=false
# Optional: defaults to the hostname from ORBIT_WEB_URL.
# PASSKEY_RP_ID=
# Optional: defaults to ORBIT_APP_NAME.
# PASSKEY_RP_NAME=
# Optional: defaults to ORBIT_WEB_URL.
# PASSKEY_ORIGIN=
```

### 4. Add OAuth credentials if needed

Optional providers:

- Google
- GitHub
- Discord
- Cfx.re

Set the relevant values in `apps/api/.env` if you want those sign-in methods.

### 5. Start the stack

```bash
docker compose -f docker-compose.images.yml up -d
```

### 6. Run database migrations

```bash
docker compose -f docker-compose.images.yml exec api bun run migrate
```

### 7. Finish setup in the browser

- open `https://app.example.com`
- create the first account
- first account becomes admin
- open the admin dashboard
- configure instance settings

---

## What each important env does

### Web env

File: `apps/web/.env`

- `ORBIT_API_URL` — internal API URL used by the web container
- `ORBIT_INTERNAL_JWT_SECRET` — shared secret used to sign internal web → api tokens; optional in Docker because Orbit can generate and persist it

### API env

File: `apps/api/.env`

- `ORBIT_DEPLOYMENT_MODE`
  - `selfhosted` for normal self-hosting
  - `vercel` for the split Vercel-style deployment
- `ORBIT_CONFIG_MODE`
  - `memory` for self-hosting
  - `edge` for Vercel Edge Config mode
- `ORBIT_API_URL` — public API URL
- `ORBIT_WEB_URL` — public web URL
- `ORBIT_COOKIE_DOMAIN` — usually `.example.com` when using subdomains
- `ORBIT_INTERNAL_JWT_SECRET` — optional in Docker; auto-generated and shared with the web container
- `BETTER_AUTH_SECRET` — optional in Docker; auto-generated for Better Auth and persisted
- `DATABASE_URL` — Postgres connection string
- `PASSKEY_RP_ID` — optional; defaults to the hostname from `ORBIT_WEB_URL`
- `PASSKEY_ORIGIN` — optional; defaults to `ORBIT_WEB_URL`

---

## Config runtime modes

The database is always the source of truth.

### `ORBIT_CONFIG_MODE=memory`
Use this for normal self-hosting.

- config is stored in the DB
- runtime reads are cached in memory inside the API process
- best for a single Linux server / simple self-host setup

### `ORBIT_CONFIG_MODE=edge`
Use this for a Vercel-style split deployment.

- config is still stored in the DB
- runtime reads use Vercel Edge Config
- useful for distributed/serverless deployments

For most self-hosters, use:

```env
ORBIT_CONFIG_MODE=memory
```

---

## Why the API secret exists

Sensitive actions are not trusted just because they come from the browser.

The flow is:

- browser → web
- web → api
- api verifies a short-lived signed internal token
- api also verifies the user session and permissions

This helps prevent a random external server from pretending to be your web app and performing privileged actions.

---

## Reverse proxy and TLS

For production, put Orbit behind a reverse proxy.

Examples:

- Caddy
- Nginx
- Traefik
- Cloudflare Tunnel + reverse proxy

### Minimum recommendation

- serve `app.example.com` over HTTPS to the web container
- serve `api.example.com` over HTTPS to the API container
- do **not** expose Postgres publicly

### Cookie / passkey settings

If you use:

- `app.example.com`
- `api.example.com`

then the API env should usually contain:

```env
ORBIT_COOKIE_DOMAIN=.example.com
PASSKEY_RP_ID=example.com
PASSKEY_ORIGIN=https://app.example.com
```

---

## Updating Orbit

After you publish a new image version, update like this:

```bash
docker compose -f docker-compose.images.yml pull
docker compose -f docker-compose.images.yml up -d
```

Then run migrations if needed:

```bash
docker compose -f docker-compose.images.yml exec api bun run migrate
```

---

## Source-based Docker build

If you are developing Orbit itself or want to build from source instead of pulling images, use:

```bash
docker compose up -d --build
```

This uses `docker-compose.yml` and builds locally from the repository.

---

## Local development

### Requirements

- Bun
- Docker
- Docker Compose

### 1. Install dependencies

```bash
bun install
```

### 2. Create env files

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

### 3. Keep the default local web env

`apps/web/.env`

```env
ORBIT_API_URL=http://localhost:3001
# Optional: Orbit can generate this if you omit it, but a fixed value is nicer for local dev.
# ORBIT_INTERNAL_JWT_SECRET=
```

### 4. Set the local api env

`apps/api/.env`

```env
ORBIT_APP_NAME=Orbit
ORBIT_DEPLOYMENT_MODE=selfhosted
ORBIT_CONFIG_MODE=memory
ORBIT_API_PORT=3001
ORBIT_API_URL=http://localhost:3001
ORBIT_WEB_URL=http://localhost:3000
ORBIT_COOKIE_DOMAIN=
# Optional: Orbit can generate this if you omit it.
# ORBIT_INTERNAL_JWT_SECRET=
# Optional: Orbit can generate this if you omit it.
# BETTER_AUTH_SECRET=
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/orbit
DATABASE_SSL=false
# Optional: defaults to the hostname from ORBIT_WEB_URL.
# PASSKEY_RP_ID=
# Optional: defaults to ORBIT_APP_NAME.
# PASSKEY_RP_NAME=
# Optional: defaults to ORBIT_WEB_URL.
# PASSKEY_ORIGIN=
```

### 5. Start Postgres only

```bash
docker compose up -d db
```

### 6. Run migrations

```bash
bun run --cwd apps/api migrate
```

### 7. Start both dev servers

```bash
bun run dev
```

That starts:

- web on `http://localhost:3000`
- api on `http://localhost:3001`

### Alternative: run separately

```bash
bun run dev:web
bun run dev:api
```

---

## Repository layout

```txt
apps/
  web/
  api/
packages/
  shared/
  config/
```

### `apps/web`

- frontend
- same-origin browser entrypoint
- proxy routes for auth/public/admin requests

### `apps/api`

- Better Auth
- config runtime
- instance settings
- database access
- internal service verification

---

## Current Docker files

- `docker-compose.images.yml` — production-style compose using published images
- `docker-compose.yml` — local/source build compose
- `apps/web/Dockerfile`
- `apps/api/Dockerfile`

---

## Current scripts

### Root

```bash
bun run dev
bun run dev:web
bun run dev:api
bun run build:web
bun run typecheck:web
bun run typecheck:api
```

### API

```bash
bun run --cwd apps/api migrate
bun run --cwd apps/api generate
```

---

## FAQ

### Do I need to expose the API publicly?

Yes, with the current auth setup you should give the API its own public HTTPS URL.

Recommended:

- `app.example.com` → web
- `api.example.com` → api

Normal app traffic still goes through the web service, but auth/callback flows rely on the API URL.

### Do I need to expose Postgres publicly?

No. You should not expose Postgres publicly.

### What should most self-hosters use for config mode?

`memory`

### Can I run Orbit without Docker?

Yes. Local development supports running the web and api directly with Bun.

### What happens on first boot?

Open `/auth` on your Orbit web URL. On a fresh install, Orbit asks you to create the emergency local `admin` account password there. After that, you can sign in and create your normal OAuth-backed admin account if desired.

---

## Vercel / split deployment note

Orbit also supports a split deployment model:

- web on Vercel
- api on a VPS / Hetzner / Docker host
- `ORBIT_CONFIG_MODE=edge` for Edge Config-backed runtime config

That is supported, but the primary documented self-host flow is Docker on a Linux server.
