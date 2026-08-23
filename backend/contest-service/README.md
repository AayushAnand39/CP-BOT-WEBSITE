# CP Bot Platform - Contest Service

Contest Service owns contest configuration, deterministic problem selection, contest lifecycle, participants, submissions, and standings.

## Core guarantees

- Port: `4004`
- PostgreSQL + Prisma
- Problem selection is deterministic: eligible candidates are stably sorted, then shuffled with a seeded PRNG.
- Only `READY` + `deterministic=true` problems inside the requested rating range can be selected.
- AI/LLMs are not used in contest selection, judging, standings, or scoring.
- User and bot participants share the same contest participant model.

## Routes

Public:

- `GET /health`
- `GET /api/v1/contests`
- `GET /api/v1/contests/:id`
- `GET /api/v1/contests/:id/standings`

Authenticated user:

- `POST /api/v1/contests/:id/join`
- `POST /api/v1/contests/:id/submissions`

Internal service/admin:

- `POST /api/v1/contests/internal`
- `POST /api/v1/contests/internal/:id/start`
- `POST /api/v1/contests/internal/:id/end`
- `POST /api/v1/contests/internal/:id/cancel`
- `POST /api/v1/contests/internal/:id/bot-submissions`

Internal routes require `X-Internal-Service-Token`.

## Current Judge integration

The currently built Judge Service accepts `tests` inline. Therefore the user submission endpoint temporarily accepts:

```json
{
  "problemId": "uuid",
  "language": "cpp",
  "sourceCode": "...",
  "tests": [{"input":"...","expectedOutput":"..."}]
}
```

This is deliberately an integration bridge, not the final production contract. The final path should be Contest -> TestcaseSet ID -> object storage -> Judge. Once TestcaseSet persistence/storage is implemented, remove `tests` from the public request and have Judge retrieve the artifact internally.

## Scoring

MVP ICPC-like scoring:

- First AC for a participant/problem: `score += 1`
- Penalty: minutes since contest start + `20 * wrongAttemptsBeforeAC`
- Additional ACs on the same problem do not add score.
- Standings: score descending, penalty ascending, then join time ascending.

## Setup

```powershell
docker exec -it cpbot-postgres psql -U postgres -c "CREATE DATABASE cpbot_contest;"
cd backend\contest-service
copy .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm test
npm run dev
```

Health: `http://localhost:4004/health`

## Production service URLs

```env
PROBLEM_SERVICE_URL=http://problem-service:4003
JUDGE_SERVICE_URL=http://judge-service:4007
```


## Bot simulated timestamps

Trusted Bot Service submissions may include:

```json
{
  "botId": "bot-id",
  "problemId": "problem-uuid",
  "verdict": "AC",
  "executionTimeMs": 123,
  "submittedAt": "2026-08-16T12:30:00.000Z"
}
```

`submittedAt` is validated to be within the contest's `[startsAt, endsAt]` window.
If omitted, Contest Service falls back to the current time.


## User-vs-bot challenge orchestration

Authenticated endpoint:

```http
POST /api/v1/contests/challenges
Authorization: Bearer <JWT>
```

Example:

```json
{
  "botId": "bishop-1600",
  "problemCount": 4,
  "durationSeconds": 7200
}
```

`difficultyMin` and `difficultyMax` are optional. When omitted, Contest Service uses approximately `bot.rating ± 200`.

The orchestration sequence is:

1. validate the selected bot
2. create a deterministic scheduled contest
3. join the authenticated user
4. join the bot
5. request a deterministic Bot Service simulation plan
6. persist `simulationRunId` in `BotChallenge`
7. start the contest
8. tell Bot Service to start live timed execution
9. return the playable contest

Read one challenge:

```http
GET /api/v1/contests/challenges/:challengeId
Authorization: Bearer <JWT>
```

Only the challenge owner may read it.


## Automatic completion and rating

When a challenge contest starts, Contest Service schedules automatic completion at `endsAt`.

On service restart, all RUNNING contests with an `endsAt` value are recovered and rescheduled.

Completion compares user vs bot by:

1. score descending
2. penalty ascending
3. exact equality is a DRAW

For a bot challenge, Contest Service sends one idempotent result event to User Service:

```text
bot-challenge:<challengeId>:completion
```

User Service atomically updates rating and counters. The challenge stores the resulting rating delta.
