# CP Bot Platform

A full-stack competitive-programming platform where users can challenge rating-based coding bots in timed contests, solve curated programming problems, run and submit code against deterministic testcases, track standings and submissions, and receive rating changes after bot challenges.

The project is implemented as a React frontend plus a Node.js/Express microservice backend. PostgreSQL-backed services are isolated by domain, compilation and testcase execution are separated into dedicated services, and an admin workflow supports preparing problems manually or from Codeforces with AI-assisted formatting and testcase generation.

---

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Architecture](#architecture)
- [Service Map](#service-map)
- [Repository Structure](#repository-structure)
- [Technology Stack](#technology-stack)
- [Application Flows](#application-flows)
  - [Authentication](#authentication-flow)
  - [Bot Challenge](#bot-challenge-flow)
  - [Contest and Submission](#contest-and-submission-flow)
  - [Admin Problem Preparation](#admin-problem-preparation-flow)
  - [Testcase Storage](#testcase-storage-flow)
  - [Production Warmup](#production-warmup-flow)
- [Frontend](#frontend)
- [Backend Services](#backend-services)
- [Database Models](#database-models)
- [API Overview](#api-overview)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Docker Compose](#docker-compose)
- [Database Setup and Prisma](#database-setup-and-prisma)
- [Testcase and Judge Requirements](#testcase-and-judge-requirements)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Warmup and Free-Tier Cold Starts](#warmup-and-free-tier-cold-starts)
- [Security Model](#security-model)
- [Troubleshooting](#troubleshooting)
- [Known Operational Considerations](#known-operational-considerations)
- [Future Improvements](#future-improvements)

---

## Overview

CP Bot takes inspiration from rating-based bot systems in competitive games and applies the idea to competitive programming.

A user selects a bot, creates a timed challenge, receives a contest containing eligible deterministic problems, and competes against a simulated bot. Both the user and bot produce submissions, and the platform tracks verdicts, scores, penalties, activity, standings, challenge outcomes, and rating changes.

The platform additionally contains an administrator-facing problem preparation pipeline capable of:

- importing Codeforces problems;
- manually entering problem data;
- cleaning copied problem statements with AI;
- generating testcase-generator source code;
- compiling and executing generators and reference solutions;
- creating persistent testcase artifacts;
- storing approved problems in the problem database;
- re-editing stored problems;
- rebuilding testcase archives;
- regenerating testcases for existing problems.

---

## Core Features

### User-facing

- Account registration and login.
- JWT-based authentication.
- User profile, rating, preferences, and statistics.
- Rating-based bot catalogue.
- Bot challenge creation.
- Timed contests with one or more problems.
- Markdown, mathematical notation, and KaTeX problem rendering.
- Monaco code editor.
- Sample and custom testcase execution.
- Hidden-test submission judging.
- Per-test result visibility.
- Contest activity feed and submission history.
- Standings and score tracking.
- Contest result page.
- Rating changes and competitive-event history.
- Bot challenge history.

### Administrator-facing

- Codeforces problem import.
- Manual problem creation.
- AI-assisted statement polishing.
- Generator-code generation.
- Generator review before testcase creation.
- Deterministic testcase generation.
- ZIP/archive generation.
- Problem persistence only after approval.
- Existing-problem maintenance.
- Problem text editing without unintentionally reverting a READY problem to DRAFT.
- Testcase regeneration.
- Archive rebuilding.

### Platform / infrastructure

- API Gateway as the public backend entry point.
- Domain-oriented backend microservices.
- PostgreSQL + Prisma for persistent relational data.
- Separate Judge and Testcase services for unsafe/CPU-heavy execution.
- Cloudflare R2-compatible object storage support for testcase durability.
- Production service warmup for sleeping free-tier backend instances.
- 10-minute browser keepalive while the application remains actively open.
- Dockerfiles for all backend services.
- Docker Compose for local containerized operation.
- Windows PowerShell launcher for local multi-service development.

---

## Architecture

```text
                           ┌───────────────────────┐
                           │      React + Vite     │
                           │       Frontend        │
                           └───────────┬───────────┘
                                       │
                                       │ HTTP / JWT
                                       ▼
                           ┌───────────────────────┐
                           │      API Gateway      │
                           │        :4000          │
                           └─────┬────┬────┬───────┘
                                 │    │    │
             ┌───────────────────┘    │    └──────────────────────┐
             ▼                        ▼                           ▼
      ┌─────────────┐          ┌─────────────┐             ┌─────────────┐
      │ Auth :4001  │          │ User :4002  │             │Problem :4003│
      └──────┬──────┘          └─────────────┘             └──────┬──────┘
             │                                                     │
             │ profile creation                                    │ problem data
             ▼                                                     ▼
      ┌─────────────────────────────────────────────────────────────────────┐
      │                         Contest :4004                               │
      │ contest orchestration, submissions, standings, challenge results  │
      └───────────────┬─────────────────┬──────────────────┬────────────────┘
                      │                 │                  │
                      ▼                 ▼                  ▼
              ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
              │ Bot :4005   │   │Testcase :4006│   │ Judge :4007  │
              └──────┬──────┘   └──────┬───────┘   └──────┬───────┘
                     │                 │                  │
                     │                 │ R2 artifacts     │ compile/run
                     │                 ▼                  ▼
                     │          ┌──────────────┐   temporary runtime
                     │          │ Object Store │
                     │          └──────────────┘
                     │
                     ▼
              ┌─────────────┐
              │ AI :4008    │
              │ admin prep  │
              └─────────────┘
```

The browser talks primarily to the API Gateway. The Gateway authenticates or authorizes public requests and proxies them to the owning service. Internal service endpoints are protected with a shared internal-service token and are blocked from direct public access through the Gateway.

---

## Service Map

| Service | Default Port | Responsibility | Persistence |
|---|---:|---|---|
| API Gateway | 4000 | Public API, auth/admin checks, proxying, warmup/readiness | None |
| Auth Service | 4001 | Credentials, login, registration, JWT verification | PostgreSQL |
| User Service | 4002 | Profile, preferences, rating, statistics, competitive events | PostgreSQL |
| Problem Service | 4003 | Problem catalogue and internal CRUD | PostgreSQL |
| Contest Service | 4004 | Challenges, contests, submissions, standings, scoring, completion | PostgreSQL |
| Bot Service | 4005 | Bot catalogue, simulation planning, live scheduling | PostgreSQL |
| Testcase Service | 4006 | Generator execution, output generation, archive management, R2 persistence | Runtime + object storage |
| Judge Service | 4007 | C++/other supported source compilation and testcase execution | Temporary runtime |
| AI Service | 4008 | Codeforces import, AI formatting, generator creation, admin orchestration | Delegates to other services |

---

## Repository Structure

```text
CP-BOT-WEBSITE-main/
├── backend/
│   ├── ai-service/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── bot-service/
│   ├── contest-service/
│   ├── judge-service/
│   ├── problem-service/
│   ├── testcase-service/
│   └── user-service/
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── routes/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
│
├── infrastructure/
├── docker-compose.yml
├── start-backend.ps1
├── start-backend.bat
├── start-backend-fast.bat
└── PROJECT_CONTEXT.md
```

Each backend service is independently installable and contains its own `package.json`, configuration, routes, middleware, Dockerfile, tests, and—where needed—Prisma schema.

---

## Technology Stack

### Frontend

- React 19
- Vite 7
- React Router
- Axios
- Monaco Editor
- React Markdown
- Remark GFM
- Remark Math
- Rehype KaTeX
- KaTeX

### Backend

- Node.js 20+
- Express 5
- Zod
- Helmet
- CORS
- JSON Web Tokens
- `http-proxy-middleware`
- Prisma ORM
- PostgreSQL

### Execution / testcase infrastructure

- GNU C++ compiler (`g++`)
- Node child processes
- Archiver
- AWS SDK S3 client
- S3-compatible object storage / Cloudflare R2

### AI / external data

- OpenAI-compatible client
- Groq-compatible configuration
- Cheerio
- Codeforces data/import workflow

---

## Application Flows

## Authentication Flow

```text
Register
  │
  ▼
API Gateway
  │
  ▼
Auth Service ──────► create credentials
  │
  └───────────────► User Service internal profile creation

Login
  │
  ▼
Auth Service
  │
  ├─ verify password
  └─ issue JWT

Authenticated request
  │ Authorization: Bearer <token>
  ▼
API Gateway
  │
  └─ requireAuth middleware
```

The frontend stores the access token under `cpbot_access_token` in `localStorage`. Axios automatically adds it to authenticated requests.

---

## Bot Challenge Flow

```text
User selects bot
      │
      ▼
POST /api/v1/contests/challenges
      │
      ▼
Contest Service
      │
      ├─ validate user/bot/challenge parameters
      ├─ select eligible READY deterministic problems
      ├─ create contest + participant rows
      ├─ ask Bot Service for simulation plan
      └─ transition challenge toward RUNNING

Bot Service
      │
      ├─ use bot rating/personality
      ├─ create deterministic simulation plan
      └─ schedule bot submission events

Contest Service
      │
      ├─ accept bot submissions through internal endpoint
      ├─ update score/activity
      └─ finish challenge and apply result
```

Bot profiles include rating and behavioral parameters such as aggression, consistency, speed, tag strengths, and tag weaknesses.

---

## Contest and Submission Flow

The contest workspace contains:

- problem statement;
- input/output specifications;
- constraints;
- formatted examples;
- Monaco source editor;
- sample/custom testcase workbench;
- Run and Submit controls;
- contest timer;
- standings;
- activity and submission history;
- hidden testcase verdict details.

### Run

```text
Browser
  │
  ▼
POST /api/v1/contests/:id/run
  │
  ▼
Contest Service
  │
  ▼
Judge Service
  │
  ├─ compile source
  ├─ execute against supplied input
  └─ return output / CE / RE / TLE
```

### Submit

```text
Browser
  │
  ▼
POST /api/v1/contests/:id/submissions
  │
  ▼
Contest Service
  │
  ├─ load problem metadata
  ├─ resolve hidden testcase job
  ├─ obtain hidden tests from Testcase Service
  └─ call Judge Service
          │
          ├─ compile
          ├─ execute each testcase
          └─ return verdict and test results
  │
  ▼
Submission persisted
  │
  ├─ score / penalty updated
  ├─ standings updated
  └─ activity available to frontend
```

The testcase service exposes the internal hidden-test route:

```text
GET /api/v1/testcases/internal/:jobId/tests
```

which is required by the judging flow.

---

## Admin Problem Preparation Flow

Administrators are determined by the API Gateway using the configured `ADMIN_EMAILS` list. Admin requests are forwarded to the AI Service with an orchestration token and authenticated administrator metadata.

### Codeforces import

```text
Admin enters Codeforces problem code
        │
        ▼
AI Service
        │
        ├─ obtain problem information
        ├─ prepare solution/generator data
        ├─ generate deterministic testcases
        └─ store resulting Problem through Problem Service
```

### Manual workflow

```text
1. Enter title, statement, constraints, formats, examples and reference solution
2. Optionally polish copied text with AI
3. Generate testcase-generator code
4. Review generator code
5. Approve generator
6. Generate testcase files + archive
7. Submit approved problem
8. Problem Service persists READY/deterministic metadata
```

The AI polish action deliberately does not modify the submitted reference solution code.

### Existing-problem maintenance

Supported Gateway endpoints include:

```text
GET   /api/v1/admin/problems/maintenance/:problemId
PATCH /api/v1/admin/problems/maintenance/:problemId
POST  /api/v1/admin/problems/maintenance/:problemId/rebuild-archive
POST  /api/v1/admin/problems/maintenance/:problemId/regenerate-testcases
```

Content-only updates use a PATCH schema without create-time defaults so editing statement fields does not unintentionally reset `status` to `DRAFT` or `deterministic` to `false`.

---

## Testcase Storage Flow

The Testcase Service generates deterministic inputs and reference outputs in a temporary/runtime workspace.

Supported internal operations include:

```text
POST   /api/v1/testcases/internal/generate
GET    /api/v1/testcases/internal/:jobId/archive
GET    /api/v1/testcases/internal/:jobId/metadata
POST   /api/v1/testcases/internal/:jobId/rebuild-archive
GET    /api/v1/testcases/internal/:jobId/tests
DELETE /api/v1/testcases/internal/:jobId
```

When R2 configuration is supplied, testcase artifacts can be persisted in S3-compatible object storage rather than relying exclusively on ephemeral local disk.

Typical artifact data includes:

- generated input files;
- corresponding expected output files;
- manifest/metadata;
- downloadable ZIP archive.

The local `runtime` folder should be treated as execution/cache storage, not as the only durable source of truth in hosted environments with ephemeral filesystems.

---

## Production Warmup Flow

The current frontend includes `BackendWarmupGate`, which wraps `AuthProvider` in `App.jsx`.

This placement is intentional: backend services are warmed before `AuthProvider` attempts `/auth/me` or `/users/me`.

```text
App
 │
 ▼
BackendWarmupGate
 │
 ├─ browser sends direct /health requests to configured service URLs
 ├─ waits for cold starts
 ├─ asks Gateway /api/v1/system/warmup for readiness
 ├─ retries while required services are waking
 └─ marks application READY
 │
 ▼
AuthProvider
 │
 ▼
Navbar + Routes
```

The browser direct-wakeup URLs are configured with:

```text
VITE_GATEWAY_URL
VITE_AUTH_SERVICE_URL
VITE_USER_SERVICE_URL
VITE_PROBLEM_SERVICE_URL
VITE_CONTEST_SERVICE_URL
VITE_BOT_SERVICE_URL
VITE_AI_SERVICE_URL
```

Direct wake requests use `fetch(..., { mode: "no-cors" })` because their purpose is to create inbound traffic, not to inspect the response.

After successful startup, `BackendWarmupGate` sends a wake request every 10 minutes while the application remains open. This prevents actively used free-tier services from reaching a 15-minute idle window. Once the browser closes/unmounts the component, the interval is cleared and services are free to sleep again.

The Gateway readiness endpoint is:

```text
GET /api/v1/system/warmup
```

AI is considered optional by the readiness gate so an unavailable AI service does not block ordinary login, bot selection, or contest usage.

---

# Frontend

## Pages

| Route | Page | Purpose |
|---|---|---|
| `/` | `HomePage` | Landing page |
| `/login` | `LoginPage` | User login |
| `/register` | `RegisterPage` | Account creation |
| `/bots` | `BotsPage` | Browse/select bots and create challenge |
| `/challenge/:challengeId` | `ChallengePage` | Challenge preparation/status |
| `/contest/:contestId` | `ContestPage` | Live contest workspace |
| `/result/:id` | `ResultPage` | Challenge outcome and rating result |
| `/history` | `HistoryPage` | Bot contest history |
| `/profile` | `ProfilePage` | User profile and statistics |
| `/admin/problems/import` | `AdminProblemImportPage` | Admin import/manual authoring/maintenance |

Protected routes are wrapped by `ProtectedRoute` and require a valid authenticated session.

## Important frontend components

- `BackendWarmupGate.jsx` — free-tier cold-start warmup and keepalive.
- `Navbar.jsx` — application navigation.
- `ProblemRenderer.jsx` — Markdown/GFM/math rendering.
- `AdminProblemMaintenancePanel.jsx` — existing problem repair/edit operations.
- `SubmissionCodeModal.jsx` — source inspection from submission history.
- `BotCard.jsx` — bot selection UI.

## API modules

```text
frontend/src/api/
├── admin.api.js
├── auth.api.js
├── bot.api.js
├── client.js
├── contest.api.js
├── problem.api.js
├── system.api.js
└── user.api.js
```

`client.js` uses `VITE_API_URL` as the Gateway base URL and automatically attaches the stored JWT.

---

# Backend Services

## API Gateway

**Directory:** `backend/api-gateway`  
**Default port:** `4000`

Responsibilities:

- public API entry point;
- JWT validation;
- admin authorization;
- blocking direct access to `/internal` service routes;
- proxying requests to domain services;
- CORS handling;
- request IDs and diagnostic headers/logging;
- service readiness/warmup checks;
- production validation of service URLs.

In production, Gateway validation rejects localhost upstream URLs, duplicate service URLs, and an upstream URL that points back to the Gateway itself.

---

## Auth Service

**Directory:** `backend/auth-service`  
**Default port:** `4001`

Responsibilities:

- registration;
- login;
- password hashing with bcrypt;
- JWT verification;
- `/me` identity response;
- internal User Service profile creation during registration.

Database model: `AuthUser`.

---

## User Service

**Directory:** `backend/user-service`  
**Default port:** `4002`

Responsibilities:

- user profile;
- public profile;
- rating;
- user preferences;
- aggregate statistics;
- competitive-event recording;
- atomic internal stats/rating updates.

Database models:

- `User`
- `UserStats`
- `UserPreferences`
- `UserCompetitiveEvent`

---

## Problem Service

**Directory:** `backend/problem-service`  
**Default port:** `4003`

Responsibilities:

- public problem catalogue;
- public problem retrieval;
- internal create/update/delete;
- status and deterministic metadata;
- reference solution/generator metadata;
- testcase artifact references.

Problem statuses:

```text
DRAFT
READY
DISABLED
```

Solution sources:

```text
EDITORIAL
CURATED
EXTERNAL
AI_GENERATED
```

---

## Contest Service

**Directory:** `backend/contest-service`  
**Default port:** `4004`

Responsibilities:

- challenge creation;
- contest creation/start/end/cancel;
- problem selection;
- participant management;
- run/sample-run requests;
- hidden-test submissions;
- bot submission ingestion;
- standings/activity;
- challenge completion;
- user rating/stat updates;
- contest end-timer recovery.

Its server starts listening before asynchronous contest-timer recovery so `/health` becomes available quickly after a cold start.

---

## Bot Service

**Directory:** `backend/bot-service`  
**Default port:** `4005`

Responsibilities:

- bot catalogue;
- internal bot CRUD;
- deterministic simulation planning;
- live simulation scheduling;
- bot event execution;
- scheduler recovery after process restart.

Its server opens the HTTP listener before live simulation recovery to avoid blocking `/health` during production cold starts.

---

## Testcase Service

**Directory:** `backend/testcase-service`  
**Default port:** `4006`

Responsibilities:

- compile generator source;
- compile reference solution;
- execute generator repeatedly;
- stream generated inputs to files;
- generate expected outputs;
- enforce file/count/total-size constraints;
- archive testcase artifacts;
- expose testcase metadata and hidden testcase contents to trusted services;
- upload/recover artifacts from R2-compatible object storage.

This service requires a C++ toolchain in its runtime environment.

---

## Judge Service

**Directory:** `backend/judge-service`  
**Default port:** `4007`

Responsibilities:

- compile submitted source;
- execute code with timeout/output constraints;
- judge multiple hidden tests;
- return per-test results;
- return verdicts such as AC, WA, TLE, RE, CE and related metadata.

This service also requires a C++ toolchain.

---

## AI Service

**Directory:** `backend/ai-service`  
**Default port:** `4008`

Responsibilities:

- administrator orchestration;
- Codeforces problem import;
- AI-assisted statement polishing;
- generator-code generation;
- manual problem submission pipeline;
- existing problem maintenance;
- orchestration across Problem, Testcase, and Judge services.

---

# Database Models

## Auth database

### `auth_users`

- `id`
- `email`
- `passwordHash`
- `isActive`
- timestamps

## User database

### `users`

Stores username, display name, bio, and current rating.

### `user_stats`

Tracks problems solved/attempted, contests played/won, bot challenges/wins, submissions, and accepted submissions.

### `user_preferences`

Stores preferred language, theme, and profile visibility.

### `user_competitive_events`

Stores idempotent competitive result events and rating/stat deltas.

## Problem database

### `problems`

Important fields include:

- source + Codeforces source identifiers;
- title/rating/tags/concepts;
- statement/input/output/constraints;
- examples;
- editorial/notes;
- time and memory limits;
- reference solution;
- generator code/hash/version;
- testcase artifact JSON;
- `deterministic`;
- `status`.

## Contest database

### `contests`

Contest timing, difficulty range, problem count, seed, status.

### `contest_problems`

Problem membership and ordering.

### `contest_participants`

USER/BOT participants, score, penalty, rank.

### `submissions`

Source code, language, verdict, score, execution time, hidden test results, timestamps.

### `bot_challenges`

Challenge ownership, bot information, simulation run, outcome, rating before/after/delta, completion state.

## Bot database

### `bots`

Bot metadata, rating, enabled flag, speed/aggression/consistency, tag strengths/weaknesses.

### `bot_simulation_runs`

Deterministic plan JSON, execution state, live start time, event keys and timestamps.

---

# API Overview

The public frontend should use the API Gateway, normally mounted at:

```text
/api/v1
```

## System

```text
GET /api/v1/system/warmup
```

## Authentication

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/verify
GET  /api/v1/auth/me
```

## Users

```text
GET   /api/v1/users/public/:username
GET   /api/v1/users/me
PATCH /api/v1/users/me
GET   /api/v1/users/me/stats
PATCH /api/v1/users/me/preferences
```

Additional internal User Service endpoints handle profile creation, rating/stat updates, increments, and challenge results.

## Problems

```text
GET /api/v1/problems
GET /api/v1/problems/:id
```

Problem mutations are intentionally internal/admin-orchestrated rather than exposed as ordinary public CRUD through the Gateway.

## Bots

```text
GET /api/v1/bots
GET /api/v1/bots/:id
```

Internal Bot Service routes additionally support create/update and simulation lifecycle operations.

## Challenges and contests

```text
POST /api/v1/contests/challenges
GET  /api/v1/contests/challenges
GET  /api/v1/contests/challenges/:challengeId

GET  /api/v1/contests
GET  /api/v1/contests/:id
GET  /api/v1/contests/:id/problems/:problemId
GET  /api/v1/contests/:id/activity
GET  /api/v1/contests/:id/standings
POST /api/v1/contests/:id/join
POST /api/v1/contests/:id/run-samples
POST /api/v1/contests/:id/run
GET  /api/v1/contests/:id/submissions/:submissionId
POST /api/v1/contests/:id/submissions
POST /api/v1/contests/:id/finish
```

## Admin problem preparation

```text
POST /api/v1/admin/problems/import
POST /api/v1/admin/problems/manual/polish
POST /api/v1/admin/problems/manual/generator
POST /api/v1/admin/problems/manual/testcases
POST /api/v1/admin/problems/manual/submit

GET   /api/v1/admin/problems/maintenance/:problemId
PATCH /api/v1/admin/problems/maintenance/:problemId
POST  /api/v1/admin/problems/maintenance/:problemId/rebuild-archive
POST  /api/v1/admin/problems/maintenance/:problemId/regenerate-testcases
```

---

# Environment Variables

Do not commit real secrets. Use local `.env` files and your hosting provider's secret/environment configuration.

## Shared backend values

```env
NODE_ENV=development
INTERNAL_SERVICE_TOKEN=<long-random-shared-token>
```

The same `INTERNAL_SERVICE_TOKEN` must be used by services that call protected `/internal` endpoints.

## API Gateway

```env
PORT=4000
NODE_ENV=development
JWT_SECRET=<minimum-32-character-secret>

AUTH_SERVICE_URL=http://localhost:4001
USER_SERVICE_URL=http://localhost:4002
PROBLEM_SERVICE_URL=http://localhost:4003
CONTEST_SERVICE_URL=http://localhost:4004
BOT_SERVICE_URL=http://localhost:4005
AI_SERVICE_URL=http://localhost:4008

ADMIN_EMAILS=admin@example.com
ADMIN_ORCHESTRATION_TOKEN=<admin-orchestration-secret>
CORS_ORIGINS=http://localhost:5173
REQUEST_TIMEOUT_MS=600000
TRUST_PROXY=true
```

`ADMIN_EMAILS` can contain the administrator email addresses expected by the Gateway's admin middleware.

## Auth Service

```env
PORT=4001
NODE_ENV=development
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=<same-jwt-secret>
JWT_EXPIRES_IN=7d
INTERNAL_SERVICE_TOKEN=<shared-token>
USER_SERVICE_URL=http://localhost:4002
CORS_ORIGINS=http://localhost:5173
REQUEST_TIMEOUT_MS=90000
TRUST_PROXY=true
```

## User Service

```env
PORT=4002
NODE_ENV=development
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=<same-jwt-secret>
INTERNAL_SERVICE_TOKEN=<shared-token>
CORS_ORIGINS=http://localhost:5173
TRUST_PROXY=true
```

## Problem Service

```env
PORT=4003
NODE_ENV=development
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
INTERNAL_SERVICE_TOKEN=<shared-token>
CORS_ORIGINS=http://localhost:5173
TRUST_PROXY=true
```

## Contest Service

```env
PORT=4004
NODE_ENV=development
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=<same-jwt-secret>
INTERNAL_SERVICE_TOKEN=<shared-token>

PROBLEM_SERVICE_URL=http://localhost:4003
BOT_SERVICE_URL=http://localhost:4005
TESTCASE_SERVICE_URL=http://localhost:4006
JUDGE_SERVICE_URL=http://localhost:4007
USER_SERVICE_URL=http://localhost:4002

REQUEST_TIMEOUT_MS=120000
CORS_ORIGINS=http://localhost:5173
TRUST_PROXY=true
```

## Bot Service

```env
PORT=4005
NODE_ENV=development
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
INTERNAL_SERVICE_TOKEN=<shared-token>
CONTEST_SERVICE_URL=http://localhost:4004
PROBLEM_SERVICE_URL=http://localhost:4003
AI_SERVICE_URL=http://localhost:4008
REQUEST_TIMEOUT_MS=90000
BOT_AI_TIMEOUT_MS=...
CORS_ORIGINS=http://localhost:5173
```

## Testcase Service

```env
PORT=4006
NODE_ENV=development
INTERNAL_SERVICE_TOKEN=<shared-token>
CORS_ORIGINS=http://localhost:5173
TRUST_PROXY=true

GENERATION_WORK_DIR=./runtime
COMPILE_TIMEOUT_MS=...
GENERATOR_TIMEOUT_MS=...
SOLUTION_TIMEOUT_MS=...
MAX_TEST_FILES=...
MAX_INPUT_BYTES_PER_FILE=...
MAX_TOTAL_BYTES=...

R2_ACCOUNT_ID=<optional>
R2_ACCESS_KEY_ID=<optional>
R2_SECRET_ACCESS_KEY=<optional>
R2_BUCKET_NAME=<optional>
R2_ENDPOINT=<optional>
```

## Judge Service

```env
PORT=4007
NODE_ENV=development
INTERNAL_SERVICE_TOKEN=<shared-token>
CORS_ORIGINS=http://localhost:5173
TRUST_PROXY=true

JUDGE_WORK_DIR=./runtime
COMPILE_TIMEOUT_MS=...
EXECUTION_TIMEOUT_MS=...
MAX_CODE_BYTES=...
MAX_INPUT_BYTES_PER_TEST=...
MAX_OUTPUT_BYTES_PER_TEST=...
MAX_TESTS_PER_SUBMISSION=...
```

## AI Service

```env
PORT=4008
NODE_ENV=development
ADMIN_ORCHESTRATION_TOKEN=<same-admin-token-as-gateway>
INTERNAL_SERVICE_TOKEN=<shared-token>

PROBLEM_SERVICE_URL=http://localhost:4003
TESTCASE_SERVICE_URL=http://localhost:4006
JUDGE_SERVICE_URL=http://localhost:4007

GROQ_API_KEY=<optional-ai-key>
GROQ_BASE_URL=<provider-base-url>
GROQ_MODEL=openai/gpt-oss-120b

DEFAULT_TEST_COUNT=...
CODEFORCES_API_GAP_MS=...
CODEFORCES_STATUS_PAGES=...
CODEFORCES_STATUS_PAGE_SIZE=...
REQUEST_TIMEOUT_MS=...
TESTCASE_GENERATION_TIMEOUT_MS=...
```

## Frontend

Local minimum:

```env
VITE_API_URL=http://localhost:4000
```

For hosted direct browser wakeup:

```env
VITE_API_URL=https://<gateway-host>
VITE_GATEWAY_URL=https://<gateway-host>
VITE_AUTH_SERVICE_URL=https://<auth-host>
VITE_USER_SERVICE_URL=https://<user-host>
VITE_PROBLEM_SERVICE_URL=https://<problem-host>
VITE_CONTEST_SERVICE_URL=https://<contest-host>
VITE_BOT_SERVICE_URL=https://<bot-host>
VITE_AI_SERVICE_URL=https://<ai-host>
```

Vite variables are embedded at build time. After adding/changing `VITE_*` values in a host such as Vercel, rebuild/redeploy the frontend.

---

# Local Development

## Prerequisites

- Node.js 20 or newer.
- npm.
- PostgreSQL 16+ or another PostgreSQL-compatible hosted database.
- `g++` available for Judge/Testcase execution when running them directly.
- PowerShell on Windows if using the included launcher.

Optional:

- Docker / Docker Compose.
- S3-compatible object storage credentials for durable testcase artifacts.
- AI provider credentials for admin AI features.

## Option A: Windows launcher

The project includes a single-console backend launcher.

From the repository root:

```powershell
.\start-backend.ps1
```

or double-click/run:

```text
start-backend.bat
```

For faster subsequent starts that skip setup:

```text
start-backend-fast.bat
```

Equivalent PowerShell:

```powershell
.\start-backend.ps1 -SkipSetup
```

Useful flags:

```powershell
.\start-backend.ps1 -ClearLogs
.\start-backend.ps1 -Dev
.\start-backend.ps1 -SkipSetup
```

The launcher checks ports, installs missing dependencies during setup, handles Prisma-enabled services, starts services, and writes per-service logs under `logs/`.

Default local ports:

```text
4000 Gateway
4001 Auth
4002 User
4003 Problem
4004 Contest
4005 Bot
4006 Testcase
4007 Judge
4008 AI
```

## Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite defaults to:

```text
http://localhost:5173
```

---

# Docker Compose

The repository contains a local full-stack backend compose file.

```bash
docker compose up --build
```

The Compose configuration starts:

- PostgreSQL 16 Alpine;
- all eight domain services;
- API Gateway;
- persistent PostgreSQL volume;
- testcase runtime volume;
- judge runtime volume.

PostgreSQL is mapped to host port `5433` to avoid colliding with an existing PostgreSQL instance on `5432`.

The Gateway is exposed on:

```text
http://localhost:4000
```

Other backend services communicate over the private Docker network.

> Note: some legacy rate-limit environment entries may still exist in `docker-compose.yml`, while the current source no longer mounts the old application-wide `express-rate-limit` setup. Source `env.js` files are the authoritative list of values actually consumed by the current code.

---

# Database Setup and Prisma

Prisma is used by:

- Auth Service
- User Service
- Problem Service
- Contest Service
- Bot Service

Each has its own schema and database URL.

Typical setup inside a Prisma-enabled service:

```bash
npm install
npx prisma generate
npx prisma migrate dev
```

For deployed environments:

```bash
npx prisma migrate deploy
```

The Prisma schemas expect both:

```env
DATABASE_URL=...
DIRECT_URL=...
```

when configured for hosted PostgreSQL providers that distinguish pooled and direct connections.

Bot seed data can be loaded with:

```bash
cd backend/bot-service
npm run seed
```

Avoid running destructive `prisma migrate reset` against a production database.

---

# Testcase and Judge Requirements

Both Testcase and Judge services execute untrusted/generated code and should be isolated from ordinary API services in production.

Their Docker images install a C++ compiler and expose only internal authenticated execution routes.

Recommended operational controls include:

- CPU/memory isolation;
- execution timeouts;
- output-size limits;
- testcase count/size limits;
- temporary-workspace cleanup;
- no public exposure of internal judge/testcase routes;
- trusted internal-service token validation.

For a production-grade public judge, OS/container sandboxing should be stronger than ordinary process spawning alone.

---

# Testing

Backend services use Node's built-in test runner, with `supertest` where HTTP-level tests are required.

Run tests inside an individual service:

```bash
cd backend/<service>
npm test
```

Examples:

```bash
cd backend/user-service
npm test

cd ../contest-service
npm test

cd ../judge-service
npm test
```

Notable test areas in the repository include:

- authentication and registration validation;
- Gateway auth/internal-route behavior;
- rating updates;
- contest completion;
- deterministic random behavior;
- bot simulation planning;
- judge/testcase HTTP behavior;
- AI problem-code handling.

---

# Production Deployment

The codebase supports independent service deployment through each service's Dockerfile.

A practical production split is:

```text
Frontend                   static frontend host (e.g. Vercel)
Gateway/Auth/User/
Problem/Contest/Bot/AI     Node web-service host
Judge/Testcase             container host suitable for compilation/execution
PostgreSQL                 managed PostgreSQL
Testcase artifacts         R2 / S3-compatible object storage
```

## Important production rules

1. Set `NODE_ENV=production`.
2. Never leave production service URLs at localhost defaults.
3. Use the same `JWT_SECRET` where JWT verification is required.
4. Use the same `INTERNAL_SERVICE_TOKEN` across mutually trusted internal callers.
5. Keep `ADMIN_ORCHESTRATION_TOKEN` identical between Gateway and AI Service.
6. Configure exact CORS origins rather than `*`.
7. Use HTTPS service URLs.
8. Configure each service's `/health` as the hosting platform health path.
9. Run Prisma migrations before or as part of deployment.
10. Keep Judge/Testcase internal endpoints inaccessible to arbitrary internet clients.

The Gateway contains production validation intended to catch common deployment mistakes such as duplicated upstream service URLs or a service URL accidentally pointing back at the Gateway.

---

# Warmup and Free-Tier Cold Starts

The current source contains explicit support for hosts that put inactive services to sleep.

## Startup behavior

`BackendWarmupGate` runs before `AuthProvider`.

1. It sends direct browser `/health` requests to configured service URLs.
2. It waits 10 seconds.
3. It asks Gateway `/api/v1/system/warmup` which required services are ready.
4. If not ready, it sends direct wake requests again and retries.
5. It performs up to eight readiness attempts.
6. Required services ready → application renders.
7. AI is optional and does not block ordinary startup.
8. If services still fail, the UI provides `Retry startup` and `Continue anyway`.

## Keepalive

Once startup is READY, the browser sends wake requests every 10 minutes:

```text
Browser open
    │
    └─ every 10 minutes → service /health requests

Browser closed/unmounted
    │
    └─ interval cleared
```

This intentionally keeps services awake only while a user has the application open rather than running a permanent external cron.

## Vite configuration requirement

If the browser logs:

```text
[WARMUP] URL not configured for auth
```

then the relevant `VITE_*_SERVICE_URL` was missing from the build environment. Adding it after a deployment is not enough; rebuild/redeploy the Vite frontend.

---

# Security Model

## Public vs internal endpoints

The API Gateway explicitly blocks public `/internal` routes.

Internal service calls use:

```text
x-internal-service-token
```

or the service-specific administrator orchestration headers.

## Authentication

Public authenticated requests use:

```text
Authorization: Bearer <JWT>
```

## Administrator authorization

Admin operations require:

- authenticated user;
- email in `ADMIN_EMAILS` at the Gateway;
- Gateway-to-AI `x-admin-orchestration-token`;
- forwarded admin identity headers.

## HTTP hardening

Services use:

- Helmet;
- explicit CORS configuration;
- JSON body-size limits;
- Zod validation;
- internal route middleware;
- execution/input/output size controls in compute services.

---

# Troubleshooting

## `429 Too Many Requests` during hosted cold start

The current source no longer relies on the previous application-wide Express rate limiter for ordinary traffic.

If hosted services return `429` while sleeping:

1. open the warmup UI and inspect per-service readiness;
2. verify direct `VITE_*_SERVICE_URL` values are configured in the frontend build;
3. confirm the host's `/health` URL wakes when accessed directly;
4. inspect Gateway upstream logs;
5. distinguish Gateway responses from downstream service responses;
6. do not assume CORS is the root cause simply because the browser reports it alongside a failed upstream request.

The Gateway logs upstream failures in a form similar to:

```text
[GATEWAY UPSTREAM RESPONSE] {
  service: 'Contest Service',
  upstreamStatus: 429,
  ...
}
```

That means the downstream target returned the status; it was not created by ordinary Gateway route logic.

## Warmup page never proceeds

Verify:

```text
VITE_GATEWAY_URL
VITE_AUTH_SERVICE_URL
VITE_USER_SERVICE_URL
VITE_PROBLEM_SERVICE_URL
VITE_CONTEST_SERVICE_URL
VITE_BOT_SERVICE_URL
VITE_AI_SERVICE_URL
```

Then rebuild the frontend.

Also confirm Gateway `GET /api/v1/system/warmup` returns HTTP `200` with either:

```json
{ "ready": true, "status": "READY" }
```

or:

```json
{ "ready": false, "status": "WARMING" }
```

`WARMING` is an application state and should not be returned as HTTP 503 by the current controller.

## `Route not found: GET /api/v1/testcases/internal/<jobId>/tests`

The current Testcase Service includes this route. If production returns 404:

- redeploy the current Testcase Service;
- verify the deployed image was built from `backend/testcase-service` rather than `backend/judge-service`;
- verify `TESTCASE_SERVICE_URL` points to the actual Testcase Service;
- verify the internal token matches.

## Problem becomes unavailable after admin re-edit

Content editing should not reset create-time defaults. The current Problem Service separates create defaults from PATCH fields so a text-only edit preserves existing `READY` and `deterministic` state.

For records already damaged by an older build, restore the appropriate status/deterministic values once after verifying the stored solution/generator/testcase artifact remains valid.

## Judge compilation timeout

Check:

```text
COMPILE_TIMEOUT_MS
```

and ensure the container has enough CPU/memory for `g++`.

Hosted free/shared compute can compile much more slowly than local development.

## Testcase generation timeout

Check:

```text
COMPILE_TIMEOUT_MS
GENERATOR_TIMEOUT_MS
SOLUTION_TIMEOUT_MS
MAX_TEST_FILES
MAX_INPUT_BYTES_PER_FILE
MAX_TOTAL_BYTES
```

Large generated files can exceed memory, HTTP payload, execution, or object-storage limits.

## Prisma migration errors

Typical causes:

- wrong schema/database URL;
- incremental migration applied to a database missing its base tables;
- stale failed migration state;
- direct vs pooled URL confusion.

Check:

```bash
npx prisma migrate status
```

before modifying production migration history.

## `P1001: Can't reach database server`

Verify PostgreSQL connectivity and `DATABASE_URL`/`DIRECT_URL`.

## CORS errors accompanied by 502/429

A browser CORS warning can be secondary if an edge proxy or upstream service generated an error response without the expected CORS headers. Inspect the actual HTTP status and Gateway upstream logs before changing CORS middleware.

---

# Known Operational Considerations

- The project is a true multi-service system; local operation is simpler because all processes remain awake and communicate over localhost/private Docker networking.
- Free hosting providers may independently sleep each web service, producing chained cold starts.
- Service-to-service calls across public hosting URLs have higher latency and more failure modes than private networking.
- Judge/Testcase workloads are CPU- and memory-sensitive.
- Local runtime directories can grow substantially if cleanup fails or very large testcases are generated.
- R2/object storage should be treated as durable testcase storage in ephemeral hosting environments.
- The synchronous submission path can remain sensitive to long compiler/judge operations; a future queue-based asynchronous judge pipeline would improve resilience.

---

# Future Improvements

Potential next steps for the platform include:

- asynchronous `PENDING → RUNNING → verdict` submission processing;
- a real queue/worker system for judging and testcase generation;
- stronger sandboxing for untrusted code;
- WebSocket/SSE updates instead of contest polling;
- private service networking in production;
- Redis-backed contest/session/cache coordination;
- bot behavior analytics and richer difficulty calibration;
- adaptive bot modeling based on topic strengths and historical performance;
- richer rating algorithms;
- searchable problem catalogue and tag filters;
- admin audit log;
- object-storage lifecycle policies;
- distributed tracing across Gateway and services;
- centralized structured logging/metrics;
- Kubernetes or container orchestration when the deployment scale justifies it.

---

## Development Notes

- Node.js version requirement across backend services: **20+**.
- Frontend uses React 19 and Vite.
- Do not edit files inside `node_modules`.
- Do not commit `.env` files or production credentials.
- Internal route contracts are shared dependencies; when changing an endpoint such as the Testcase `/tests` route, update both provider and caller together.
- When changing Vite environment variables in production, perform a new frontend build.

---

## License

No explicit license file is included in the current repository. Add a `LICENSE` file before distributing the project under a specific open-source license.

---

## Summary

CP Bot is a microservice-based competitive-programming challenge platform built around the idea of competing against rating-based coding bots. It combines a modern React coding workspace, deterministic testcase generation, isolated judging, persistent problem and contest state, AI-assisted administrator tooling, and competitive rating/stat tracking into one platform.

For normal development, the included PowerShell launcher or Docker Compose configuration can start the backend stack locally. For production, configure service URLs, databases, internal tokens, CORS, object storage, AI credentials, and frontend `VITE_*` wakeup URLs according to the deployment environment.
