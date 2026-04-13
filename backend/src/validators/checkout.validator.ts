import { z } from "zod";

export const checkoutSchema = z.object({
  reservationId: z.string().min(1, "Reservation ID is required"),
});