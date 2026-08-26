const { spawn } = require("child_process");
const fs = require("fs");
const { env } = require("../config/env");

function runCommand(command, args, options = {}) {
  const {
    cwd,
    timeoutMs = env.COMPILE_TIMEOUT_MS,
    stdinPath,
    stdoutPath,
    stderrLimit = 64 * 1024,
    stdoutLimit = 1024 * 1024,
  } = options;

  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    let stderr = "";
    let stdout = "";

    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutStream = stdoutPath ? fs.createWriteStream(stdoutPath) : null;

    const finish = (result) => {
      if (settled) return;

      settled = true;

      if (stdoutStream && !stdoutStream.destroyed) {
        stdoutStream.end(() => resolve(result));
      } else {
        resolve(result);
      }
    };

    if (stdinPath) {
      const input = fs.createReadStream(stdinPath);

      input.on("error", (error) => {
        try {
          child.kill("SIGKILL");
        } catch {}

        finish({
          ok: false,
          code: null,
          signal: null,
          timedOut: false,
          stdout,
          stderr: error.message,
        });
      });

      input.pipe(child.stdin);
    } else {
      child.stdin.end();
    }

    child.stdout.on("data", (chunk) => {
      if (stdoutStream) {
        stdoutStream.write(chunk);
      } else if (stdout.length < stdoutLimit) {
        stdout += chunk.toString().slice(0, stdoutLimit - stdout.length);
      }
    });

    child.stderr.on("data", (chunk) => {
      if (stderr.length < stderrLimit) {
        stderr += chunk.toString().slice(0, stderrLimit - stderr.length);
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;

      try {
        child.kill("SIGKILL");
      } catch {}
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);

      finish({
        ok: false,
        code: null,
        signal: null,
        timedOut,
        stdout,
        stderr: error.message,
      });
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);

      finish({
        ok: code === 0 && !timedOut,
        code,
        signal,
        timedOut,
        stdout,
        stderr,
      });
    });
  });
}

async function compileCpp(sourcePath, executablePath, cwd) {
  return runCommand(
    "g++",
    [
      sourcePath,
      "-std=gnu++20",
      "-O2",
      "-pipe",
      "-DONLINE_JUDGE",
      "-o",
      executablePath,
    ],
    {
      cwd,
      timeoutMs: env.COMPILE_TIMEOUT_MS,
    },
  );
}

async function runExecutable(executablePath, cwd, options = {}) {
  return runCommand(executablePath, [], {
    cwd,
    timeoutMs: options.timeoutMs,
    stdinPath: options.stdinPath,
    stdoutPath: options.stdoutPath,
  });
}

module.exports = {
  runCommand,
  compileCpp,
  runExecutable,
};
