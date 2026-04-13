import { z } from "zod";

export const reserveSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  userId: z.string().min(1, "User ID is required"),
  quantity: z.number().int().positive("Quantity must be greater than 0"),
});

export type ReserveInput = z.infer<typeof reserveSchema>;