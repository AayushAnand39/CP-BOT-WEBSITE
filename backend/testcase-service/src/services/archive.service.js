const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

/**
 * Creates the testcase archive without ever adding the archive itself.
 * The testcase service currently stores input_N.txt/output_N.txt directly
 * inside the job directory, so archive only those files explicitly.
 */
function createZip(sourceDir, outputPath) {
  return new Promise(async (resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 6 } });
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      try { archive.abort(); } catch {}
      try { output.destroy(); } catch {}
      reject(error);
    };

    output.on("close", () => {
      if (settled) return;
      settled = true;
      resolve(outputPath);
    });
    output.on("error", fail);
    archive.on("error", fail);
    archive.on("warning", (error) => {
      if (error.code !== "ENOENT") fail(error);
    });

    archive.pipe(output);

    try {
      const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
      const testcaseFiles = entries
        .filter((entry) => entry.isFile() && /^(input|output)_\d+\.txt$/.test(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => {
          const an = Number(a.match(/\d+/)?.[0] || 0);
          const bn = Number(b.match(/\d+/)?.[0] || 0);
          if (an !== bn) return an - bn;
          return a.localeCompare(b);
        });

      if (testcaseFiles.length === 0) {
        return fail(new Error("No testcase input/output files found to archive"));
      }

      for (const fileName of testcaseFiles) {
        archive.file(path.join(sourceDir, fileName), { name: fileName });
      }

      await archive.finalize();
    } catch (error) {
      fail(error);
    }
  });
}

function getArchivePath(workDir) {
  return path.join(workDir, "testcases.zip");
}

module.exports = {
  createZip,
  getArchivePath
};
