import express from "express";
import { prisma } from "./lib/prisma";
import { reserveSchema } from "./validators/reservation.validator";
import { z } from "zod";
import { checkoutSchema } from "./validators/checkout.validator";

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("API is running...");
});

app.get("/products", async (_req, res) => {
  try {
    const products = await prisma.product.findMany();
    return res.json(products);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/reserve", async (req, res) => {
  try {
    const parsedBody = reserveSchema.parse(req.body);
    const { productId, quantity, userId } = parsedBody;

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

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.issues,
    });
  }

  if (error instanceof Error && error.message === "NOT_ENOUGH_STOCK") {
    return res.status(400).json({ message: "Not enough stock" });
  }

  return res.status(500).json({ message: "Server error" });
}
});

app.post("/checkout", async (req, res) => {
  try {
    const { reservationId } = req.body;

    if (!reservationId) {
      return res.status(400).json({ message: "Reservation ID required" });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }

    if (reservation.status !== "ACTIVE") {
      return res.status(400).json({ message: "Reservation is not active" });
    }

    if (reservation.expiresAt < new Date()) {
      return res.status(400).json({ message: "Reservation expired" });
    }

    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: { status: "COMPLETED" },
    });

    return res.json({
      message: "Checkout successful",
      data: updated,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});

app.post("/checkout", async (req, res) => {
  try {
    const parsedBody = checkoutSchema.parse(req.body);
    const { reservationId } = parsedBody;

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return res.status(404).json({
        message: "Reservation not found",
      });
    }

    if (reservation.status !== "ACTIVE") {
      return res.status(400).json({
        message: "Reservation is not active",
      });
    }

    if (reservation.expiresAt < new Date()) {
      return res.status(400).json({
        message: "Reservation expired",
      });
    }

    const updatedReservation = await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        status: "COMPLETED",
      },
    });

    return res.status(200).json({
      message: "Checkout successful",
      data: updatedReservation,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.issues,
      });
    }

    return res.status(500).json({
      message: "Server error",
    });
  }
});

app.post("/cleanup", async (_req, res) => {
  try {
    const now = new Date();

    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: {
          lt: now,
        },
      },
    });

    let cleanedCount = 0;

    for (const reservation of expiredReservations) {
      await prisma.$transaction(async (tx) => {
        const updatedReservation = await tx.reservation.updateMany({
          where: {
            id: reservation.id,
            status: "ACTIVE",
          },
          data: {
            status: "EXPIRED",
          },
        });

        if (updatedReservation.count === 0) {
          return;
        }

        await tx.product.update({
          where: { id: reservation.productId },
          data: {
            availableStock: {
              increment: reservation.quantity,
            },
          },
        });

        cleanedCount += 1;
      });
    }

    return res.status(200).json({
      message: "Cleanup completed",
      cleanedCount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

setInterval(async () => {
  console.log("Running cleanup job...");
  await fetch("http://localhost:3001/cleanup", {
    method: "POST",
  });
}, 60 * 1000);