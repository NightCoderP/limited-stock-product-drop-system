import express from "express";
import { prisma } from "./lib/prisma";

console.log(">>> SERVER FILE LOADED");
console.log(">>> imported prisma:", prisma);

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("API is running...");
});

app.get("/products", async (_req, res) => {
  try {
    console.log(">>> /products hit, prisma =", prisma);
    const products = await prisma.product.findMany();
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/reserve", async (req, res) => {
  try {
    const { productId, quantity, userId } = req.body;

    if (!productId || !quantity || !userId) {
      return res.status(400).json({ message: "Missing fields" });
    }

    if (quantity <= 0) {
      return res.status(400).json({ message: "Quantity must be greater than 0" });
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const reservation = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.updateMany({
        where: {
          id: productId,
          availableStock: {
            gte: quantity,
          },
        },
        data: {
          availableStock: {
            decrement: quantity,
          },
        },
      });

      if (updatedProduct.count === 0) {
        throw new Error("NOT_ENOUGH_STOCK");
      }

      const createdReservation = await tx.reservation.create({
        data: {
          productId,
          userId,
          quantity,
          expiresAt,
        },
      });

      return createdReservation;
    });

    return res.status(201).json({
      message: "Reservation created",
      data: reservation,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof Error && error.message === "NOT_ENOUGH_STOCK") {
      return res.status(400).json({ message: "Not enough stock" });
    }

    return res.status(500).json({ message: "Server error" });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});