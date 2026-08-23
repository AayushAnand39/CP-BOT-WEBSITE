# CP Bot Platform — Problem Service

Port: `4003`

This service is the source of truth for the local problem catalogue. Codeforces scraping/import is deliberately left for a later admin-triggered workflow.

## Stored data

- source / contest ID / problem index
- title / rating / tags / concepts
- statement / input / output / constraints / examples / notes
- editorial
- time and memory limits
- trusted solution code and provenance
- generator code, version and hash
- deterministic flag
- DRAFT / READY / DISABLED status

## Public API

```text
GET /health
GET /api/v1/problems
GET /api/v1/problems/:id
```

Public endpoints never return solution or generator code.

## Internal API

Requires `X-Internal-Service-Token`:

```text
POST   /api/v1/problems/internal
GET    /api/v1/problems/internal/:id
PATCH  /api/v1/problems/internal/:id
DELETE /api/v1/problems/internal/:id
```

A problem can be `READY` only when `solutionCode`, `generatorCode` and `deterministic=true` are present. This service does not execute code; Testcase Service and Judge Service do that.

## Setup

Create the database:

```powershell
docker exec -it cpbot-postgres psql -U postgres -c "CREATE DATABASE cpbot_problem;"
```

Then:

```powershell
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm test
npm run dev
```
