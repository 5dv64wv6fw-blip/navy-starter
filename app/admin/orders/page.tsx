"use client";

import React, { useState } from "react";
import Link from "next/link";
import AdminMenu from "@/components/admin/AdminMenu";

import { type Order } from "@/lib/orders";
import { useAdminOrders } from "@/lib/admin-orders-context";

/*
  Campos extra que la API devuelve en cada pedido.
  Se declaran aquí para no depender de cambios en lib/orders.
*/
type OrderDetails = {
  phone?: string;
  address?: string;
  referencePoint?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt?: string;
  subtotalUSD?: number;
  deliveryFeeUSD?: number;
  totalUSD?: number;
  items?: {
    name: string;
    color?: string;
    size?: string;
    quantity: number;
    unitPriceUSD?: number;
    totalPriceUSD?: number;
  }[];
};

type ExtendedOrder = Order & OrderDetails;

/*
  Estos son los estados que verá Nicole
  dentro de Orders.
*/
const ORDER_STAGES = [
  "Pago pendiente",
  "Pago confirmado",
  "Pendiente de empacar",
  "Empacado",
  "Entrega pendiente",
  "Coordinada",
  "En camino",
  "Entregado",
  "Cancelado",
];

/*
  Determina automáticamente en qué etapa
  se encuentra cada pedido.
*/
const getOrderStage = (order: Order): string => {
  if (order.orderStatus === "Cancelled") {
    return "Cancelado";
  }

  if (order.paymentStatus === "Pending") {
    return "Pago pendiente";
  }

  if (order.paymentStatus === "Rejected") {
    return "Pago pendiente";
  }

  if (order.preparationStatus === "Pending") {
    return "Pendiente de empacar";
  }

  if (
    order.preparationStatus === "Packed" &&
    order.deliveryStatus === "Pending"
  ) {
    return "Entrega pendiente";
  }

  if (order.deliveryStatus === "Coordinated") {
    return "Coordinada";
  }

  if (order.deliveryStatus === "On the way") {
    return "En camino";
  }

  if (order.deliveryStatus === "Delivered") {
    return "Entregado";
  }

  return "Entrega pendiente";
};

// Formatea montos en dólares
const fmtUSD = (value?: number) => `$${Number(value || 0).toFixed(2)}`;

