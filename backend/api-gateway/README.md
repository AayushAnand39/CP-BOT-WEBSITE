# CP Bot Platform — API Gateway

Single public entry point for the CP Bot Platform.

## Port

`4000`

## Architecture

```text
Frontend
   |
   v
API Gateway :4000
   |
   +--> Auth Service    :4001
   +--> User Service    :4002
   +--> Problem Service :4003
   +--> Contest Service :4004
   +--> Bot Service     :4005

Not exposed publicly:
   Testcase Service :4006
   Judge Service    :4007
```

## Responsibilities

The Gateway owns:

- one frontend-facing base URL
- JWT validation for protected routes
- request IDs
- CORS
- public rate limiting
- upstream proxying
- blocking internal service routes
- hiding service topology from the frontend

It does not own:

- authentication credentials
- user profiles
- problems
- contests
- bots
- judging
- testcases

Those remain owned by their respective services.

## Security boundary

Every request under `/api/v1` is checked for an `internal` path segment.

For example, these are never proxied:

```text
/api/v1/users/internal/...
/api/v1/problems/internal/...
/api/v1/contests/internal/...
/api/v1/bots/internal/...
```

The Gateway does not hold `INTERNAL_SERVICE_TOKEN`.

Testcase Service and Judge Service are not configured as Gateway upstreams at all.

## JWT

The Gateway validates the same access JWT issued by Auth Service:

```text
issuer   = cp-bot-auth-service
audience = cp-bot-platform
type     = access
```

Use the same `JWT_SECRET` in Auth Service, User Service, Contest Service, and API Gateway for the current MVP.

After verification, the Gateway preserves the original `Authorization` header and also sends:

```text
X-Auth-User-Id
X-Auth-User-Email
```

as convenience identity headers.

Downstream services should still keep their own JWT/internal authentication checks.

## Public API

### Auth

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/verify
GET  /api/v1/auth/me
```

The Auth Service still performs its own auth checks. The whole auth prefix is proxied so its existing API contract stays unchanged.

### Users

Public:

```text
GET /api/v1/users/public/:username
```

Authenticated:

```text
GET   /api/v1/users/me
PATCH /api/v1/users/me
GET   /api/v1/users/me/stats
PATCH /api/v1/users/me/preferences
```

### Problems

Read-only public catalogue:

```text
GET /api/v1/problems
GET /api/v1/problems/:id
```

### Contests

Public:

```text
GET /api/v1/contests
GET /api/v1/contests/:id
GET /api/v1/contests/:id/standings
```

Authenticated:

```text
POST /api/v1/contests/:id/join
POST /api/v1/contests/:id/submissions
```

### Bots

Public:

```text
GET /api/v1/bots
GET /api/v1/bots/:id
```

Bot creation and simulations remain internal service workflows.

## Local setup

Copy:

```powershell
copy .env.example .env
```

Make sure `JWT_SECRET` exactly matches Auth Service.

Then:

```powershell
npm install
npm test
npm run dev
```

Gateway:

```text
http://localhost:4000
```

Health:

```text
GET http://localhost:4000/health
```

## Frontend configuration

Instead of five backend URLs, frontend should now use only:

```env
VITE_API_URL=http://localhost:4000
```

Example:

```js
fetch(`${import.meta.env.VITE_API_URL}/api/v1/problems`)
```

## Docker Compose service URLs

When services run together in Docker:

```env
AUTH_SERVICE_URL=http://auth-service:4001
USER_SERVICE_URL=http://user-service:4002
PROBLEM_SERVICE_URL=http://problem-service:4003
CONTEST_SERVICE_URL=http://contest-service:4004
BOT_SERVICE_URL=http://bot-service:4005
```

Only the Gateway needs a host-exposed application port for the backend in the final deployment.

## Current next steps

After Gateway integration:

1. point frontend API calls at `:4000`
2. add root Docker Compose/networking
3. make the user-vs-bot challenge orchestration endpoint
4. add live bot event execution
5. add rating/stat updates
6. build AI Service


## Bot challenges

Authenticated:

```text
POST /api/v1/contests/challenges
GET  /api/v1/contests/challenges/:challengeId
```
