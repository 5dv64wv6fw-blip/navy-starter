"use client";

import type { Order } from "@/lib/orders";

// Convierte 0412... en un enlace de WhatsApp (código de Venezuela: 58)
function toWhatsAppLink(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "58" + digits.slice(1);
  return `https://wa.me/${digits}`;
}

export default function OrderDetails({ order }: { order: Order }) {
  const items = order.items ?? [];

  // Si el pedido no trae detalles (pedidos de prueba viejos), no mostramos nada
  if (items.length === 0 && !order.notes) return null;

  const noteLines = (order.notes || "").split(" | ").filter(Boolean);

  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
  };

  return (
    <details
      style={{
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        padding: "10px 0",
      }}
    >
      <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 500 }}>
        Ver detalles del pedido
      </summary>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginTop: "12px",
          fontSize: "12px",
        }}
      >
        {/* Prendas */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((item, index) => (
            <div key={`${item.name}-${index}`} style={rowStyle}>
              <span>
                <strong style={{ fontWeight: 500 }}>{item.name}</strong>
                <span style={{ display: "block", color: "#888" }}>
                  {item.color} · Talla {item.size}
                </span>
              </span>
              <span>
                {item.quantity} × ${item.unitPriceUSD.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Totales */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            borderTop: "1px solid var(--line)",
            paddingTop: "8px",
          }}
        >
          <div style={rowStyle}>
            <span>Subtotal</span>
            <span>${(order.subtotalUSD ?? 0).toFixed(2)}</span>
          </div>
          <div style={rowStyle}>
            <span>Delivery</span>
            <span>${(order.deliveryFeeUSD ?? 0).toFixed(2)}</span>
          </div>
          <div style={{ ...rowStyle, fontWeight: 600 }}>
            <span>Total</span>
            <span>${(order.totalUSD ?? 0).toFixed(2)}</span>
          </div>
        </div>

        {/* Contacto y entrega */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {order.phone && (
            <div>
              📞 {order.phone} ·{" "}
              <a
                href={toWhatsAppLink(order.phone)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--ink)", fontWeight: 500 }}
              >
                Abrir WhatsApp
              </a>
            </div>
          )}
          {order.address && <div>📍 {order.address}</div>}
          {order.referencePoint && <div>Ref: {order.referencePoint}</div>}
          {order.paymentMethod && <div>💳 {order.paymentMethod}</div>}
          {order.createdAt && (
            <div style={{ color: "#888" }}>
              Recibido:{" "}
              {new Date(order.createdAt).toLocaleString("es-VE", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
          )}
        </div>

        {/* Notas del pedido (pago, vuelto, tasas) */}
        {noteLines.length > 0 && (
          <div
            style={{
              color: "#666",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            {noteLines.map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
