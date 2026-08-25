const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { env } = require("../config/env");
const { ensureDir, removeDir } = require("./file.service");
function makeJobId() {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}
function runProcess(
  command,
  args,
  { cwd, timeoutMs, input = "", maxOutputBytes },
) {
  return new Promise((resolve) => {
    let stdout = "",
      stderr = "",
      settled = false,
      timedOut = false,
      outputLimitExceeded = false;
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const finish = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const kill = () => {
      try {
        child.kill("SIGKILL");
      } catch {}
    };
    child.stdout.on("data", (chunk) => {
      const next = stdout + chunk.toString();
      if (Buffer.byteLength(next) > maxOutputBytes) {
        outputLimitExceeded = true;
        stdout = next.slice(0, maxOutputBytes);
        kill();
      } else stdout = next;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk
        .toString()
        .slice(0, Math.max(0, 64 * 1024 - stderr.length));
    });
    child.on("error", (error) =>
      finish({
        ok: false,
        timedOut,
        outputLimitExceeded,
        spawnError: error.message,
        stdout,
        stderr,
      }),
    );
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      finish({
        ok: code === 0 && !timedOut && !outputLimitExceeded,
        timedOut,
        outputLimitExceeded,
        code,
        signal,
        stdout,
        stderr,
      });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
async function compileCpp(sourcePath, exe, cwd) {
  return runProcess(
    "g++",
    [sourcePath, "-std=gnu++20", "-O2", "-pipe", "-DONLINE_JUDGE", "-o", exe],
    { cwd, timeoutMs: env.COMPILE_TIMEOUT_MS, maxOutputBytes: 64 * 1024 },
  );
}
function normalizeOutput(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((x) => x.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trimEnd();
}
function boundedTimeout(requested) {
  const value = Number(requested);
  if (!Number.isFinite(value) || value <= 0) return env.EXECUTION_TIMEOUT_MS;
  return Math.min(
    Math.max(value, 250),
    Math.max(env.EXECUTION_TIMEOUT_MS, 30000),
  );
}
async function withCompiledCode(code, callback) {
  const id = makeJobId();
  const workDir = path.resolve(env.JUDGE_WORK_DIR, id);
  await ensureDir(workDir);
  try {
    const source = path.join(workDir, "main.cpp");
    const exe = path.join(
      workDir,
      process.platform === "win32" ? "main.exe" : "main",
    );
    await fs.writeFile(source, code, "utf8");
    const compilation = await compileCpp(source, exe, workDir);
    if (!compilation.ok)
      return {
        jobId: id,
        verdict: "CE",
        compilationError: compilation.timedOut
          ? "Compilation timed out"
          : compilation.stderr ||
            compilation.spawnError ||
            "Compilation failed",
        tests: [],
      };
    return await callback({ id, workDir, exe });
  } finally {
    await removeDir(workDir);
  }
}
async function executeOne(exe, workDir, input, executionTimeoutMs) {
  const started = process.hrtime.bigint();
  const execution = await runProcess(exe, [], {
    cwd: workDir,
    timeoutMs: boundedTimeout(executionTimeoutMs),
    input,
    maxOutputBytes: env.MAX_OUTPUT_BYTES_PER_TEST,
  });
  const timeMs = Number(process.hrtime.bigint() - started) / 1e6;
  if (execution.outputLimitExceeded)
    return {
      verdict: "RE",
      timeMs: Number(timeMs.toFixed(3)),
      stdout: execution.stdout,
      stderr: "Output limit exceeded",
    };
  if (execution.timedOut)
    return {
      verdict: "TLE",
      timeMs: Number(timeMs.toFixed(3)),
      stdout: execution.stdout,
      stderr: execution.stderr,
    };
  if (!execution.ok)
    return {
      verdict: "RE",
      timeMs: Number(timeMs.toFixed(3)),
      stdout: execution.stdout,
      stderr: execution.stderr || execution.spawnError || "",
    };
  return {
    verdict: "OK",
    timeMs: Number(timeMs.toFixed(3)),
    stdout: execution.stdout,
    stderr: execution.stderr,
  };
}
async function runCode({ code, input, expectedOutput, executionTimeoutMs }) {
  return withCompiledCode(code, async ({ id, workDir, exe }) => {
    if (Buffer.byteLength(input) > env.MAX_INPUT_BYTES_PER_TEST)
      return {
        jobId: id,
        verdict: "RE",
        message: "Input exceeds configured size limit",
        tests: [],
      };
    const execution = await executeOne(exe, workDir, input, executionTimeoutMs);
    if (execution.verdict !== "OK")
      return {
        jobId: id,
        verdict: execution.verdict,
        stdout: execution.stdout,
        stderr: execution.stderr,
        timeMs: execution.timeMs,
      };
    if (expectedOutput === undefined)
      return {
        jobId: id,
        verdict: "OK",
        stdout: execution.stdout,
        stderr: execution.stderr,
        timeMs: execution.timeMs,
      };
    const actual = normalizeOutput(execution.stdout),
      expected = normalizeOutput(expectedOutput),
      pass = actual === expected;
    return {
      jobId: id,
      verdict: pass ? "AC" : "WA",
      passed: pass,
      stdout: execution.stdout,
      actualOutput: actual,
      expectedOutput: expected,
      timeMs: execution.timeMs,
    };
  });
}
async function judgeSubmission({ code, tests, executionTimeoutMs }) {
  return withCompiledCode(code, async ({ id, workDir, exe }) => {
    const results = [];
    let maxTime = 0;
    for (let i = 0; i < tests.length; i++) {
      const tc = tests[i];
      if (Buffer.byteLength(tc.input) > env.MAX_INPUT_BYTES_PER_TEST) {
        results.push({
          testNumber: i + 1,
          verdict: "RE",
          message: "Input exceeds configured size limit",
          timeMs: 0,
        });
        break;
      }
      const execution = await executeOne(
        exe,
        workDir,
        tc.input,
        executionTimeoutMs,
      );
      maxTime = Math.max(maxTime, execution.timeMs || 0);
      if (execution.verdict !== "OK") {
        results.push({
          testNumber: i + 1,
          verdict: execution.verdict,
          timeMs: execution.timeMs,
          stderr: execution.stderr || "",
        });
        break;
      }
      const actual = normalizeOutput(execution.stdout),
        expected = normalizeOutput(tc.expectedOutput),
        pass = actual === expected;
      results.push({
        testNumber: i + 1,
        verdict: pass ? "AC" : "WA",
        timeMs: execution.timeMs,
        ...(pass ? {} : { expectedOutput: expected, actualOutput: actual }),
      });
      if (!pass) break;
    }
    return {
      jobId: id,
      verdict: results.find((r) => r.verdict !== "AC")?.verdict || "AC",
      compilationError: null,
      executionTimeMs: Math.round(maxTime),
      tests: results,
    };
  });
}
module.exports = { judgeSubmission, runCode, normalizeOutput };
