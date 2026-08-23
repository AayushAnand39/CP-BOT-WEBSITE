# CP Bot Platform — Bot Service

Deterministic bot simulation service for the CP Bot Platform.

## Port

`4005`

## Responsibility boundary

Bot Service owns:

- bot definitions and target ratings
- deterministic solve/failure simulation
- solve probability
- wrong-answer probability
- expected solve time
- timed bot submission plans
- handoff of bot verdicts to Contest Service

It does **not** own:

- contest state or standings
- user rating calculation
- judging correctness
- testcase generation
- AI hints/coaching

Contest Service remains the source of truth for contest participants, submissions and standings.

## Default bot ladder

Run `npm run seed` to create:

- Rook — 1200
- Knight — 1400
- Bishop — 1600
- Castle — 1800
- Queen — 2000
- King — 2200

## Deterministic simulation

The initial model uses:

- `botRating`
- `problemRating`
- problem tags
- bot strengths/weaknesses
- consistency
- aggression
- speed
- contest seed
- contest ID
- problem ID

to derive:

- solve probability
- wrong-answer probability
- expected solve time
- failed attempts
- verdict sequence

The same bot + contest + problems + seed produces the same simulation plan.

No LLM is used in the deterministic competition loop.

## APIs

### Health

`GET /health`

### Public bot catalogue

`GET /api/v1/bots`

`GET /api/v1/bots/:idOrSlug`

### Internal bot management

`POST /api/v1/bots/internal`

`PATCH /api/v1/bots/internal/:id`

Header:

`X-Internal-Service-Token: <token>`

### Create simulation plan

`POST /api/v1/bots/internal/:botIdOrSlug/simulations`

Example:

```json
{
  "contestId": "contest-uuid",
  "seed": 12345
}
```

The response contains ordered events with `atSeconds`.

### Read simulation run

`GET /api/v1/bots/internal/simulations/:runId`

### Execute simulation run

`POST /api/v1/bots/internal/simulations/:runId/execute`

This feeds bot verdicts into:

`POST /api/v1/contests/internal/:contestId/bot-submissions`

## Bot timestamp integration

For every planned event, Bot Service converts:

`contest.startsAt + event.atSeconds`

into an ISO `submittedAt` timestamp and sends it to Contest Service.

Contest Service validates that this internal timestamp lies inside the contest window and stores it as the submission time, so ICPC penalty calculations now use the simulated bot timing.

## Local setup

Create the database:

```powershell
docker exec -it cpbot-postgres psql -U postgres -c "CREATE DATABASE cpbot_bot;"
```

Then:

```powershell
cd backend\bot-service
copy .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run seed
npm test
npm run dev
```

Service:

`http://localhost:4005`

## Production URLs

Typical Docker Compose values:

```env
CONTEST_SERVICE_URL=http://contest-service:4004
PROBLEM_SERVICE_URL=http://problem-service:4003
```

Use the same `INTERNAL_SERVICE_TOKEN` across trusted backend services for the current MVP.

## Future ML upgrade

The deterministic heuristic is deliberately isolated in:

`src/services/simulation.service.js`

Later it can be replaced or complemented by a trained model using historical CP data to estimate:

- solve probability
- solve time distribution
- number of failed attempts

The surrounding Contest integration can remain unchanged.


## Live bot execution

Start a generated simulation as a real-time contest participant:

```http
POST /api/v1/bots/internal/simulations/:runId/start-live
X-Internal-Service-Token: <token>
```

Bot Service schedules each event at:

```text
contest.startsAt + event.atSeconds
```

Executed event keys are persisted in `BotSimulationRun.executedEventKeys`.

If Bot Service restarts, runs in `LIVE_SCHEDULED` mode are recovered and only events not already recorded are rescheduled.
