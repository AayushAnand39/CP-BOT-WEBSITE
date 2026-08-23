const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");
const { env } = require("../src/config/env");
const { cleanup } = require("../src/services/testcase.service");

const generatorCode = `
#include <bits/stdc++.h>
using namespace std;
int main() {
    cout << 5 << "\\n";
    for (int i = 1; i <= 5; ++i) cout << i << (i == 5 ? '\\n' : ' ');
    return 0;
}
`;

const solutionCode = `
#include <bits/stdc++.h>
using namespace std;
int main() {
    int n;
    if (!(cin >> n)) return 0;
    long long sum = 0;
    for (int i = 0; i < n; ++i) {
        int x;
        cin >> x;
        sum += x;
    }
    cout << sum << "\\n";
    return 0;
}
`;

test("GET /health returns service health", async () => {
  const response = await request(app).get("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    success: true,
    service: "testcase-service",
    status: "ok"
  });
});

test("generation requires internal service token", async () => {
  const response = await request(app)
    .post("/api/v1/testcases/internal/generate")
    .send({ generatorCode, solutionCode, testCount: 2 });

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "INVALID_SERVICE_TOKEN");
});

test("generation validates test count", async () => {
  const response = await request(app)
    .post("/api/v1/testcases/internal/generate")
    .set("X-Internal-Service-Token", env.INTERNAL_SERVICE_TOKEN)
    .send({ generatorCode, solutionCode, testCount: 0 });

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "VALIDATION_ERROR");
});

test("generation compiles generator and solution and creates artifacts", async () => {
  const response = await request(app)
    .post("/api/v1/testcases/internal/generate")
    .set("X-Internal-Service-Token", env.INTERNAL_SERVICE_TOKEN)
    .send({ generatorCode, solutionCode, testCount: 3 });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);

  const { jobId, generated, totalBytes } = response.body.data;
  assert.match(jobId, /^[0-9]+-[a-f0-9]+$/);
  assert.equal(generated.length, 3);
  assert.equal(totalBytes > 0, true);
  assert.equal(response.body.data.archiveBytes > 0, true);
  assert.equal(generated[0].inputFile, "input_1.txt");
  assert.equal(generated[0].outputFile, "output_1.txt");

  const archiveResponse = await request(app)
    .get(`/api/v1/testcases/internal/${jobId}/archive`)
    .set("X-Internal-Service-Token", env.INTERNAL_SERVICE_TOKEN);

  assert.equal(archiveResponse.status, 200);
  assert.match(archiveResponse.headers["content-type"], /zip/);

  await cleanup(jobId);
});

test("invalid generator code returns compilation error", async () => {
  const response = await request(app)
    .post("/api/v1/testcases/internal/generate")
    .set("X-Internal-Service-Token", env.INTERNAL_SERVICE_TOKEN)
    .send({
      generatorCode: "this is not valid C++",
      solutionCode,
      testCount: 1
    });

  assert.equal(response.status, 422);
  assert.equal(response.body.code, "GENERATOR_COMPILE_ERROR");
});

test("invalid solution code returns compilation error", async () => {
  const response = await request(app)
    .post("/api/v1/testcases/internal/generate")
    .set("X-Internal-Service-Token", env.INTERNAL_SERVICE_TOKEN)
    .send({
      generatorCode,
      solutionCode: "not valid C++",
      testCount: 1
    });

  assert.equal(response.status, 422);
  assert.equal(response.body.code, "SOLUTION_COMPILE_ERROR");
});

test("archive requires internal service token", async () => {
  const response = await request(app)
    .get("/api/v1/testcases/internal/123-deadbeef/archive");

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "INVALID_SERVICE_TOKEN");
});

test("invalid job id is rejected", async () => {
  const response = await request(app)
    .delete("/api/v1/testcases/internal/not-valid")
    .set("X-Internal-Service-Token", env.INTERNAL_SERVICE_TOKEN);

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_JOB_ID");
});