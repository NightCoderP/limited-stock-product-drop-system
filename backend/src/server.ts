import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import { reserveSchema } from "./validators/reservation.validator";
import { checkoutSchema } from "./validators/checkout.validator";
import { errorHandler } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/logger.middleware";
import rateLimit from "express-rate-limit";

const app = express();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    message: "Too many requests, please try again later.",
  },
});

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(limiter);
app.use("/reserve", limiter);
app.use("/checkout", limiter);

app.get("/", (_req, res) => {
  res.send("API is running...");
});

app.get("/health", (_req, res) => {
  return res.status(200).json({
    message: "OK",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/products", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const sortBy = String(req.query.sortBy ?? "createdAt");
    const order = String(req.query.order ?? "desc");
    const inStock = req.query.inStock;

    const safePage = page > 0 ? page : 1;
    const safeLimit = limit > 0 && limit <= 100 ? limit : 10;
    const skip = (safePage - 1) * safeLimit;

    const where =
      inStock === "true"
        ? {
            availableStock: {
              gt: 0,
            },
          }
        : {};

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: {
          [sortBy]: order === "asc" ? "asc" : "desc",
        },
      }),
      prisma.product.count({ where }),
    ]);

    return res.status(200).json({
      message: "Products fetched successfully",
      data: products,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/reserve", async (req, res, next) => {
  try {
    const parsedBody = reserveSchema.parse(req.body);
    const { productId, quantity, userId } = parsedBody;

    const existingActiveReservation = await prisma.reservation.findFirst({
      where: {
        productId,
        userId,
        status: "ACTIVE",
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingActiveReservation) {
      return res.status(409).json({
        message: "User already has an active reservation for this product",
      });
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

      await tx.inventoryLog.create({
        data: {
          productId,
          change: -quantity,
          reason: "RESERVE",
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

    await prisma.inventoryLog.create({
      data: {
        productId: reservation.productId,
        change: 0,
        reason: "CHECKOUT",
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

        await tx.inventoryLog.create({
          data: {
            productId: reservation.productId,
            change: reservation.quantity,
            reason: "EXPIRE",
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