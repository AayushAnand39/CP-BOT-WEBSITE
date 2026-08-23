# CP Bot Platform — Project Context

> **Purpose:** Persistent context for the CP Bot Platform.
> Use this file as the authoritative project context when starting a new ChatGPT conversation.
> Preserve existing architectural decisions and implementation unless a concrete technical reason requires change.

---

# 1. Project Overview

## Project Name

**CP Bot Platform**

## Vision

Build a competitive-programming platform inspired by the interaction model of platforms such as Chess.com.

The platform should allow users to:

* Solve competitive-programming problems.
* Challenge programming bots.
* Select a contest/difficulty level.
* Participate in generated contests.
* Receive deterministic problem sets and testcases.
* Compete against bots whose performance resembles a particular competitive-programming rating.
* Receive ratings based on performance.
* Eventually participate in scheduled contests and compete against other users and bots.
* Use AI-assisted learning, debugging, recommendations, and problem discovery.

The core differentiator is a **bot-based competitive-programming experience combined with an intelligent learning layer**.

---

# 2. Core Product Requirements

## User functionality

* Registration
* Login/authentication
* User profile
* Competitive-programming rating
* Submission history
* Contest history
* Problem-solving history
* Bot challenge history
* Personal statistics
* Skill profile
* Recommended problems

## Problem functionality

* Problem catalogue
* Codeforces-based problems
* Problem metadata
* Difficulty/rating
* Tags
* Constraints
* Problem statements
* Editorial/reference solutions
* Generator code
* Deterministic/non-deterministic classification
* Problem curation

## Contest functionality

* Generate contests automatically
* Select problems based on contest difficulty
* Generate deterministic contest instances
* Prevent duplicates/incompatible selections
* Schedule contests
* Start/end contests
* Track participants
* Track submissions
* Calculate standings
* Calculate performance rating

## Bot functionality

Users should be able to:

1. Select a bot.
2. Challenge the bot.
3. Select a difficulty/contest level.
4. Receive a generated contest/problem set.
5. Solve problems.
6. Compete against the bot's simulated performance.

Bots should have target ratings such as:

```text
1200
1400
1600
1800
2000
2200
```

Bot performance should statistically resemble the target rating.

## AI functionality

AI should improve the CP experience through:

* Problem hints/explanations
* Submission analysis
* Similar-problem discovery
* Personalized problem recommendations
* Skill estimation
* Eventually ML-based bot performance modelling

AI must **not** make the deterministic judging or contest-generation pipeline nondeterministic.

---

# 3. Critical Requirement: Determinism

The following must remain deterministic:

* Contest generation
* Problem selection
* Testcase generation
* Reference-solution execution
* Bot simulation when a seed is supplied
* Rating calculations

The same:

```text
configuration + seed + problem set
```

must produce the same result.

LLMs must not be placed in the critical runtime path of:

```text
contest generation
testcase generation
judging
rating calculation
```

LLMs/ML may assist around the core system.

---

# 4. High-Level Architecture

The project uses a **microservices architecture**.

The preferred approach is a **single monorepo** rather than one repository per service.

Frontend and backend services live in the same repository.

---

# 5. Repository Structure

```text
cp-bot-platform/
│
├── frontend/
│   └── web/
│
├── backend/
│   │
│   ├── api-gateway/
│   │
│   ├── auth-service/
│   ├── user-service/
│   ├── problem-service/
│   ├── contest-service/
│   ├── bot-service/
│   ├── testcase-service/
│   ├── judge-service/
│   │
│   └── ai-service/
│
├── infrastructure/
│   ├── docker/
│   ├── nginx/
│   └── scripts/
│
├── docs/
│
├── docker-compose.yml
├── PROJECT_CONTEXT.md
├── README.md
└── .gitignore
```

### Future extraction

A separate `recommendation-service` or `ml-service` may be introduced later if the ML workload becomes substantial.

