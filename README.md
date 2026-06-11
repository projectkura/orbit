# Orbit

Self-hostable workspace platform with built-in rate-limited API access.

## Quick Start

```bash
cp .env.example .env
# edit .env — set ORBIT_WEB_URL, ORBIT_API_URL, BETTER_AUTH_SECRET, DATABASE_URL
docker compose -f docker-compose.selfhost.yml up -d
```

The stack starts PostgreSQL, Dragonfly (Redis-compatible cache), the API, and the web dashboard. Migrations run automatically on first boot.

## API Reference

Orbit exposes a public API keyed by workspace. Every workspace can generate API keys scoped to specific resource types.

### Authentication

All public API endpoints require an API key passed in the `X-API-Key` header.

```bash
curl -H "X-API-Key: orb_api_..." \
  https://api.example.com/api/v1/w/my-workspace/test
```

Two key types exist:

| Type | Prefix | Purpose |
|------|--------|---------|
| `voyager_fivem` | `orb_voy_...` | FiveM Voyager server integration |
| `general` | `orb_api_...` | General public API access |

Keys are created from a workspace's **API Keys** page and are shown only once.

### Test Endpoint

`GET /api/v1/w/:identifier/test`

Verifies authentication, applies rate limits, and returns workspace metadata.

**Request**

```bash
curl -H "X-API-Key: orb_api_xxxxxxxxxxxxxxxx" \
  https://api.example.com/api/v1/w/acme-corp/test
```

**Success — `200 OK`**

```json
{
  "workspace": {
    "id": "...",
    "name": "Acme Corp",
    "identifier": "acme-corp",
    "imageUrl": "https://..."
  }
}
```

**Failure modes**

| Status | Cause |
|--------|-------|
| `401` | Missing or invalid `X-API-Key` |
| `404` | Workspace not found or key does not belong to workspace |
| `429` | Rate limit exceeded (per-minute or per-month bucket) |

Rate limit headers are included on every response:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 1745689200
```

### Rate Limits

Limits are enforced per workspace using Dragonfly as a fast cache; PostgreSQL is the source of truth. If Dragonfly is unavailable, the system falls back to in-memory counters so API requests are never hard-blocked by cache downtime.

| Bucket | Default Free | Default Pro | Resets |
|--------|-------------|-------------|--------|
| `api_requests_per_minute` | 60 | 600 | Every minute |
| `api_requests_per_month` | 10,000 | 100,000 | Calendar month |
| `network_egress_bytes_per_month` | — | — | Calendar month *(future)* |
| `storage_bytes_max` | — | — | — *(future)* |

Admins can override defaults from **Instance Settings** in the admin dashboard. Individual workspaces can receive custom overrides stored in the `rateLimits` JSONB column.

### Workspace Limits Endpoint

`GET /api/v1/workspaces/:identifier/limits` *(session auth)*

Returns resolved limits and live Dragonfly usage counters.

```json
{
  "limits": {
    "apiRequestsPerMinute": 60,
    "apiRequestsPerMonth": 10000,
    "networkEgressBytesPerMonth": null,
    "storageBytesMax": null
  },
  "usage": {
    "apiRequestsPerMinute": { "limit": 60, "used": 12, "remaining": 48, "resetAt": 1745689200 },
    "apiRequestsPerMonth": { "limit": 10000, "used": 342, "remaining": 9658, "resetAt": 1748735999 }
  }
}
```

### Request Logging

Every public API request is logged fire-and-forget to PostgreSQL in `workspace_api_request_logs`:

- workspace ID, API key ID, endpoint, HTTP method
- status code, response time
- client IP, user agent

Logs can be queried directly from the database for audit or billing.

## Configuration

### Environment

Orbit uses a single root `.env`. Copy `.env.example` and fill in the required values.

**Required**

```env
ORBIT_WEB_URL=https://app.example.com
ORBIT_API_URL=https://api.example.com
BETTER_AUTH_SECRET=change-me-to-a-long-random-secret
DATABASE_URL=postgresql://postgres:password@db:5432/orbit
```

**Usually needed**

```env
# Sibling subdomains (app + api)
ORBIT_COOKIE_DOMAIN=.example.com

# Dragonfly cache (auto-configured in self-host compose)
DRAGONFLY_URL=redis://dragonfly:6379
```

**Optional**

- `RESEND_API_KEY` — email delivery
- OAuth credentials — Discord, GitHub, Google
- `ORBIT_R2_*` — Cloudflare R2 for workspace asset storage

### Admin Onboarding

On a fresh install, browse to `/admin/onboarding`, set the instance domain, and save. The next OAuth login is automatically promoted to admin.

### Rate Limit Defaults

Navigate to **Admin → Settings → Rate Limits** to configure per-tier defaults. Changes take effect immediately for all workspaces that do not have an explicit override.

## Architecture

| Service | Tech | Purpose |
|---------|------|---------|
| Web | React + Vite | Dashboard and same-origin proxy |
| API | Hono + Drizzle | Auth, database, config, public API |
| Cache | Dragonfly (Redis-compatible) | Real-time rate limit counters |
| Database | PostgreSQL | Source of truth, schema, request logs |

### Monorepo Layout

- `apps/web` — frontend and same-origin proxy routes
- `apps/api` — auth, database, config, and public API
- `packages/shared` — Zod schemas and types
- `packages/config` — env loading and validation

## License

[GPL-3.0](./LICENSE)
