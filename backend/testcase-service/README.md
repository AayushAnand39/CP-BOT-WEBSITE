# CP Bot Platform — Testcase Service

Port: `4006`

This service reproduces the earlier Random Testcase Generator pipeline:

```text
Generator Code
      ↓
Compile Generator
      ↓
Run Generator
      ↓
input_1.txt ... input_N.txt
      ↓
Compile Reference Solution
      ↓
Run Reference Solution on each input
      ↓
output_1.txt ... output_N.txt
```

## API

```text
GET  /health

POST /api/v1/testcases/internal/generate
GET  /api/v1/testcases/internal/:jobId/archive
DELETE /api/v1/testcases/internal/:jobId
```

Internal endpoints require:

```text
X-Internal-Service-Token: <token>
```

Request:

```json
{
  "generatorCode": "...",
  "solutionCode": "...",
  "testCount": 5
}
```

Response:

```json
{
  "success": true,
  "data": {
    "jobId": "...",
    "generated": [
      {
        "testNumber": 1,
        "inputFile": "input_1.txt",
        "outputFile": "output_1.txt",
        "inputBytes": 20,
        "outputBytes": 3
      }
    ],
    "totalBytes": 23
  }
}
```

## Configuration

The implementation uses:

```text
g++
C++20
-O2
child_process.spawn
compile timeout
generator timeout
solution timeout
per-file output limit
total artifact limit
```

It intentionally does not add nondeterminism itself. If the generator is deterministic, the same generator execution produces the same testcase.

## Important security limitation

This service executes C++ code. Timeout and file-size limits are included, but this is NOT a complete production sandbox.

Before allowing arbitrary user-supplied code to execute, add:

- isolated containers or a dedicated sandbox runtime
- no network
- CPU limit
- memory limit
- PID/process limit
- restricted filesystem
- non-root execution
- syscall filtering
- cleanup after every execution

The Judge Service must use the same hardened execution model.

## Setup

The local host needs Node.js and g++:

```powershell
node --version
g++ --version
```

Install:

```powershell
npm install
```

Run:

```powershell
npm run dev
```

Test:

```powershell
npm test
```

Docker builds an Ubuntu image with Node.js and g++.

## Architecture

```text
Problem Service :4003
       |
       | generatorCode + solutionCode
       v
Testcase Service :4006
       |
       +--> compile generator
       +--> generate inputs
       +--> compile reference solution
       +--> generate expected outputs
       |
       v
Judge / Contest infrastructure
```

The service generates expected outputs, but it does not judge user submissions.


## ZIP artifact

After generation the service creates `testcases.zip` containing:

```text
input_1.txt
output_1.txt
input_2.txt
output_2.txt
...
```

Download it with:

```text
GET /api/v1/testcases/internal/:jobId/archive
```

Remove the generated working directory after consumption:

```text
DELETE /api/v1/testcases/internal/:jobId
```