Initially, recommendation and ML logic should remain inside `ai-service` or the most appropriate existing domain service.

Do not create services merely for architectural aesthetics.

---

# 6. Frontend

## Technology

```text
React
Vite
```

The frontend communicates only with the API Gateway.

It should not directly communicate with internal microservices.

```text
React Frontend
      |
      v
API Gateway
      |
      +----> Auth Service
      +----> User Service
      +----> Problem Service
      +----> Contest Service
      +----> Bot Service
      +----> Testcase Service
      +----> Judge Service
      +----> AI Service
```

---

# 7. Backend Technology

Planned backend stack:

* Node.js
* Express.js
* REST APIs
* PostgreSQL
* Prisma
* Redis
* Docker

AI layer may additionally use:

* LLM provider
* embeddings
* pgvector
* LangChain
* LangGraph

These are AI-layer technologies, not requirements for every backend service.

---

# 8. Service List

| Service          | Port | Responsibility                   |
| ---------------- | ---: | -------------------------------- |
| API Gateway      | 4000 | Public entry point               |
| Auth Service     | 4001 | Authentication                   |
| User Service     | 4002 | User profile and statistics      |
| Problem Service  | 4003 | Problem metadata/catalogue       |
| Contest Service  | 4004 | Contest creation/management      |
| Bot Service      | 4005 | Bot configuration/performance    |
| Testcase Service | 4006 | Testcase generation              |
| Judge Service    | 4007 | Compilation/execution/judging    |
| AI Service       | 4008 | AI/RAG/ML-assisted functionality |

Ports are implementation defaults and can be changed consistently if necessary.

---

# 9. API Gateway

## Port

```text
4000
```

Frontend communicates only with the gateway.

Responsibilities:

* Request routing
* Authentication propagation
* Validation at public boundaries
* Rate limiting
* Logging
* Correlation/request IDs

The gateway must not contain domain business logic.

Example:

```text
GET /api/v1/problems/:id
        |
        v
Problem Service :4003
```

```text
POST /api/v1/ai/explain
        |
        v
AI Service :4008
```

---

# 10. Authentication Service

## Port

```text
4001
```

Responsibilities:

* Registration
* Login
* Password hashing
* Token generation
* Token validation

Authentication answers:

> Who is this user?

User Service answers:

> What data belongs to this user?

---

# 11. User Service

## Port

```text
4002
```

Responsibilities:

* User profile
* Username
* Competitive-programming rating
* Statistics
* Contest history
* Problem-solving statistics
* User preferences
* AI-related user activity metadata where appropriate

### Current status

The User Service has already been started/implemented.

When continuing development:

* Inspect existing implementation first.
* Preserve existing API contracts unless change is necessary.
* Do not redesign the service unnecessarily.

---

# 12. Problem Service

## Port

```text
4003
```

The Problem Service is the source of truth for problem metadata.

Example metadata:

```text
contestId
index
title
rating
tags
statement
constraints
timeLimit
memoryLimit
deterministic
enabled
solutionCode
generatorCode
```

Potential additional metadata:

```text
concepts
difficultyConfidence
editorial
searchEmbedding
```

AI-derived metadata should be generated offline or asynchronously and stored in a controlled way.

### Current status

The Problem Service has already been started/implemented.

When continuing development:

1. Inspect the existing implementation.
2. Preserve its API/schema when possible.
3. Build subsequent services around its existing contract.

---

# 13. Codeforces Problem Ingestion

Codeforces may be used as a source of problem content and metadata.

Preferred model:

```text
Codeforces
    |
    v
Ingestion / Curation
    |
    v
Problem Service
    |
    v
Local PostgreSQL
```

Runtime contest generation should not depend directly on Codeforces availability.

---

# 14. Deterministic Problem Eligibility

A problem must be marked as eligible before entering automatic contest generation.

Potential criteria:

```text
generator exists
solution exists
generator compiles
solution compiles
generated input is valid
reference solution succeeds
execution limits are known
```

