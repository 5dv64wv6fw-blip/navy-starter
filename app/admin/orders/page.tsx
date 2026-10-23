"use client";

import React, { useState } from "react";
import Link from "next/link";
import AdminMenu from "@/components/admin/AdminMenu";

import { type Order } from "@/lib/orders";
import { useAdminOrders } from "@/lib/admin-orders-context";

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

export default function OrdersPage() {
  const { orders, setOrders } = useAdminOrders();
  const [searchTerm, setSearchTerm] = useState("");
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
    Pedido cancelado
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
                  const isCancelled = order.orderStatus === "Cancelled";

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
                        <span
                          className="status"
                          style={{
                            fontSize: "11px",
                          }}
                        >
                          Payment: {order.paymentStatus}
                        </span>

                        <span
                          className="status"
                          style={{
                            fontSize: "11px",
                          }}
                        >
                          Preparation: {order.preparationStatus}
                        </span>

                        <span
                          className="status"
                          style={{
                            fontSize: "11px",
                          }}
                        >
                          Delivery: {order.deliveryStatus}
                        </span>
                      </div>

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
                            backgroundColor: "var(--cream)",
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
