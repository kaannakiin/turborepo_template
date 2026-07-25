import { config } from "dotenv";
import { Role } from "./enums";
import { createPrismaClient } from "./server";

config({ path: "../../.env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = createPrismaClient(connectionString);

async function main() {
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      role: Role.ADMIN,
    },
  });

  const count = await prisma.user.count();
  console.log(`Seed complete — ${count} user(s) in database.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
