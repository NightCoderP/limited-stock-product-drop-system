import axios from "axios";
import type { Product } from "../types/product";

console.log("API URL:", import.meta.env.VITE_API_URL);

const API_URL = import.meta.env.VITE_API_URL;

type ProductsResponse = {
  message: string;
  data: Product[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function fetchProducts(): Promise<Product[]> {
  const response = await axios.get<ProductsResponse>(`${API_URL}/products`);
  return response.data.data;
}