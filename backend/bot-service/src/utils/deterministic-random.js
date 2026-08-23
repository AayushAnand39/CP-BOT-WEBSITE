const crypto = require("crypto");

function hashToUint32(value) {
  const hash = crypto.createHash("sha256").update(String(value)).digest();
  return hash.readUInt32BE(0);
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRandom(seedParts) {
  const seed = hashToUint32(seedParts.join("|"));
  return mulberry32(seed);
}

module.exports = { hashToUint32, mulberry32, createRandom };
