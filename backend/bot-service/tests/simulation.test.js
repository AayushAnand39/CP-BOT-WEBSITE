const test = require("node:test");
const assert = require("node:assert/strict");
const { computeProbabilities, simulateContest } = require("../src/services/simulation.service");

const bot = {
  id: "bot-1",
  slug: "bishop-1600",
  rating: 1600,
  aggression: 0.5,
  consistency: 0.7,
  speed: 0.52,
  tagStrengths: ["greedy"],
  tagWeaknesses: ["geometry"]
};

const problems = [
  { id: "p1", rating: 800, tags: ["implementation"], ordinal: 1 },
  { id: "p2", rating: 1200, tags: ["greedy"], ordinal: 2 },
  { id: "p3", rating: 1600, tags: ["greedy"], ordinal: 3 },
  { id: "p4", rating: 1800, tags: ["geometry"], ordinal: 4 }
];

test("strong tags improve solve probability", () => {
  const strong = computeProbabilities(bot, { rating: 1600, tags: ["greedy"] });
  const weak = computeProbabilities(bot, { rating: 1600, tags: ["geometry"] });
  assert.ok(strong.solveProbability > weak.solveProbability);
});

test("rating creates a material skill gap", () => {
  const low = computeProbabilities({ ...bot, rating: 1200 }, { rating: 1600, tags: [] });
  const high = computeProbabilities({ ...bot, rating: 2000 }, { rating: 1600, tags: [] });
  assert.ok(high.solveProbability - low.solveProbability > 0.5);
});

test("contest simulation is deterministic", () => {
  const args = { bot, problems, contestId: "contest-1", contestSeed: "12345", durationSeconds: 300 };
  assert.deepEqual(simulateContest(args), simulateContest(args));
});

test("events are sequential and inside contest duration", () => {
  const plan = simulateContest({ bot, problems, contestId: "contest-1", contestSeed: "12345", durationSeconds: 300 });
  let previous = -1;
  for (const event of plan.events) {
    assert.ok(event.atSeconds >= previous);
    assert.ok(event.atSeconds < 300);
    previous = event.atSeconds;
  }
});

test("hard consecutive submissions are not unrealistically simultaneous", () => {
  const highProblems = [
    { id: "h1", rating: 1600, tags: [], ordinal: 1 },
    { id: "h2", rating: 1800, tags: [], ordinal: 2 }
  ];
  const plan = simulateContest({ bot, problems: highProblems, contestId: "contest-2", contestSeed: "777", durationSeconds: 300 });
  const acLike = plan.events.filter((e) => e.attemptKind === "REFERENCE");
  for (let i = 1; i < acLike.length; i++) {
    assert.ok(acLike[i].atSeconds - acLike[i - 1].atSeconds >= 20);
  }
});