Example:

```text
deterministic = true
```

Only valid problems should enter automatic contest generation.

---

# 15. Testcase Service

## Port

```text
4006
```

Responsibilities:

* Compile generator code
* Execute generator
* Generate input files
* Compile reference solution
* Execute reference solution
* Produce expected output
* Validate generated testcase
* Package/store testcase artifacts as needed

The existing Random Testcase Generator project should be adapted into this service.

---

# 16. Existing Random Testcase Generator

Existing project pipeline:

```text
Generator Code
      |
      v
Compile Generator
      |
      v
Run Generator
      |
      v
Input Files
      |
      v
Compile Reference Solution
      |
      v
Run Solution
      |
      v
Output Files
```

The existing implementation uses concepts including:

```text
g++
C++20
-O2
Node.js child_process
timeouts
generated files
archiving
```

It should be integrated rather than rewritten unnecessarily.

---

# 17. Judge Service

## Port

```text
4007
```

Responsibilities:

* Receive submissions
* Compile submitted code
* Execute against testcases
* Enforce time limits
* Enforce memory limits
* Capture stdout/stderr
* Detect compilation errors
* Detect runtime errors
* Detect timeout
* Compare output
* Return verdict

Possible verdicts:

```text
AC
WA
TLE
MLE
RE
CE
```

The Judge Service is security-sensitive.

Untrusted code must never run directly with unrestricted host access.

---

# 18. Contest Service

## Port

```text
4004
```

Responsibilities:

* Contest creation
* Contest configuration
* Problem selection
* Contest scheduling
* Contest start/end
* Participant management
* Standings
* Contest submissions
* Contest results
* Performance calculation

Example contest input:

```json
{
  "difficulty": "medium",
  "problemCount": 5,
  "seed": 123456,
  "duration": 7200
}
```

The same seed/configuration must result in the same contest.

---

# 19. Contest Generation

Pipeline:

```text
Contest Configuration
        |
        v
Determine rating range
        |
        v
Query eligible problems
        |
        v
Filter duplicates/unavailable problems
        |
        v
Deterministic seeded shuffle
        |
        v
Select problems
        |
        v
Create contest
```

Contest generation must not depend on an LLM.

---

# 20. Bot Service

## Port

```text
4005
```

Responsibilities:

* Bot definitions
* Bot rating
* Bot configuration
* Bot simulation
* Bot contest performance
* Historical bot results

Example:

```text
Bot A -> 1200
Bot B -> 1500
Bot C -> 1800
Bot D -> 2100
```

---

# 21. Bot Performance Model

Initial implementation may use a deterministic mathematical model.

Input:

```text
botRating
problemRating
problemTags
contestState
seed
```

Output:

```text
solve probability
wrong-answer probability
expected solve time
```

Example:

```text
Bot Rating = 1800

Problem A:
P(solve) = 0.94
Expected time = 11 min

Problem B:
P(solve) = 0.63
Expected time = 24 min
```

The exact formula is not fixed yet.

---

# 22. ML-Based Bot Improvement

This is an intended future enhancement because it directly improves the core bot concept.

Historical competitive-programming data can be used to train a model that predicts:

```text
P(user solves problem)
Expected solve time
P(WA)
Expected number of attempts
```

Potential model inputs:

```text
user rating
problem rating
problem tags
contest context
historical solve rate
attempt count
time
```

This can eventually replace or augment the handcrafted bot model.

Important:

> ML inference must be deterministic/reproducible when a seed is supplied to the bot simulation.

---

# 23. Rating System

The platform should eventually implement a competitive rating system.

Inputs may include:

* User performance
* Opponent/bot rating
* Relative performance
* Contest difficulty
* Expected performance

Initial implementation can use a simple deterministic Elo-like model.

The exact formula is intentionally not finalized.

---

# 24. Challenge Flow

