import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
    transactionOptions: {
      timeout: 30000,
      maxWait: 10000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
