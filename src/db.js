const { PrismaClient } = require('./generated/prisma');

let prisma;
function getPrisma() {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

module.exports = { getPrisma };