```text
User
 |
 v
Select Bot
 |
 v
Select Difficulty
 |
 v
Challenge Bot
 |
 v
Contest Service
 |
 v
Generate deterministic contest
 |
 +----------------+
 |                |
 v                v
User             Bot
 |                |
 v                v
Solve            Simulate
 |
 v
Judge Service
 |
 v
Results
 |
 v
Compare
 |
 v
Rating Update
```

---

# 25. Submission Flow

```text
Frontend
   |
   v
API Gateway
   |
   v
Submission
   |
   v
Judge Service
   |
   +----> Testcase Service
   |
   v
Compilation
   |
   v
Execution
   |
   v
Verdict
```

For background judging:

```text
Submission
    |
    v
Redis Queue
    |
    v
Judge Worker
    |
    v
Result
```

---

# 26. Redis

Redis may be used for:

* Submission queues
* Judge jobs
* Testcase-generation jobs
* Contest-generation jobs
* Bot simulation jobs
* Caching
* Rate limiting
* AI background jobs

Do not introduce queues where synchronous processing is sufficient.

---

# 27. Database

Primary database:

```text
PostgreSQL
```

ORM:

```text
Prisma
```

Potential logical schemas:

```text
user_service
problem_service
contest_service
bot_service
```

The AI layer may use:

```text
pgvector
```

within PostgreSQL for embeddings.

---

# 28. Database Ownership Principle

Each service owns its domain data.

Example:

```text
User Service
 -> users
 -> user statistics

Problem Service
 -> problems
 -> problem metadata

Contest Service
 -> contests
 -> participants
 -> standings

Bot Service
 -> bots
 -> bot configurations

AI Service
 -> AI interaction metadata
 -> embedding/index metadata
 -> recommendation model metadata
```

Services must not directly modify another service's tables.

---

# 29. AI Service

## Port

```text
4008
```

The AI Service is an **additional capability layer** for the CP platform.

It must not replace:

* Judge Service
* Contest Service
* Problem Service
* Bot Service

Its job is to provide intelligent assistance around the deterministic core.

---

# 30. AI Service Responsibilities

Initial responsibilities:

* Problem hints
* Problem explanations
* Editorial assistance
* Submission analysis
* Similar-problem search
* Personalized recommendations
* Skill estimation

Potential future responsibility:

* ML-based bot performance prediction

---

# 31. RAG Architecture

RAG is strongly relevant to this project.

Knowledge sources may include:

```text
Problem statements
Editorials
Algorithm explanations
Data-structure explanations
Curated notes
Common mistakes
Similar problems
```

Architecture:

```text
Problem / Editorial Data
        |
        v
Chunking
        |
        v
Embedding Model
        |
        v
pgvector
        |
        v
Retriever
        |
        v
LLM
        |
        v
AI Response
```

Since PostgreSQL is already being used, **pgvector is the preferred initial vector-storage option** rather than introducing another database immediately.

---

# 32. AI Problem Coach

Example user interaction:

> "Give me a hint."

Possible progression:

```text
No hint
   ↓
Concept hint
   ↓
Observation
   ↓
Approach
   ↓
Detailed explanation
```

The user should be able to control how much help is revealed.

The system should avoid immediately exposing the complete solution when the user only requested a hint.

---

# 33. AI Submission Analyzer

After the Judge produces:

```text
WA
TLE
RE
```

the AI layer can analyze:

```text
Problem
+
User Code
+
Judge Result
+
Relevant testcase information
+
Retrieved concepts/editorial
```

Example output:

```text
Your solution appears to be O(N²), while N can reach 2e5.

The nested loop is the likely bottleneck.

Hint:
You are repeatedly computing information that can be maintained incrementally.

Relevant concepts:
Prefix Sum / Fenwick Tree
```

Important:

> The Judge remains the authority for correctness. The AI only explains the result.

---

# 34. Similar Problem Search

Allow queries such as:

> "Find problems similar to this one."

The system can use:

```text
embeddings
+
problem metadata filters
+
rating range
+
tags
```

