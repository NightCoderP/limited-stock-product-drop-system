import express from "express";
import cors from "cors";
import path from "path";
import { prisma } from "./lib/prisma";
import { reserveSchema } from "./validators/reservation.validator";
import { checkoutSchema } from "./validators/checkout.validator";
import { errorHandler } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/logger.middleware";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests, please try again later.",
  },
}) as express.RequestHandler;

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Sadece kritik endpoint'lere uygula
app.use("/reserve", limiter);
app.use("/checkout", limiter);

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
    const order = String(req.query.order ?? "desc");
    const inStock = req.query.inStock;

    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "name",
      "totalStock",
      "availableStock",
    ] as const;

    const requestedSortBy = String(req.query.sortBy ?? "createdAt");
    const sortBy = allowedSortFields.includes(
      requestedSortBy as (typeof allowedSortFields)[number]
    )
      ? requestedSortBy
      : "createdAt";

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 10;
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

    const updatedReservation = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.reservation.updateMany({
        where: { id: reservationId, status: "ACTIVE" },
        data: { status: "COMPLETED" },
      });

      if (updateResult.count === 0) {
        throw new Error("RESERVATION_ALREADY_PROCESSED");
      }

      await tx.product.update({
        where: { id: reservation.productId },
        data: {
          totalStock: {
            decrement: reservation.quantity,
          },
        },
      });

      await tx.order.create({
        data: {
          reservationId: reservation.id,
        },
      });

      await tx.inventoryLog.create({
        data: {
          productId: reservation.productId,
          change: -reservation.quantity,
          reason: "CHECKOUT",
        },
      });

      return tx.reservation.findUnique({ where: { id: reservationId } });
    });

    return res.status(200).json({
      message: "Checkout successful",
      data: updatedReservation,
    });
  } catch (error: any) {
    if (error.message === "RESERVATION_ALREADY_PROCESSED") {
      return res.status(409).json({ message: "Reservation was already processed or is no longer active" });
    }
    next(error);
  }
});

async function runCleanup() {
  let cleanedCount = 0;

  while (true) {
    const now = new Date();
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: {
          lt: now,
        },
      },
      take: 50,
    });

    if (expiredReservations.length === 0) {
      break;
    }

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
  }

  return cleanedCount;
}

app.post("/cleanup", async (_req, res, next) => {
  try {
    const cleanedCount = await runCleanup();

    return res.status(200).json({
      message: "Cleanup completed",
      cleanedCount,
    });
  } catch (error) {
    next(error);
  }
});

// Frontend build path
// Eğer backend/dist/server.js içinden çalışıyorsan ve frontend build output'u project-root/public ise bu doğru olur.
// Eğer senin frontend build'in dist ise aşağıdaki "public" kısmını "dist" yap.
const frontendPath = path.resolve(__dirname, "../public");

app.use(express.static(frontendPath));

// API route değilse index.html dön
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/health")) return next();
  if (req.path.startsWith("/products")) return next();
  if (req.path.startsWith("/reserve")) return next();
  if (req.path.startsWith("/checkout")) return next();
  if (req.path.startsWith("/cleanup")) return next();

  return res.sendFile(path.join(frontendPath, "index.html"));
});

// Error handler en sonda olmalı
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Background cleanup job
setInterval(async () => {
  try {
    console.log("Running cleanup job...");
    const cleanedCount = await runCleanup();
    console.log(`Cleanup completed. Cleaned: ${cleanedCount}`);
  } catch (error) {
    console.error("Cleanup job failed:", error);
  }
}, 60 * 1000);