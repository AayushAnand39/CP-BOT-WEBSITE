const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { pipeline } = require("stream/promises");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { env } = require("../config/env");

function isConfigured() {
  return Boolean(
    env.R2_ENDPOINT &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET_NAME,
  );
}

let client = null;
function getClient() {
  if (!isConfigured()) return null;
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

function jobPrefix(jobId) {
  return `jobs/${jobId}`;
}
function archiveKey(jobId) {
  return `${jobPrefix(jobId)}/testcases.zip`;
}
function manifestKey(jobId) {
  return `${jobPrefix(jobId)}/manifest.json`;
}
function testcaseKey(jobId, fileName) {
  return `${jobPrefix(jobId)}/${fileName}`;
}

async function putFile(
  filePath,
  key,
  contentType = "application/octet-stream",
) {
  const s3 = getClient();
  if (!s3) return null;
  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType,
    }),
  );
  return key;
}

async function putJson(value, key) {
  const s3 = getClient();
  if (!s3) return null;
  await s3.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: JSON.stringify(value),
      ContentType: "application/json",
    }),
  );
  return key;
}

async function objectExists(key) {
  const s3 = getClient();
  if (!s3) return false;
  try {
    await s3.send(
      new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
    );
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound")
      return false;
    throw error;
  }
}

async function getText(key) {
  const s3 = getClient();
  if (!s3) return null;
  const response = await s3.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
  );
  return response.Body.transformToString();
}

async function downloadFile(key, destinationPath) {
  const s3 = getClient();
  if (!s3) return false;
  const response = await s3.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
  );
  await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
  await pipeline(response.Body, fs.createWriteStream(destinationPath));
  return true;
}

async function uploadJob({
  jobId,
  workDir,
  generated,
  totalBytes,
  archiveBytes,
}) {
  if (!isConfigured()) {
    return { storage: "local", archiveKey: null, manifestKey: null };
  }

  // Upload testcase pairs separately so the judge can restore them without
  // downloading/decompressing a large ZIP.
  for (const item of generated) {
    await putFile(
      path.join(workDir, item.inputFile),
      testcaseKey(jobId, item.inputFile),
      "text/plain",
    );
    await putFile(
      path.join(workDir, item.outputFile),
      testcaseKey(jobId, item.outputFile),
      "text/plain",
    );
  }

  const zipKey = archiveKey(jobId);
  await putFile(path.join(workDir, "testcases.zip"), zipKey, "application/zip");

  const manifest = {
    version: 1,
    jobId,
    testCount: generated.length,
    generated,
    totalBytes,
    archiveBytes,
    archiveKey: zipKey,
    createdAt: new Date().toISOString(),
  };
  const mKey = manifestKey(jobId);
  await putJson(manifest, mKey);

  return { storage: "r2", archiveKey: zipKey, manifestKey: mKey };
}

async function readManifest(jobId) {
  if (!isConfigured()) return null;
  if (!(await objectExists(manifestKey(jobId)))) return null;
  return JSON.parse(await getText(manifestKey(jobId)));
}

async function restoreJobFiles(jobId, workDir, manifest) {
  if (!isConfigured() || !manifest?.generated?.length) return false;
  await fsp.mkdir(workDir, { recursive: true });
  for (const item of manifest.generated) {
    await downloadFile(
      testcaseKey(jobId, item.inputFile),
      path.join(workDir, item.inputFile),
    );
    await downloadFile(
      testcaseKey(jobId, item.outputFile),
      path.join(workDir, item.outputFile),
    );
  }
  return true;
}

async function restoreArchive(jobId, archivePath) {
  if (!isConfigured()) return false;
  const key = archiveKey(jobId);
  if (!(await objectExists(key))) return false;
  await downloadFile(key, archivePath);
  return true;
}

module.exports = {
  isConfigured,
  archiveKey,
  manifestKey,
  testcaseKey,
  objectExists,
  uploadJob,
  readManifest,
  restoreJobFiles,
  restoreArchive,
};
