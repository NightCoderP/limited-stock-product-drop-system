import { Request, Response, NextFunction } from "express";
import { z } from "zod";

export function errorHandler(
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(error);

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.issues,
    });
  }

  if (error.message === "NOT_ENOUGH_STOCK") {
    return res.status(400).json({
      message: "Not enough stock",
    });
  }

  return res.status(500).json({
    message: "Server error",
  });
}