import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

type ReservePayload = {
  productId: string;
  quantity: number;
  userId: string;
};

type ReserveResponse = {
  message: string;
  data: {
    id: string;
    productId: string;
    userId: string;
    quantity: number;
    status: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
  };
};

export async function createReservation(
  payload: ReservePayload
): Promise<ReserveResponse["data"]> {
  const response = await axios.post<ReserveResponse>(
    `${API_URL}/reserve`,
    payload
  );

  return response.data.data;
}