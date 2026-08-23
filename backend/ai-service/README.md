# AI Service — Admin Codeforces Problem Import

This is button-triggered only. There is no cron, polling job, or scheduled ingestion.

Admin flow:

```text
2167A
 ↓
Codeforces metadata
 ↓
problem page scraping
 ↓
accepted C++ submissions
 ↓
highest-rated available author
 ↓
public accepted source scraping
 ↓
sample validation through Judge Service
 ↓
Groq generator creation
 ↓
Testcase Service generation
 ↓
Problem Service internal create
 ↓
READY
```

The Codeforces API is deliberately rate-spaced at >= 2100 ms between API calls.

## Endpoint

Internal admin endpoint:

```http
POST /api/v1/ai/admin/problems/import
X-Admin-Orchestration-Token: ...
X-Admin-User-Email: ...
```

Body:

```json
{
  "problemCode": "2167A",
  "testCount": 5
}
```

This endpoint is intended to be called only by the API Gateway's authenticated admin route.
