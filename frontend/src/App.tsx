import { useEffect, useMemo, useState } from "react";
import { fetchProducts } from "./api/products";
import { createReservation } from "./api/reservations";
import type { Product } from "./types/product";

type ReservationState = {
  id: string;
  productId: string;
  userId: string;
  quantity: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [reserveLoadingId, setReserveLoadingId] = useState<string>("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [reservation, setReservation] = useState<ReservationState | null>(null);
  const [now, setNow] = useState(Date.now());

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

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!reservation) return;
    if (reservation.status === "COMPLETED") return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [reservation]);

  const remainingMs = useMemo(() => {
    if (!reservation) return 0;
    if (reservation.status === "COMPLETED") return 0;

    const expiresAtMs = new Date(reservation.expiresAt).getTime();
    return Math.max(expiresAtMs - now, 0);
  }, [reservation, now]);

  const isExpired =
    reservation !== null &&
    reservation.status !== "COMPLETED" &&
    remainingMs === 0;

  const formattedTime = useMemo(() => {
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  }, [remainingMs]);

  async function handleReserve(productId: string) {
    try {
      setError("");
      setSuccessMessage("");
      setReserveLoadingId(productId);

      const createdReservation = await createReservation({
        productId,
        quantity: 1,
        userId: "user-1",
      });

      setReservation(createdReservation);
      setNow(Date.now());
      setSuccessMessage("Reservation created successfully");
      await loadProducts();
    } catch (err: unknown) {
      console.error(err);

      let message = "Reservation failed";

      if (typeof err === "object" && err !== null && "response" in err) {
        const errorResponse = err as {
          response?: {
            data?: {
              message?: string;
            };
          };
        };

        message = errorResponse.response?.data?.message ?? message;
      }

      setError(message);
    } finally {
      setReserveLoadingId("");
    }
  }

  async function handleCheckout() {
    if (!reservation) return;

    try {
      setError("");
      setSuccessMessage("");
      setCheckoutLoading(true);

      const response = await fetch(`${API_URL}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reservationId: reservation.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Checkout failed");
      }

      setReservation((prev) =>
        prev
          ? {
              ...prev,
              status: "COMPLETED",
            }
          : prev
      );

      setSuccessMessage("Checkout completed successfully");
      await loadProducts();
    } catch (err: unknown) {
      console.error(err);

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Checkout failed");
      }
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading products...</div>;
  }

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>Limited Stock Product Drop</h1>

      {error && <p style={{ color: "red", marginBottom: 12 }}>{error}</p>}

      {successMessage && (
        <p style={{ color: "green", marginBottom: 12 }}>{successMessage}</p>
      )}

      {reservation && (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            maxWidth: 420,
          }}
        >
          <h3>Your Reservation</h3>
          <p>Reservation ID: {reservation.id}</p>
          <p>
            Status:{" "}
            {reservation.status === "COMPLETED"
              ? "COMPLETED"
              : isExpired
              ? "EXPIRED"
              : reservation.status}
          </p>

          {reservation.status !== "COMPLETED" && (
            <p>Expires In: {formattedTime}</p>
          )}

          {isExpired && (
            <p style={{ color: "red" }}>
              Your reservation has expired. Please reserve again.
            </p>
          )}

          {reservation.status === "COMPLETED" && (
            <p style={{ color: "green" }}>
              Your reservation has been completed successfully.
            </p>
          )}

          {reservation.status === "ACTIVE" && !isExpired && (
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                cursor: checkoutLoading ? "not-allowed" : "pointer",
              }}
            >
              {checkoutLoading ? "Processing..." : "Checkout"}
            </button>
          )}
        </div>
      )}

      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {products.map((product) => {
            const isReserving = reserveLoadingId === product.id;
            const isSoldOut = product.availableStock === 0;

            return (
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
                  onClick={() => handleReserve(product.id)}
                  disabled={isSoldOut || isReserving}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "none",
                    cursor:
                      isSoldOut || isReserving ? "not-allowed" : "pointer",
                  }}
                >
                  {isSoldOut
                    ? "Sold Out"
                    : isReserving
                    ? "Reserving..."
                    : "Reserve"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default App;