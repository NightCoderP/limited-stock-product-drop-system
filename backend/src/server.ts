import express from "express";
import { prisma } from "./lib/prisma";
import { reserveSchema } from "./validators/reservation.validator";
import { checkoutSchema } from "./validators/checkout.validator";
import { errorHandler } from "./middleware/error.middleware";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("API is running...");
});

app.get("/products", async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany();
    return res.json(products);
  } catch (error) {
    next(error);
  }
});

app.post("/reserve", async (req, res, next) => {
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
    next(error);
  }
});

app.post("/checkout", async (req, res, next) => {
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
    next(error);
  }
});

app.post("/cleanup", async (_req, res, next) => {
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
    next(error);
  }
});

app.use(errorHandler);

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});

setInterval(async () => {
  try {
    console.log("Running cleanup job...");
    await fetch("http://localhost:3001/cleanup", {
      method: "POST",
    });
  } catch (error) {
    console.error("Cleanup job failed:", error);
  }
}, 60 * 1000);