to retrieve related problems.

Example:

```text
Current Problem
      |
      v
Embedding
      |
      v
Vector Search
      +
Metadata Filters
      |
      v
Similar Problems
```

---

# 35. Natural-Language Problem Search

Users should eventually be able to search using natural language.

Example:

> "Give me a 1600-rated graph problem involving shortest paths but not Dijkstra."

The AI layer converts this into semantic and metadata constraints:

```text
rating ≈ 1600
tags contains graph
concept = shortest path
exclude = dijkstra
```

Then Problem Service performs the final structured filtering.

---

# 36. Personalized Problem Recommendation

Recommendations can use:

```text
user rating
solved problems
failed attempts
tags
solve time
contest performance
recent activity
skill estimates
```

Initial implementation can be rule-based.

Later it can become an ML recommendation system.

Potential progression:

```text
Rule-based
    ↓
Content-based recommendation
    ↓
Hybrid recommendation
    ↓
ML model
```

---

# 37. User Skill Profile

The platform can estimate skills such as:

```text
Graphs
Trees
DP
Greedy
Number Theory
Strings
Geometry
Flow
Binary Search
Data Structures
```

Example:

```text
Graphs        82%
Trees         76%
DP            54%
Strings       73%
Geometry      31%
Flow          22%
```

Skill estimates should be derived from actual user behaviour rather than simply user declarations.

Potential signals:

* Problem tags
* Problem ratings
* AC/WA rate
* Attempts
* Solve time
* Contest performance
* Difficulty progression

---

# 38. Recommendation and Skill ML

A future ML model can estimate:

```text
P(user solves problem)
```

given:

```text
user features
+
problem features
```

This can support:

* Problem recommendations
* Difficulty calibration
* Personalized practice
* Skill estimation
* Adaptive challenge generation

This is a genuine ML component and should be preferred over forcing an LLM into the recommendation problem.

---

# 39. LangChain

LangChain is optional and belongs inside `ai-service`.

Potential uses:

* Prompt templates
* Retrieval pipelines
* Structured outputs
* Tool calling
* LLM integration
* RAG pipelines

LangChain should not be used in:

```text
Judge Service
Contest generation
Testcase generation
Core rating engine
```

unless there is a concrete requirement.

---

# 40. LangGraph

LangGraph is appropriate for multi-step/stateful AI workflows.

Potential future feature:

## AI Competitive Programming Coach

Example workflow:

```text
User asks question
       |
       v
Analyze problem/user state
       |
       v
Retrieve relevant knowledge
       |
       v
Generate hint
       |
       v
Wait for user response
       |
       v
Evaluate understanding
       |
       +----> More help required
       |
       v
Next hint / explanation
```

LangGraph should be introduced only when this stateful workflow is actually needed.

Do not create a LangGraph service simply because the project uses AI.

---

# 41. AI Editorial Generation

For imported problems, an offline AI pipeline may generate:

```text
Observation
Approach
Proof idea
Complexity
Implementation explanation
Common mistakes
```

Recommended flow:

```text
Problem Ingestion
      |
      v
AI Editorial Generation
      |
      v
Validation / Review
      |
      v
Stored Editorial
      |
      v
RAG Knowledge Base
```

This should not happen dynamically every time a user opens a problem.

---

# 42. AI Architecture Principle

The architecture should remain:

```text
                    ┌───────────────────┐
                    │ React Frontend    │
                    └─────────┬─────────┘
                              │
                              v
                    ┌───────────────────┐
                    │   API Gateway     │
                    └─────────┬─────────┘
                              │
       ┌──────────────────────┼─────────────────────────┐
       │                      │                         │
       v                      v                         v
 Core Services           AI Service              Search/DB
       │                      │                         │
       │                      ├── RAG                    │
       │                      ├── LLM                    │
       │                      ├── Recommendations       │
       │                      └── ML models              │
       │                                                │
       v                                                v
 Postgres + Redis                              PostgreSQL/pgvector
```

