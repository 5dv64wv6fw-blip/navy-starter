"use client";

import Link from "next/link";
import { useCart } from "../context/CartContext";

export default function CartDrawer() {
  const { cart, isCartOpen, closeCart, updateQuantity, removeFromCart } =
    useCart();

  // Convierte seguro precios tipo "$35.00", "35" o números a float
  const parsePrice = (price: string | number | undefined): number => {
    if (typeof price === "number") return price;
    if (!price) return 0;
    const cleaned = String(price).replace(/[^0-9.-]+/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const total = cart.reduce((sum, item) => {
    const numericPrice = parsePrice(item.price);
    return sum + numericPrice * (item.quantity || 1);
  }, 0);

  const totalItemsCount = cart.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );

  const handleQuantityChange = (
    id: string | number,
    size: string,
    currentQuantity: number,
    delta: number,
  ) => {
    const newQuantity = currentQuantity + delta;
    if (newQuantity <= 0) {
      removeFromCart(id, size);
    } else {
      updateQuantity(id, size, newQuantity);
    }
  };

  return (
    <>
      {/* Fondo oscuro traslúcido */}
      <div
        onClick={closeCart}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.25)",
          opacity: isCartOpen ? 1 : 0,
          pointerEvents: isCartOpen ? "auto" : "none",
          transition: "opacity 0.3s ease",
          zIndex: 999,
        }}
      />

      {/* Drawer del Carrito */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "100%",
          maxWidth: "380px",
          height: "100vh",
          backgroundColor: "#ffffff",
          boxShadow: "-10px 0 40px rgba(0,0,0,0.06)",
          transform: isCartOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          padding: "32px 24px",
          boxSizing: "border-box",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
            borderBottom: "1px solid #f0f0f0",
            paddingBottom: "16px",
          }}
        >
          <span
            style={{
              fontSize: "15px",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Your Bag ({totalItemsCount})
          </span>
          <button
            type="button"
            onClick={closeCart}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "#333",
              padding: "4px",
            }}
          >
            ×
          </button>
        </div>

        {/* Lista de productos */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {cart.length === 0 ? (
            <p
              className="muted"
              style={{
                textAlign: "center",
                marginTop: "60px",
                fontSize: "14px",
              }}
            >
              Your bag is empty.
            </p>
          ) : (
            cart.map((item, index) => {
              const numericPrice = parsePrice(item.price);
              // Límite de inventario para esta variante (si no viene, no limitamos en pantalla)
              const reachedLimit =
                item.maxStock !== undefined &&
                item.quantity >= item.maxStock;

              return (
                <div
                  key={`${item.id}-${item.size || "nosize"}-${index}`}
                  style={{
                    display: "flex",
                    gap: "14px",
                    paddingBottom: "16px",
                    borderBottom: "1px solid #f8f8f8",
                    alignItems: "center",
                  }}
                >
                  {/* Imagen */}
                  <div
                    style={{
                      width: "60px",
                      height: "75px",
                      backgroundColor: "#f5f4f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "9px",
                      letterSpacing: "0.1em",
                      color: "#888",
                      flexShrink: 0,
                      overflow: "hidden",
                      borderRadius: "4px",
                    }}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name || "Product image"}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      "NAVY"
                    )}
                  </div>

                  {/* Detalles */}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 400,
                          color: "#111",
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#111",
                        }}
                      >
                        ${numericPrice.toFixed(2)}
                      </span>
                    </div>

                    {item.size && (
                      <span className="muted" style={{ fontSize: "12px" }}>
                        {item.color && <>Color: {item.color} · </>}
                        Size: {item.size}
                      </span>
                    )}

                    {/* Controles de cantidad (+ / -) */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginTop: "2px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          border: "1px solid #eaeaea",
                          borderRadius: "20px",
                          padding: "2px 6px",
                          backgroundColor: "#fafafa",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            handleQuantityChange(
                              item.id,
                              item.size,
                              item.quantity,
                              -1,
                            )
                          }
                          style={{
                            background: "none",
                            border: "none",
                            width: "24px",
                            height: "24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            fontSize: "14px",
                            color: "#333",
                            fontWeight: 500,
                          }}
                        >
                          −
                        </button>

                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 500,
                            minWidth: "18px",
                            textAlign: "center",
                            color: "#111",
                          }}
                        >
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          disabled={reachedLimit}
                          onClick={() =>
                            handleQuantityChange(
                              item.id,
                              item.size,
                              item.quantity,
                              1,
                            )
                          }
                          style={{
                            background: "none",
                            border: "none",
                            width: "24px",
                            height: "24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: reachedLimit ? "not-allowed" : "pointer",
                            fontSize: "14px",
                            color: reachedLimit ? "#bbb" : "#333",
                            fontWeight: 500,
                          }}
                        >
                          +
                        </button>
                      </div>

                      {reachedLimit && (
                        <span style={{ fontSize: "11px", color: "#888" }}>
                          Máximo disponible: {item.maxStock}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id, item.size)}
                        style={{
                          background: "none",
                          border: "none",
                          fontSize: "11px",
                          color: "#999",
                          cursor: "pointer",
                          textDecoration: "underline",
                          padding: 0,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Subtotal y Botón Checkout */}
        {cart.length > 0 && (
          <div
            style={{
              borderTop: "1px solid #f0f0f0",
              paddingTop: "20px",
              marginTop: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "16px",
                fontSize: "14px",
              }}
            >
              <span className="muted">Subtotal</span>
              <span style={{ fontWeight: 500 }}>${total.toFixed(2)}</span>
            </div>

            <Link
              href="/checkout"
              onClick={closeCart}
              style={{
                display: "block",
                width: "100%",
                padding: "16px",
                fontSize: "13px",
                border: "none",
                cursor: "pointer",
                textAlign: "center",
                textDecoration: "none",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                backgroundColor: "#111111",
                color: "#ffffff",
                borderRadius: "50px",
                boxSizing: "border-box",
                fontWeight: 600,
              }}
            >
              Checkout
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
