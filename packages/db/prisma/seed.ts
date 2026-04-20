import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@coachfinanciero.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "changeme-secure-password";
  const adminName = process.env.ADMIN_NAME ?? "Admin";

  const hash = await bcrypt.hash(adminPassword, 12);

  // Create or update the default admin user
  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: hash, name: adminName },
    create: {
      id: "default-user",
      email: adminEmail,
      password: hash,
      name: adminName,
      isAdmin: true,
    },
  });

  console.log(`✅ Default user: ${user.email} (id: ${user.id})`);

  // Migrate all existing rows to point to the default user
  const models = [
    prisma.account,
    prisma.transaction,
    prisma.budget,
    prisma.conversation,
    prisma.notification,
    prisma.emailIngest,
    prisma.userSettings,
  ] as unknown as Array<{ updateMany: (args: { where: object; data: object }) => Promise<{ count: number }> }>;

  for (const model of models) {
    try {
      const result = await model.updateMany({
        where: { userId: "default-user" },
        data: { userId: user.id },
      });
      if (result.count > 0) {
        console.log(`  → Updated ${result.count} rows in ${model.constructor?.name ?? "model"}`);
      }
    } catch {
      // Some models might not have userId yet or already correct
    }
  }

  console.log("✅ Seed complete");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
