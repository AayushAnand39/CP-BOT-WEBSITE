const {PrismaClient}=require('@prisma/client'); const prisma=new PrismaClient();
module.exports={prisma,connectDatabase:()=>prisma.$connect(),disconnectDatabase:()=>prisma.$disconnect()};
