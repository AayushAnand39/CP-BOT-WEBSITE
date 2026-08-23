const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const connectDatabase = () => prisma.$connect();
const disconnectDatabase = () => prisma.$disconnect();
module.exports = { prisma, connectDatabase, disconnectDatabase };