The AI layer is **loosely coupled** to the core platform.

---

# 43. AI Must Not Control the Judge

This rule is critical.

Incorrect:

```text
Submission
   ↓
LLM
   ↓
AC/WA
```

Correct:

```text
Submission
   ↓
Judge
   ↓
AC/WA
   ↓
AI explanation
```

The same principle applies to contest generation.

---

# 44. AI Must Not Make Contest Generation Nondeterministic

Incorrect:

```text
Contest request
   ↓
LLM picks problems
```

Correct:

```text
Contest configuration + seed
   ↓
Deterministic selection
   ↓
Contest
```

AI may help offline with metadata/classification, but the runtime selection algorithm remains deterministic.

---

# 45. Security Requirements

Particularly important because the platform executes arbitrary C++.

The Judge/Testcase infrastructure should eventually include:

* Container isolation
* CPU limits
* Memory limits
* Execution timeout
* Process limits
* Filesystem restrictions
* Network restrictions
* Restricted permissions
* Cleanup
* Protection against fork bombs
* Protection against malicious filesystem operations

AI service must also avoid leaking:

* Secrets
* Internal prompts
* Private user data
* Hidden testcases
* Reference solutions where not appropriate

---

# 46. API Design

Public APIs should be versioned:

```text
/api/v1/...
```

Examples:

```text
GET    /api/v1/problems
GET    /api/v1/problems/:id

POST   /api/v1/submissions

GET    /api/v1/contests/:id
POST   /api/v1/contests

GET    /api/v1/bots
POST   /api/v1/challenges

POST   /api/v1/ai/hint
POST   /api/v1/ai/explain
POST   /api/v1/ai/analyze-submission
GET    /api/v1/ai/similar-problems
GET    /api/v1/recommendations
```

Exact endpoint design can evolve as services are implemented.

---

# 47. Error Handling

Consistent error format:

```json
{
  "success": false,
  "message": "Problem not found",
  "code": "PROBLEM_NOT_FOUND"
}
```

Internal errors should be logged without exposing stack traces.

AI-specific failures should degrade gracefully.

For example, if the AI provider is unavailable:

```text
Judge → still works
Contest → still works
Problem practice → still works
AI explanation → unavailable
```

The AI service should therefore not be a single point of failure for the platform.

---

# 48. Logging

Use structured logs containing:

```text
timestamp
service
level
requestId
message
```

Propagate correlation IDs across services.

Example:

```text
Frontend
  requestId=abc123
       |
       v
Gateway
  requestId=abc123
       |
       v
Contest Service
  requestId=abc123
       |
       v
Problem Service
  requestId=abc123
```

---

# 49. Testing Strategy

Each service should have:

## Unit tests

For:

* Business logic
* Utilities
* Validation
* ML scoring where applicable

## Integration tests

For:

* APIs
* Database
* Service dependencies

## End-to-end tests

At minimum:

```text
Register
 -> Login
 -> Start bot challenge
 -> Generate contest
 -> Submit solution
 -> Judge
 -> Bot simulation
 -> Compare result
 -> Update rating
```

AI tests should include:

* Retrieval quality
* Structured output validity
* Prompt regression tests
* Hallucination checks where practical
* Recommendation relevance

The deterministic core must never rely on an LLM response for correctness.

---

# 50. Docker

Use Docker Compose for local development.

Potential services:

```text
frontend
api-gateway
auth-service
user-service
problem-service
contest-service
bot-service
testcase-service
judge-service
ai-service
postgres
redis
```

---

# 51. Configuration

Use environment variables.

Example:

```env
PORT=4008
DATABASE_URL=...
REDIS_URL=...
JWT_SECRET=...
LLM_API_KEY=...
EMBEDDING_MODEL=...
VECTOR_DATABASE_URL=...
```

Never hard-code credentials.

---

# 52. MVP

