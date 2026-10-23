"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useCart, CartItem } from "../context/CartContext";
import { getPriceNumbers, Rates } from "@/lib/inventory";

export default function CheckoutPage() {
  const { cart, clearCart } = useCart();

  // Tasas reales (las guardas en el panel Admin)
  const [rates, setRates] = useState<Rates>({ tasaBCV: 745, tasaBNC: 1000 });

  useEffect(() => {
    fetch("/api/inventory", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.rates) setRates(data.rates);
      })
      .catch((err) => console.error("Error cargando tasas:", err));
  }, []);

  // Costo de delivery en dólares
  const DELIVERY_USD = 5.0;

  // Estados del formulario
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">(
    "delivery",
  );
  const [addressText, setAddressText] = useState("");
  const [itemsPayment, setItemsPayment] = useState("Pago Móvil");
  const [deliveryPayment, setDeliveryPayment] = useState("Pago Móvil");
  const [changeAmount, setChangeAmount] = useState("");

  // Opciones de pago
  const paymentOptions = [
    "Pago Móvil",
    "Zinli",
    "Dólares en efectivo",
    "Binance",
  ];

  // Identifica si cada concepto se paga en Bolívares
  const isItemsBs = itemsPayment === "Pago Móvil";
  const isDeliveryBs = deliveryPayment === "Pago Móvil";

  // Precio exacto en dólares de cada prenda
  const unitUSD = (item: CartItem) =>
    item.dollarPrice ?? (parseFloat(String(item.price).replace("$", "")) || 0);

  // Prendas en dólares: tu precio exacto, sin ajustes
  const itemsFinalUSD = cart.reduce(
    (sum, item) => sum + unitUSD(item) * item.quantity,
    0,
  );

  // Prendas en Bs: precio publicado × tasa BCV
  const itemsTotalBS = cart.reduce(
    (sum, item) =>
      sum + getPriceNumbers(unitUSD(item), rates).publishedBs * item.quantity,
    0,
  );

  // Entrega
  const deliveryCostUSD = deliveryType === "delivery" ? DELIVERY_USD : 0;
  // El delivery se convierte a Bs directamente con la tasa BCV
  const deliveryCostBS =
    deliveryType === "delivery" ? DELIVERY_USD * rates.tasaBCV : 0;

  // Verifica si seleccionó dólares en efectivo
  const isCash =
    itemsPayment === "Dólares en efectivo" ||
    (deliveryType === "delivery" && deliveryPayment === "Dólares en efectivo");

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      alert("Tu bolsa está vacía.");
      return;
    }

    if (isSubmitting) return;

    // Abrimos la pestaña de WhatsApp ahora, mientras dura el clic.
    // Si esperáramos a que responda el servidor, el celular la bloquearía.
    const waWindow = window.open("", "_blank");
    setIsSubmitting(true);

    // 1. Guardamos el pedido en la base de datos
    let orderCode = "";
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          deliveryType,
          address: addressText,
          itemsPayment,
          deliveryPayment,
          changeAmount,
          // Solo enviamos qué variante y cuántas: el servidor calcula los precios
          items: cart.map((item) => ({
            variantId: String(item.id),
            quantity: item.quantity,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No se pudo guardar el pedido");
      }

      orderCode = data.orderNumber;
    } catch (error) {
      waWindow?.close();
      setIsSubmitting(false);
      alert(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el pedido. Inténtalo de nuevo.",
      );
      return;
    }

    // Formateadores numéricos
    const fmtUSD = (val: number) => `$${val.toFixed(2)}`;
    const fmtBS = (val: number) =>
      `Bs. ${val.toLocaleString("es-VE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    // Construcción del mensaje formateado para WhatsApp
    let message = `*ORDEN DE COMPRA: ${orderCode}*\n`;
    message += `*Cliente:* ${firstName} ${lastName}\n`;
    message += `*Teléfono:* ${phone}\n`;
    message += `*Tipo de entrega:* ${deliveryType === "delivery" ? "Delivery" : "Pick Up"}\n`;

    if (deliveryType === "delivery") {
      message += `*Ubicación:* ${addressText}\n\n`;
    } else {
      message += `*Nota Pick Up:* ${addressText || "Sin notas"}\n\n`;
    }

    message += `*PRENDAS:*\n`;
    cart.forEach((item) => {
      const details = [
        item.color ? `Color: ${item.color}` : null,
        `Talla: ${item.size}`,
      ]
        .filter(Boolean)
        .join(", ");

      message += `- ${item.name} (${details}) x${item.quantity}\n`;
    });
    message += `\n*MÉTODOS DE PAGO:*\n`;
    if (isItemsBs) {
      message += `- Prendas (${itemsPayment}): ${fmtBS(itemsTotalBS)}\n`;
    } else {
      message += `- Prendas (${itemsPayment}): ${fmtUSD(itemsFinalUSD)} (15% desc. aplicado)\n`;
    }

    if (deliveryType === "delivery") {
      message += `- Delivery (${deliveryPayment}): ${isDeliveryBs ? fmtBS(deliveryCostBS) : fmtUSD(deliveryCostUSD)}\n`;
    } else {
      message += `- Pick Up: Gratis\n`;
    }

    message += `\n`;

    if (isItemsBs && (deliveryType === "pickup" || isDeliveryBs)) {
      const totalBs =
        itemsTotalBS + (deliveryType === "delivery" ? deliveryCostBS : 0);
      message += `*TOTAL A PAGAR:* ${fmtBS(totalBs)}\n`;
    } else if (!isItemsBs && (deliveryType === "pickup" || !isDeliveryBs)) {
      const totalUSD = itemsFinalUSD + deliveryCostUSD;
      message += `*TOTAL A PAGAR:* ${fmtUSD(totalUSD)}\n`;
    } else {
      message += `*TOTAL A PAGAR (DIVIDIDO):*\n`;
      message += `- En Pago Móvil: ${isItemsBs ? fmtBS(itemsTotalBS) : fmtBS(deliveryCostBS)}\n`;
      message += `- En Divisas: ${!isItemsBs ? fmtUSD(itemsFinalUSD) : fmtUSD(deliveryCostUSD)}\n`;
    }

    if (deliveryType === "delivery" || isCash) {
      message += `\n*POR ENVIAR:*\n`;
      if (deliveryType === "delivery") {
        message += `- Enviar ubicación exacta en GPS por este chat.\n`;
      }
      if (isCash) {
        message += `- Enviar foto de los billetes en efectivo.\n`;
      }
    }

    if (isCash && changeAmount) {
      message += `\n*NOTA:*\n`;
      message += `- Monto de vuelto requerido: ${changeAmount}\n`;
    }

    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = "584242785389";
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    if (waWindow) {
      waWindow.location.href = whatsappUrl;
    } else {
      // Si el navegador no dejó abrir la pestaña, seguimos en la misma
      window.location.href = whatsappUrl;
    }

    clearCart();
    setPlacedOrder(orderCode);
    setIsSubmitting(false);
  };

  // Pantalla de confirmación una vez guardado el pedido
  if (placedOrder) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
          textAlign: "center",
          backgroundColor: "#fafafa",
        }}
      >
        <p
          style={{
            fontSize: "12px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#888",
            margin: 0,
          }}
        >
          Pedido recibido
        </p>
        <h1 style={{ fontSize: "32px", fontWeight: 400, margin: 0 }}>
          {placedOrder}
        </h1>
        <p
          style={{
            maxWidth: "360px",
            color: "#555",
            fontSize: "14px",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Gracias por tu compra. Termina el pago por WhatsApp. Siempre puedes
          escribirnos por ahí para confirmar el estado de tu pedido.
        </p>
        <Link
          href="/"
          style={{
            marginTop: "8px",
            fontSize: "12px",
            textDecoration: "none",
            color: "#111",
            padding: "10px 20px",
            border: "1px solid #ccc",
            borderRadius: "50px",
            fontWeight: 500,
          }}
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#fafafa",
        paddingBottom: "60px",
        overflowX: "hidden",
        width: "100%",
      }}
    >
      {/* Navbar Minimalista */}
      <header
        className="site-nav"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "1px solid #eaeaea",
          backgroundColor: "#fff",
          gap: "16px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <Link className="logo" href="/">
          <img
            src="/navy-logo.png"
            alt="Navy"
            style={{ height: "40px", width: "auto", display: "block" }}
          />
        </Link>
        <Link
          href="/"
          style={{
            fontSize: "12px",
            textDecoration: "none",
            color: "#111",
            padding: "8px 14px",
            border: "1px solid #eaeaea",
            borderRadius: "50px",
            fontWeight: 500,
          }}
        >
          ← Volver
        </Link>
      </header>

      <main
        style={{
          maxWidth: "600px",
          margin: "40px auto",
          padding: "0 24px",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 400,
            marginBottom: "32px",
            textAlign: "center",
          }}
        >
          Completa tu pedido
        </h1>

        <form
          onSubmit={handleCheckout}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            width: "100%",
          }}
        >
          {/* SECCIÓN 1: DATOS PERSONALES Y TIPO DE ENTREGA */}
          <div
            style={{
              backgroundColor: "#fff",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid #eaeaea",
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <h2
              style={{
                fontSize: "14px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "16px",
              }}
            >
              1. Tus Datos y Entrega
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginBottom: "16px",
                width: "100%",
              }}
            >
              <input
                type="text"
                placeholder="Nombre"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              <input
                type="text"
                placeholder="Apellido"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <input
              type="tel"
              inputMode="tel"
              placeholder="Teléfono (ej. 0412 1234567)"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                fontSize: "14px",
                boxSizing: "border-box",
                marginBottom: "16px",
              }}
            />

            {/* Opciones de Método de Entrega */}
            <div style={{ marginBottom: "16px", width: "100%" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "8px",
                  color: "#555",
                  fontWeight: 500,
                }}
              >
                Opción de Entrega
              </label>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setDeliveryType("delivery")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "6px",
                    border:
                      deliveryType === "delivery"
                        ? "2px solid #111"
                        : "1px solid #ccc",
                    backgroundColor:
                      deliveryType === "delivery" ? "#f9f9f9" : "#fff",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: deliveryType === "delivery" ? 600 : 400,
                  }}
                >
                  Delivery ($5)
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType("pickup")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "6px",
                    border:
                      deliveryType === "pickup"
                        ? "2px solid #111"
                        : "1px solid #ccc",
                    backgroundColor:
                      deliveryType === "pickup" ? "#f9f9f9" : "#fff",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: deliveryType === "pickup" ? 600 : 400,
                  }}
                >
                  Pick Up (Gratis)
                </button>
              </div>
            </div>

            <textarea
              placeholder={
                deliveryType === "delivery"
                  ? "Dirección detallada de entrega (Edificio, casa, punto de referencia)"
                  : "Comentario o persona autorizada para retirar en Pick Up (Opcional)"
              }
              required={deliveryType === "delivery"}
              rows={3}
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                fontSize: "14px",
                resize: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* SECCIÓN 2: MÉTODOS DE PAGO */}
          <div
            style={{
              backgroundColor: "#fff",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid #eaeaea",
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <h2
              style={{
                fontSize: "14px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "16px",
              }}
            >
              2. Métodos de Pago
            </h2>

            <div style={{ marginBottom: "16px", width: "100%" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  marginBottom: "6px",
                  color: "#555",
                }}
              >
                Pago de las prendas
              </label>
              <select
                value={itemsPayment}
                onChange={(e) => setItemsPayment(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                  backgroundColor: "#fff",
                  boxSizing: "border-box",
                }}
              >
                {paymentOptions.map((opt) => (
                  <option key={`items-${opt}`} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {deliveryType === "delivery" && (
              <div style={{ marginBottom: "16px", width: "100%" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    marginBottom: "6px",
                    color: "#555",
                  }}
                >
                  Pago del delivery ($5)
                </label>
                <select
                  value={deliveryPayment}
                  onChange={(e) => setDeliveryPayment(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    fontSize: "14px",
                    backgroundColor: "#fff",
                    boxSizing: "border-box",
                  }}
                >
                  {paymentOptions.map((opt) => (
                    <option key={`delivery-${opt}`} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isCash && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "16px",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "8px",
                  border: "1px dashed #ccc",
                  boxSizing: "border-box",
                  width: "100%",
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    marginBottom: "6px",
                    color: "#333",
                    fontWeight: 500,
                  }}
                >
                  ¿Cuánto vuelto necesitas?
                </label>
                <input
                  type="text"
                  placeholder="Ej: $5 o $10"
                  value={changeAmount}
                  onChange={(e) => setChangeAmount(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}
          </div>

          {/* SECCIÓN 3: RESUMEN Y TOTAL */}
          <div
            style={{
              backgroundColor: "#fff",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid #eaeaea",
              boxSizing: "border-box",
              width: "100%",
            }}
          >
            <h2
              style={{
                fontSize: "14px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "16px",
              }}
            >
              3. Resumen y Total
            </h2>
            {/* Lista de prendas con color y talla */}
            <div
              style={{
                marginBottom: "16px",
                paddingBottom: "16px",
                borderBottom: "1px solid #eee",
              }}
            >
              {cart.map((item, index) => (
                <div
                  key={`${item.id}-${item.size}-${index}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "13px",
                    color: "#555",
                    marginBottom: "8px",
                  }}
                >
                  <span>
                    <strong style={{ color: "#111", fontWeight: 500 }}>
                      {item.name}
                    </strong>
                    <span
                      style={{
                        display: "block",
                        fontSize: "12px",
                        color: "#888",
                      }}
                    >
                      {item.color ? `${item.color} · ` : ""}Talla {item.size}
                    </span>
                  </span>
                  <span>x{item.quantity}</span>
                </div>
              ))}
            </div>
            {/* Fila Prendas */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
                fontSize: "14px",
                color: "#555",
                width: "100%",
              }}
            >
              <div>
                <span>
                  Prendas ({cart.length}) - <i>{itemsPayment}</i>
                </span>
                {!isItemsBs && (
                  <span
                    style={{
                      display: "block",
                      fontSize: "11px",
                      color: "#059669",
                    }}
                  >
                    15% desc. divisas aplicado
                  </span>
                )}
              </div>
              <span style={{ fontWeight: 500, color: "#111" }}>
                {isItemsBs
                  ? `Bs. ${itemsTotalBS.toLocaleString("es-VE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  : `$${itemsFinalUSD.toFixed(2)}`}
              </span>
            </div>

            {/* Fila Delivery / Pick Up */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                fontSize: "14px",
                color: "#555",
                width: "100%",
              }}
            >
              <span>
                {deliveryType === "delivery"
                  ? `Delivery - ${deliveryPayment}`
                  : "Pick Up"}
              </span>
              <span style={{ fontWeight: 500, color: "#111" }}>
                {deliveryType === "pickup"
                  ? "Gratis"
                  : isDeliveryBs
                    ? `Bs. ${deliveryCostBS.toLocaleString("es-VE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : `$${deliveryCostUSD.toFixed(2)}`}
              </span>
            </div>

            {/* Total Unificado */}
            <div
              style={{
                paddingTop: "16px",
                borderTop: "1px solid #eee",
                marginBottom: "24px",
                width: "100%",
              }}
            >
              {isItemsBs && (deliveryType === "pickup" || isDeliveryBs) ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#111",
                  }}
                >
                  <span>Total a pagar</span>
                  <span>
                    Bs.{" "}
                    {(
                      itemsTotalBS +
                      (deliveryType === "delivery" ? deliveryCostBS : 0)
                    ).toLocaleString("es-VE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ) : !isItemsBs && (deliveryType === "pickup" || !isDeliveryBs) ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#111",
                  }}
                >
                  <span>Total a pagar</span>
                  <span>${(itemsFinalUSD + deliveryCostUSD).toFixed(2)}</span>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#777",
                      textTransform: "uppercase",
                    }}
                  >
                    Total Dividido
                  </span>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    <span>En Pago Móvil</span>
                    <span>
                      Bs.{" "}
                      {(isItemsBs
                        ? itemsTotalBS
                        : deliveryCostBS
                      ).toLocaleString("es-VE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    <span>En Divisas</span>
                    <span>
                      $
                      {(!isItemsBs ? itemsFinalUSD : deliveryCostUSD).toFixed(
                        2,
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "16px",
                fontSize: "13px",
                border: "none",
                cursor: isSubmitting ? "default" : "pointer",
                textAlign: "center",
                textDecoration: "none",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                backgroundColor: "#111111",
                color: "#ffffff",
                borderRadius: "50px",
                fontWeight: 600,
                transition: "opacity 0.2s",
                boxSizing: "border-box",
                opacity: isSubmitting ? 0.6 : 1,
              }}
              onMouseOver={(e) => {
                if (!isSubmitting) e.currentTarget.style.opacity = "0.8";
              }}
              onMouseOut={(e) => {
                if (!isSubmitting) e.currentTarget.style.opacity = "1";
              }}
            >
              {isSubmitting
                ? "Guardando pedido..."
                : "Enviar pedido por WhatsApp"}
            </button>
            <p
              style={{
                textAlign: "center",
                fontSize: "11px",
                color: "#888",
                marginTop: "12px",
              }}
            >
              Serás redirigido a WhatsApp con tu resumen de compra para realizar
              el pago.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
