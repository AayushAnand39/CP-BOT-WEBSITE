const fs = require("fs/promises");
const path = require("path");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function removeDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

function resolveSafe(baseDir, fileName) {
  const resolvedBase = path.resolve(baseDir);
  const resolved = path.resolve(baseDir, fileName);

  if (resolved !== resolvedBase && !resolved.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error("Unsafe file path");
  }

  return resolved;
}

module.exports = { ensureDir, removeDir, resolveSafe };