The first working MVP should focus on the deterministic core:

### Authentication

* Register
* Login

### Problems

* Browse
* View
* Submit

### Judging

* Compile
* Execute
* Verdict

### Bot Challenge

* Select bot
* Select difficulty
* Generate deterministic contest
* Solve
* Simulate bot
* Compare performance

### Rating

* Basic deterministic rating update

### AI MVP

Only after the core flow works, add:

* Problem hints
* Problem explanation
* Submission analysis
* Similar-problem search

Do not block the core product on AI availability.

---

# 53. Future AI/ML Roadmap

The preferred progression is:

## Phase 1 — RAG

```text
Problem + Editorial Knowledge Base
            ↓
Embeddings
            ↓
pgvector
            ↓
AI Problem Tutor
```

Features:

* Explain
* Hint
* Similar problem
* Concept explanation

## Phase 2 — Submission Intelligence

```text
Problem
+
User Code
+
Judge Result
+
Relevant Knowledge
        ↓
AI Analyzer
```

Features:

* WA explanation
* TLE explanation
* Complexity analysis
* Debugging hints

## Phase 3 — Recommendation ML

```text
User Activity
      ↓
Feature Engineering
      ↓
ML Model
      ↓
Skill Profile
      ↓
Recommendations
```

## Phase 4 — ML Bot

```text
Historical CP Data
      ↓
Performance Model
      ↓
Solve Probability / Time Model
      ↓
Bot Service
```

## Phase 5 — Intelligent Coach

Introduce LangGraph if a stateful multi-step AI tutor is justified.

---

# 54. Development Order

Recommended overall order:

```text
1. Repository / infrastructure
2. Auth Service
3. User Service
4. Problem Service
5. Testcase Service
6. Judge Service
7. Contest Service
8. Bot Service
9. API Gateway integration
10. Frontend
11. Basic rating system
12. AI Service foundation
13. RAG Problem Coach
14. Submission Analyzer
15. Recommendation system
16. ML-based bot improvements
17. Stateful AI Coach / LangGraph
```

The exact order may change when implementation dependencies require it.

---

# 55. Current Development Status

Currently:

### User Service

Implemented/started.

### Problem Service

Implemented/started.

### Existing Random Testcase Generator

Already exists as a separate project/component and should be integrated into `testcase-service`.

### AI

Architecture has now been planned, but the AI layer should be implemented only after the deterministic core is stable enough to support it.

---

# 56. Immediate Development Direction

Current dependency chain:

```text
Problem Service
      |
      v
Testcase Service
      |
      v
Judge Service
      |
      v
Contest Service
      |
      v
Bot Service
      |
      v
Frontend integration
      |
      v
AI Service
```

The AI service should not delay implementation of the core bot platform.

---

# 57. Folder Structure for AI Service

Initial design:

```text
backend/ai-service/
│
├── src/
│   ├── controllers/
│   │   ├── hint.controller.js
│   │   ├── explanation.controller.js
│   │   ├── analysis.controller.js
│   │   └── recommendation.controller.js
│   │
│   ├── services/
│   │   ├── llm.service.js
│   │   ├── embedding.service.js
│   │   ├── rag.service.js
│   │   ├── analysis.service.js
│   │   └── recommendation.service.js
│   │
│   ├── prompts/
│   │   ├── hint.prompt.js
│   │   ├── explanation.prompt.js
│   │   └── analysis.prompt.js
│   │
│   ├── routes/
│   │   └── ai.routes.js
│   │
│   ├── middleware/
│   │   └── error.middleware.js
│   │
│   ├── utils/
│   │
│   └── app.js
│
├── prisma/
├── tests/
├── Dockerfile
├── package.json
└── .env
```

This is a starting point, not a rigid requirement.

---

# 58. LangChain/LangGraph Placement

Do not create:

```text
langchain-service
langgraph-service
```

as separate microservices.

Instead:

