import axios from "axios";
import type { Product } from "../types/product";

const API_URL = import.meta.env.VITE_API_URL;

export async function fetchProducts(): Promise<Product[]> {
  const response = await axios.get<Product[]>(`${API_URL}/products`);
  return response.data;
}