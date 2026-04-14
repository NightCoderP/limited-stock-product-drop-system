import { useEffect, useState } from "react";
import { fetchProducts } from "./api/products";
import type { Product } from "./types/product";

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        setError("");
        const data = await fetchProducts();
        setProducts(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load products");
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading products...</div>;
  }

  if (error) {
    return <div style={{ padding: 24, color: "red" }}>{error}</div>;
  }

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>Limited Stock Product Drop</h1>

      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {products.map((product) => (
            <div
              key={product.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 16,
                maxWidth: 420,
              }}
            >
              <h2>{product.name}</h2>
              <p>Total Stock: {product.totalStock}</p>
              <p>Available Stock: {product.availableStock}</p>

              <button
                disabled={product.availableStock === 0}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "none",
                  cursor: product.availableStock === 0 ? "not-allowed" : "pointer",
                }}
              >
                {product.availableStock === 0 ? "Sold Out" : "Reserve"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;