# CP Bot Platform — Judge Service

Port: `4007`

The Judge Service is the authoritative verdict engine. It is independent of the AI service.

## Current MVP

```text
Submission
  ↓
Compile C++
  ↓
CE
  ↓
Execute on tests
  ├── TLE
  ├── RE
  ├── output-limit
  └── compare output
        ├── WA
        └── AC
```

Endpoint:

```text
GET /health
POST /api/v1/judge/internal/judge
```

Internal authentication:

```text
X-Internal-Service-Token: <token>
```

Request:

```json
{
  "language": "cpp",
  "sourceCode": "#include ...",
  "tests": [
    {
      "input": "2 3",
      "expectedOutput": "5"
    }
  ]
}
```

Current supported language:

```text
cpp
```

Verdicts:

```text
AC WA TLE MLE RE CE
```

`MLE` is represented by the configured output limit in this MVP; real memory accounting will be added with the hardened sandbox.

## Integration direction

The Testcase Service currently creates input/output artifacts. The final platform should store those artifacts in permanent object storage and have Judge Service fetch a testcase-set by ID instead of sending large testcases in HTTP.

```text
Problem / Testcase Service
          ↓
      TestcaseSet
          ↓
       S3 / R2
          ↓
     Judge Service
```

## Security

This MVP has source-size, input/output-size, compilation-time and execution-time limits, but it is NOT a complete production sandbox.

Before running arbitrary untrusted submissions in production, add:

- isolated container/worker
- network disabled
- CPU quota
- real memory limit
- PID/process limit
- restricted filesystem
- non-root user
- syscall filtering
- cleanup
- resource accounting

Docker alone is not sufficient as the final sandbox boundary.

## Setup

Local machine needs Node.js and g++:

```powershell
node --version
g++ --version
```

Then:

```powershell
npm install
npm test
npm run dev
```

Service URL:

```text
http://localhost:4007
```

The judge remains authoritative:

```text
Judge -> verdict
AI    -> explanation
```