// Fecha y hora en hora de Venezuela
const fmtDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("es-VE", {
        timeZone: "America/Caracas",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

// Convierte un teléfono venezolano (0412...) en enlace de WhatsApp (58412...)
const whatsappLink = (phone: string) => {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `58${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
};

export default function OrdersPage() {
  const { orders, setOrders } = useAdminOrders();
  const [searchTerm, setSearchTerm] = useState("");

  // IDs de los pedidos con el detalle desplegado
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const toggleDetails = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  /*
    Cambia la parte correcta del pedido
    dependiendo de la etapa seleccionada.
  */
  const handleStageChange = async (orderId: string, newStage: string) => {
    let deliveryTime = "";

    /*
    Si seleccionamos "Coordinada",
    preguntamos cuándo será la entrega.
  */
    if (newStage === "Coordinada") {
      const userInput = window.prompt(
        "¿Para qué día y hora coordinaste esta entrega? (Ej: Mañana 3:00 PM)",
      );

      if (userInput) {
        deliveryTime = userInput;
      } else {
        return;
      }
    }

    let update: Partial<Order> = {};

    /*
    Pago pendiente
  */
    if (newStage === "Pago pendiente") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Pending",
      };
    }

    /*
    Pago confirmado
  */
    if (newStage === "Pago confirmado") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
      };
    }

    /*
    Pendiente de empacar
  */
    if (newStage === "Pendiente de empacar") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
        preparationStatus: "Pending",
      };
    }

    /*
    Empacado
  */
    if (newStage === "Empacado") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
        preparationStatus: "Packed",
      };
    }

    /*
    Entrega pendiente
  */
    if (newStage === "Entrega pendiente") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
        preparationStatus: "Packed",
        deliveryStatus: "Pending",
        deliveryTime: "",
      };
    }

    /*
    Entrega coordinada
  */
    if (newStage === "Coordinada") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
        preparationStatus: "Packed",
        deliveryStatus: "Coordinated",
        deliveryTime,
      };
    }

    /*
    Pedido en camino
  */
    if (newStage === "En camino") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
        preparationStatus: "Packed",
        deliveryStatus: "On the way",
      };
    }

    /*
    Pedido entregado
  */
    if (newStage === "Entregado") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
        preparationStatus: "Packed",
        deliveryStatus: "Delivered",
      };
    }

    /*
    Pedido cancelado.
    OJO: este valor es el que guarda la base de datos.
    El texto que ve la usuaria es "Cancelado", pero el valor es "Cancelled".
  */
    if (newStage === "Cancelado") {
      update = {
        orderStatus: "Cancelled",
      };
    }

    if (Object.keys(update).length === 0) {
      return;
    }

    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          ...update,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al actualizar pedido");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al actualizar pedido");
      }

      /*
      Actualizamos el estado compartido
      con la respuesta real del API.
    */
      setOrders((prevOrders) =>
        prevOrders.map((order) => (order.id === orderId ? data.order : order)),
      );
    } catch (error) {
      console.error("Error actualizando pedido:", error);
    }
  };

  /*
    Buscador
  */
  const filteredOrders = orders.filter((order) => {
    const searchLower = searchTerm.toLowerCase();

    return (
      order.name.toLowerCase().includes(searchLower) ||
      (order.deliveryTime || "").toLowerCase().includes(searchLower) ||
      order.id.toLowerCase().includes(searchLower)
    );
  });

  return (
    <main className="admin-shell">
      {/* HEADER */}

      <header
        className="admin-top"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "24px",
            alignItems: "center",
          }}
        >
          <Link className="admin-logo" href="/admin">
            NAVY ADMIN
          </Link>

          <AdminMenu />
        </div>
      </header>

      {/* MAIN */}

      <div className="admin-main">
        <div className="admin-title">
          <h1>Order Management</h1>

          <span className="muted">Controla el flujo de cada pedido</span>
        </div>

        {/* SEARCH */}

        <div style={{ marginBottom: "32px" }}>
          <input
            type="text"
            placeholder="Filtrar por clienta, día (Ej: Viernes) o ID de orden..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              fontSize: "14px",
              backgroundColor: "#fff",
            }}
          />
        </div>

        {/* ORDER GROUPS */}

        {ORDER_STAGES.map((stage) => {
          const ordersInThisStage = filteredOrders.filter(
            (order) => getOrderStage(order) === stage,
          );

          if (ordersInThisStage.length === 0) {
            return null;
          }

          return (
            <div
              key={stage}
              style={{
                marginBottom: "32px",
              }}
            >
              {/* SECTION TITLE */}

              <div
                className="section-label"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{stage}</span>

                <span
                  style={{
                    color: "var(--ink)",
                    backgroundColor: "var(--soft)",
                    padding: "2px 8px",
                    borderRadius: "50px",
                    fontSize: "11px",
                  }}
                >
                  {ordersInThisStage.length}
                </span>
              </div>

              {/* ORDERS */}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {ordersInThisStage.map((order) => {
                  const o = order as ExtendedOrder;
                  const isCancelled = order.orderStatus === "Cancelled";
                  const isExpanded = expandedIds.includes(order.id);
                  const items = o.items || [];

                  return (
                    <article
                      className="todo"
                      key={order.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        borderLeft: isCancelled
                          ? "3px solid #ccc"
                          : "3px solid var(--ink)",
                      }}
                    >
                      {/* ORDER HEADER */}

                      <div
                        className="todo-head"
                        style={{
                          borderBottom: "1px solid var(--line)",
                          paddingBottom: "12px",
                          marginBottom: "4px",
                        }}
                      >
                        <div>
                          <div
                            className="order-title"
                            style={{
                              fontSize: "15px",
                              textDecoration: isCancelled
                                ? "line-through"
                                : "none",
                              opacity: isCancelled ? 0.6 : 1,
                            }}
                          >
                            {order.id} · {order.name}
                          </div>

                          {o.createdAt && (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#777",
                                marginTop: "4px",
                              }}
                            >
                              🕒 {fmtDateTime(o.createdAt)}
                            </div>
                          )}

                          {order.deliveryTime && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--ink)",
                                marginTop: "4px",
                                fontWeight: 500,
                              }}
                            >
                              📅 {order.deliveryTime}
                            </div>
                          )}
                        </div>

                        <strong
                          style={{
                            fontSize: "15px",
                            opacity: isCancelled ? 0.6 : 1,
                          }}
                        >
                          {order.detail.split("·").at(-1)}
                        </strong>
                      </div>

                      {/* ORDER DETAILS */}

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <span className="status" style={{ fontSize: "11px" }}>
                          Payment: {order.paymentStatus}
                        </span>

                        <span className="status" style={{ fontSize: "11px" }}>
                          Preparation: {order.preparationStatus}
                        </span>

                        <span className="status" style={{ fontSize: "11px" }}>
                          Delivery: {order.deliveryStatus}
                        </span>
                      </div>

                      {/* BOTÓN DETALLE */}

                      <div>
                        <button
                          type="button"
                          onClick={() => toggleDetails(order.id)}
                          style={{
                            padding: "6px 10px",
                            border: "1px solid var(--line)",
                            borderRadius: 6,
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          {isExpanded ? "Ocultar detalle ▲" : "Ver detalle ▼"}
                        </button>
                      </div>

                      {/* DETALLE DESPLEGABLE */}

                      {isExpanded && (
                        <div
                          style={{
                            borderTop: "1px solid var(--line)",
                            paddingTop: 12,
                            display: "grid",
                            gap: 16,
                            fontSize: 13,
                          }}
                        >
                          {/* CLIENTA */}
                          <div>
                            <div
                              style={{
                                fontSize: 11,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                opacity: 0.7,
                                marginBottom: 6,
                              }}
                            >
                              Clienta
                            </div>

                            <div>
                              <strong>{order.name}</strong>
                            </div>

                            {o.phone && (
                              <div style={{ marginTop: 4 }}>
                                📱 {o.phone} ·{" "}
                                <a
                                  href={whatsappLink(o.phone)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: "#1e5c22",
                                    textDecoration: "underline",
                                  }}
                                >
                                  Escribir por WhatsApp
                                </a>
                              </div>
                            )}

                            {o.address && (
                              <div style={{ marginTop: 4 }}>📍 {o.address}</div>
                            )}

                            {o.referencePoint && (
                              <div style={{ marginTop: 4 }}>
                                Referencia: {o.referencePoint}
                              </div>
                            )}
                          </div>

                          {/* PRENDAS */}
                          <div>
                            <div
                              style={{
                                fontSize: 11,
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                opacity: 0.7,
                                marginBottom: 6,
                              }}
                            >
                              Prendas
                            </div>

                            {items.length === 0 ? (
                              <div style={{ color: "#888" }}>
                                Sin prendas registradas.
                              </div>
                            ) : (
                              <table
                                style={{
                                  width: "100%",
                                  borderCollapse: "collapse",
                                  fontSize: 12,
                                }}
                              >
                                <thead>
                                  <tr
                                    style={{
                                      textAlign: "left",
                                      borderBottom: "1px solid var(--line)",
                                    }}
                                  >
                                    <th style={{ padding: "4px 0" }}>Prenda</th>
                                    <th>Color</th>
                                    <th>Talla</th>
                                    <th>Cant.</th>
                                    <th style={{ textAlign: "right" }}>
                                      Total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((item, index) => (
                                    <tr
                                      key={`${item.name}-${index}`}
                                      style={{
                                        borderBottom: "1px solid #f0f0f0",
                                      }}
                                    >
                                      <td style={{ padding: "6px 0" }}>
                                        {item.name}
                                      </td>
                                      <td>{item.color || "—"}</td>
                                      <td>{item.size || "—"}</td>
                                      <td>{item.quantity}</td>
                                      <td style={{ textAlign: "right" }}>
                                        {fmtUSD(item.totalPriceUSD)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>

                          {/* TOTALES Y PAGO */}
                          <div
                            style={{
                              display: "grid",
                              gap: 4,
                              background: "#faf9f6",
                              padding: 10,
                              borderRadius: 6,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <span>Subtotal prendas</span>
                              <span>{fmtUSD(o.subtotalUSD)}</span>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <span>Delivery</span>
                              <span>{fmtUSD(o.deliveryFeeUSD)}</span>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontWeight: 700,
                                borderTop: "1px solid var(--line)",
                                paddingTop: 4,
                              }}
                            >
                              <span>Total</span>
                              <span>{fmtUSD(o.totalUSD)}</span>
                            </div>

                            {o.paymentMethod && (
                              <div style={{ marginTop: 4, opacity: 0.8 }}>
                                Método de pago: {o.paymentMethod}
                              </div>
                            )}
                          </div>

                          {/* NOTAS */}
                          {o.notes && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "#555",
                                lineHeight: 1.5,
                              }}
                            >
                              <strong>Notas:</strong> {o.notes}
                            </div>
                          )}
                        </div>
                      )}

                      {/* CHANGE STAGE */}

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <span
                          className="status"
                          style={{
                            fontSize: "11px",
                            opacity: 0.7,
                          }}
                        >
                          Mover a...
                        </span>

                        <select
                          value={getOrderStage(order)}
                          onChange={(e) =>
                            handleStageChange(order.id, e.target.value)
                          }
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid var(--line)",
                            fontSize: "12px",
                            backgroundColor: "#fff",
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                        >
                          {ORDER_STAGES.map((stageOption) => (
                            <option key={stageOption} value={stageOption}>
                              {stageOption}
                            </option>
                          ))}
                        </select>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
