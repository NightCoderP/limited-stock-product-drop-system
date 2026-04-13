import { PrismaClient } from "@prisma/client";

console.log(">>> PRISMA FILE LOADED");
console.log(">>> PrismaClient type:", typeof PrismaClient);

export const prisma = new PrismaClient();

console.log(">>> Prisma instance created:", !!prisma);