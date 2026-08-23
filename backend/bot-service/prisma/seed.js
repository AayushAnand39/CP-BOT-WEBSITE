const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const presets = [
  { slug: "rook-1200", name: "Rook", rating: 1200, aggression: 0.35, consistency: 0.55, speed: 0.40, tagStrengths: ["implementation"], tagWeaknesses: ["dp", "graphs"] },
  { slug: "knight-1400", name: "Knight", rating: 1400, aggression: 0.42, consistency: 0.62, speed: 0.46, tagStrengths: ["greedy", "math"], tagWeaknesses: ["flows"] },
  { slug: "bishop-1600", name: "Bishop", rating: 1600, aggression: 0.50, consistency: 0.70, speed: 0.52, tagStrengths: ["greedy", "binary search"], tagWeaknesses: ["geometry"] },
  { slug: "castle-1800", name: "Castle", rating: 1800, aggression: 0.58, consistency: 0.78, speed: 0.58, tagStrengths: ["dp", "graphs"], tagWeaknesses: ["geometry"] },
  { slug: "queen-2000", name: "Queen", rating: 2000, aggression: 0.65, consistency: 0.85, speed: 0.65, tagStrengths: ["dp", "graphs", "data structures"], tagWeaknesses: [] },
  { slug: "king-2200", name: "King", rating: 2200, aggression: 0.72, consistency: 0.91, speed: 0.72, tagStrengths: ["dp", "graphs", "number theory", "data structures"], tagWeaknesses: [] }
];

async function main() {
  for (const bot of presets) {
    await prisma.bot.upsert({
      where: { slug: bot.slug },
      update: bot,
      create: {
        ...bot,
        description: `Deterministic ${bot.rating}-rated CP bot`
      }
    });
  }
  console.log(`Seeded ${presets.length} bots`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
