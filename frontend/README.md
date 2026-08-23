# CP Bot Platform Frontend

Vite + React frontend for the CP Bot Platform.

## Current flow

```text
Register / Login
      ↓
Bot selection
      ↓
Create bot challenge
      ↓
Contest page
      ↓
Code submission + live standings
      ↓
Automatic contest completion
      ↓
Result + rating delta
```

## Environment

```env
VITE_API_URL=http://localhost:4000
```

The frontend talks only to the API Gateway.

## Install

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

## Main routes

```text
/
 /login
 /register
 /bots
 /challenge/:challengeId
 /contest/:contestId
 /result/:challengeId
 /profile
```

## Important current limitation

Contest Service currently returns contest problem references (`problemId`, rating, ordinal), not complete problem statements.

The contest UI shell is complete, but statement hydration should be added next by fetching each selected problem through:

```text
GET /api/v1/problems/:problemId
```

Also verify the exact Contest submission contract against the current backend. The UI currently sends:

```json
{
  "problemId": "...",
  "language": "cpp",
  "sourceCode": "..."
}
```

If the existing Contest Service still requires inline `tests`, update the backend toward the intended TestcaseSet/Judge flow rather than pushing testcases into the browser.
