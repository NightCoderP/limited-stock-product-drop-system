import express from "express";
import { prisma } from "./lib/prisma";

console.log(">>> CORRECT SERVER FILE LOADED");

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("API is running...");
});

app.get("/products", async (_req, res) => {
  try {
    const products = await prisma.product.findMany();
    console.log("Products:", products);
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});