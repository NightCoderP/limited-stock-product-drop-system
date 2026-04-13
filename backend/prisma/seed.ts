import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.product.findFirst({
    where: { name: "Limited Sneakers" },
  });

  if (existing) {
    console.log("Seed skipped: product already exists");
    return;
  }

  await prisma.product.create({
    data: {
      name: "Limited Sneakers",
      totalStock: 10,
      availableStock: 10,
    },
  });

  console.log("Seed completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });