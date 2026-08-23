require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
  uploadFile,
  objectExists,
} = require("./src/services/r2-storage.service");

async function test() {
  const testFile = path.join(__dirname, "r2-test.txt");

  fs.writeFileSync(testFile, "CP Bot R2 connection successful!");

  const objectKey = "connection-test/r2-test.txt";

  console.log("Uploading...");

  await uploadFile(testFile, objectKey, "text/plain");

  console.log("Upload successful.");

  const exists = await objectExists(objectKey);

  console.log("Object exists:", exists);

  fs.unlinkSync(testFile);
}

test()
  .then(() => {
    console.log("R2 test completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("R2 test failed:");
    console.error(error);
    process.exit(1);
  });