```text
AI Service
   |
   ├── LangChain
   ├── LangGraph
   ├── RAG
   ├── LLM
   └── ML inference
```

They are implementation tools within the AI layer.

---

# 59. Important Architecture Rules

### Rule 1 — Deterministic core

Contest, testcase, judge, and rating systems remain deterministic.

### Rule 2 — AI is an enhancement

The platform must remain useful even if the AI service is unavailable.

### Rule 3 — Judge is authoritative

AI cannot decide AC/WA.

### Rule 4 — No direct cross-database manipulation

Services communicate through APIs/events.

### Rule 5 — Frontend communicates with Gateway

Never expose internal services directly to the browser unless there is a clear architectural reason.

### Rule 6 — Inspect existing code first

Do not redesign User/Problem Service without inspecting the current implementation.

### Rule 7 — Build incrementally

Complete and test one service before moving to the next.

### Rule 8 — Don't over-engineer

Use the simplest architecture that satisfies the current feature.

### Rule 9 — Explain new infrastructure

When introducing Redis, Docker, pgvector, workers, RAG, LangChain, LangGraph, or ML, explain what it does and why it is being introduced.

### Rule 10 — Keep AI outputs controlled

Prefer structured responses, retrieval-grounded answers, and explicit output schemas rather than unrestricted generation.

---

# 60. Suggested AI User Experience

Problem page:

```text
┌────────────────────────────────────┐
│ Problem A                          │
│ Rating: 1600                       │
│ Tags: DP, Graph                    │
│                                    │
│ [Submit Code]                      │
│                                    │
│ AI Assistant                       │
│                                    │
│ [Give Hint]                        │
│ [Explain Concept]                  │
│ [Explain My WA]                    │
│ [Find Similar Problems]            │
└────────────────────────────────────┘
```

The AI should assist the user without replacing the actual problem-solving experience.

---

# 61. Overall Architecture

```text
                             ┌───────────────────┐
                             │   React + Vite    │
                             │     Frontend      │
                             └─────────┬─────────┘
                                       │
                                       ▼
                             ┌───────────────────┐
                             │    API Gateway    │
                             │      :4000        │
                             └─────────┬─────────┘
                                       │
        ┌───────────────┬──────────────┼───────────────┬───────────────┐
        │               │              │               │               │
        ▼               ▼              ▼               ▼               ▼
   Auth :4001      User :4002    Problem :4003   Contest :4004    AI :4008
                                                       │               │
                                                       │               ├── LLM
                                                       │               ├── RAG
                                                       │               ├── pgvector
                                                       │               └── ML
                                                       │
                              ┌────────────────────────┼──────────────────┐
                              │                        │                  │
                              ▼                        ▼                  ▼
                        Bot :4005               Testcase :4006      Judge :4007
                              │                        │                  │
                              │                        │                  ▼
                              │                        │             Sandboxed
                              │                        │             C++ execution
                              │                        │
                              └────────────────────────┘

                    ┌────────────────────────────────────┐
                    │             PostgreSQL              │
                    │                                    │
                    │ user_service                       │
                    │ problem_service                    │
                    │ contest_service                    │
                    │ bot_service                        │
                    │ AI metadata / pgvector             │
                    └────────────────────────────────────┘

                    ┌────────────────────────────────────┐
                    │                Redis                │
                    │ queues / jobs / cache / rate limit │
                    └────────────────────────────────────┘
```

---

# 62. Final Project Principle

The CP Bot Platform should ultimately combine:

```text
Competitive Programming
        +
Microservices
        +
Distributed Judging
        +
Deterministic Contest Generation
        +
Rating-based Bot Simulation
        +
RAG / NLP
        +
Machine Learning
```

The central architectural principle is:

> **AI should make the CP platform smarter, while the deterministic competition engine makes it trustworthy.**

The core contest/judge/bot system should work independently. AI should enhance the experience through tutoring, debugging, personalization, semantic search, and eventually learned bot behaviour.
