
"use client";

import React from "react";
import Link from "next/link";
import AdminMenu from "@/components/admin/AdminMenu";

import { type Order } from "@/lib/orders";
import { useAdminOrders } from "@/lib/admin-orders-context";

// ---------------------------------------
// FECHA ACTUAL EN ZONA HORARIA DE CARACAS
// ---------------------------------------

const CARACAS_TIMEZONE = "America/Caracas";

function getCaracasDateKey(dateString?: string) {
  if (!dateString) return "";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CARACAS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function isCancelledOrder(order: Order) {
  return ["cancelled", "cancelado"].includes(
    String(order.orderStatus || "").toLowerCase(),
  );
}

export default function Admin() {
  const { orders, setOrders } = useAdminOrders();

  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: CARACAS_TIMEZONE,
  };

  const currentDate = new Date().toLocaleDateString("en-US", dateOptions);

  const todayCaracas = getCaracasDateKey(new Date().toISOString());

  // ---------------------------------------
  // DECIDIMOS QUÉ PEDIDOS NECESITAN ATENCIÓN
  // ---------------------------------------

  const attentionOrders = orders.filter((order) => {
    if (isCancelledOrder(order)) {
      return false;
    }

    if (order.paymentStatus === "Pending") {
      return true;
    }

    if (
      order.paymentStatus === "Confirmed" &&
      order.preparationStatus === "Pending"
    ) {
      return true;
    }

    if (order.deliveryStatus === "Coordinated") {
      return true;
    }

    if (order.deliveryStatus === "On the way") {
      return true;
    }

    return false;
  });

  // ---------------------------------------
  // SABER QUÉ ACCIÓN NECESITA CADA PEDIDO
  // ---------------------------------------

  const getAttentionType = (order: Order) => {
    if (order.paymentStatus === "Pending") {
      return "payment";
    }

    if (
      order.paymentStatus === "Confirmed" &&
      order.preparationStatus === "Pending"
    ) {
      return "preparation";
    }

    if (order.deliveryStatus === "Coordinated") {
      return "delivery";
    }

    if (order.deliveryStatus === "On the way") {
      return "completed";
    }

    return "none";
  };

  // ---------------------------------------
  // TEXTO DE LA PRÓXIMA ACCIÓN
  // ---------------------------------------

  const getActionText = (order: Order) => {
    const type = getAttentionType(order);

    switch (type) {
      case "payment":
        return "Confirm payment";

      case "preparation":
        return "Mark as packed";

      case "delivery":
        return "Mark as on the way";

      case "completed":
        return "Confirm delivery";

      default:
        return "";
    }
  };

  // ---------------------------------------
  // TEXTO DE LA TAREA
  // ---------------------------------------

  const getTaskText = (order: Order) => {
    const type = getAttentionType(order);

    switch (type) {
      case "payment":
        return "Payment needs to be confirmed";

      case "preparation":
        return "Order needs to be packed";

      case "delivery":
        return "Delivery is coordinated and ready to go";

      case "completed":
        return "Delivery is currently on the way";

      default:
        return "";
    }
  };

  // ---------------------------------------
  // CAMBIAR ESTADO DESDE HOME
  // ---------------------------------------

  const handleOrderAction = async (order: Order) => {
    const type = getAttentionType(order);

    let update: Partial<Order> = {};

    if (type === "payment") {
      update = {
        paymentStatus: "Confirmed",
      };
    }

    if (type === "preparation") {
      update = {
        preparationStatus: "Packed",
      };
    }

    if (type === "delivery") {
      update = {
        deliveryStatus: "On the way",
      };
    }

    if (type === "completed") {
      update = {
        deliveryStatus: "Delivered",
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
          orderId: order.id,
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

      setOrders((prevOrders) =>
        prevOrders.map((currentOrder) =>
          currentOrder.id === order.id ? data.order : currentOrder,
        ),
      );
    } catch (error) {
      console.error("Error actualizando pedido:", error);
    }
  };

  // ---------------------------------------
  // ENTREGAS COORDINADAS
  // ---------------------------------------

  const todaysDeliveries = orders.filter((order) => {
    return (
      !isCancelledOrder(order) &&
      order.deliveryStatus === "Coordinated"
    );
  });

  // ---------------------------------------
  // QUICK STATS
  // ---------------------------------------

  const newOrders = orders.filter(
    (order) =>
      !isCancelledOrder(order) && order.paymentStatus === "Pending",
  ).length;

  const paymentsPending = orders.filter(
    (order) =>
      !isCancelledOrder(order) && order.paymentStatus === "Pending",
  ).length;

  const deliveriesToday = todaysDeliveries.length;

  // ---------------------------------------
  // BUSINESS TODAY
  // ---------------------------------------

  // Solo pedidos de hoy, con pago confirmado y no cancelados.
  const confirmedPaidToday = orders.filter((order) => {
    return (
      !isCancelledOrder(order) &&
      order.paymentStatus === "Confirmed" &&
      getCaracasDateKey(order.createdAt) === todayCaracas
    );
  });

  // Ventas = prendas + delivery.
  const salesToday = confirmedPaidToday.reduce((sum, order) => {
    const subtotal = Number(order.subtotalUSD || 0);
    const delivery = Number(order.deliveryFeeUSD || 0);

    return sum + subtotal + delivery;
  }, 0);

  // Ganancia = subtotal - costo de prendas + delivery.
  const profitToday = confirmedPaidToday.reduce((sum, order) => {
    const subtotal = Number(order.subtotalUSD || 0);
    const delivery = Number(order.deliveryFeeUSD || 0);

    const garmentCost = (order.items || []).reduce((itemSum, item) => {
      const unitCost = Number(item.unitCostUSD || 0);
      const quantity = Number(item.quantity || 0);

      return itemSum + unitCost * quantity;
    }, 0);

    return sum + subtotal - garmentCost + delivery;
  }, 0);

  const ordersToday = confirmedPaidToday.length;

  const formatUSD = (amount: number) =>
    `$${amount.toFixed(2)}`;

  return (
    <main className="admin-shell">
      {/* ---------------------------------------
          HEADER
      --------------------------------------- */}

      <header
        className="admin-top"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "center",
          }}
        >
          <Link className="admin-logo" href="/admin">
            NAVY ADMIN
          </Link>

          <div style={{ position: "relative" }}>
            <AdminMenu />
          </div>
        </div>

        <span
          className="status"
          style={{
            textTransform: "capitalize",
            fontSize: "11px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {currentDate}
        </span>
      </header>

      {/* ---------------------------------------
          MAIN
      --------------------------------------- */}

      <div className="admin-main">
        <div className="admin-title">
          <h1>Good morning, Nicole</h1>

          <span className="muted">
            What needs your attention today?
          </span>
        </div>

        {/* ---------------------------------------
            QUICK STATS
        --------------------------------------- */}

        <section className="stats">
          <div className="stat">
            <span className="status">New orders</span>
            <b>{newOrders}</b>
          </div>

          <div className="stat">
            <span className="status">Payments pending</span>
            <b>{paymentsPending}</b>
          </div>

          <div className="stat">
            <span className="status">Deliveries today</span>
            <b>{deliveriesToday}</b>
          </div>
        </section>

        {/* ---------------------------------------
            NEEDS YOUR ATTENTION
        --------------------------------------- */}

        <div className="section-label">
          Needs your attention · {attentionOrders.length}
        </div>

        {attentionOrders.length === 0 ? (
          <article className="todo">
            <div className="order-title">
              You're all caught up ✨
            </div>

            <div className="status">
              No orders need your attention right now.
            </div>
          </article>
        ) : (
          attentionOrders.map((order) => (
            <article className="todo" key={order.id}>
              <div className="todo-head">
                <div>
                  <div className="order-title">
                    {order.id} · {order.name}
                  </div>

                  <div className="status">
                    Payment: {order.paymentStatus}
                  </div>
                </div>

                <strong>{order.detail.split("·").at(-1)}</strong>
              </div>

              <div className="todo-meta">
                {getTaskText(order)}
              </div>

              <div className="todo-actions">
                <button
                  className="admin-btn"
                  onClick={() => handleOrderAction(order)}
                >
                  {getActionText(order)}
                </button>

                <Link
                  href="/admin/orders"
                  className="admin-btn secondary"
                  style={{
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  View order
                </Link>
              </div>
            </article>
          ))
        )}

        {/* ---------------------------------------
            TODAY'S DELIVERIES
        --------------------------------------- */}

        <div className="section-label">
          Today's deliveries
        </div>

        {todaysDeliveries.length === 0 ? (
          <article className="todo">
            <div className="status">
              No deliveries scheduled for today.
            </div>
          </article>
        ) : (
          todaysDeliveries.map((order) => (
            <article className="todo" key={order.id}>
              <div className="todo-head">
                <div>
                  <div className="order-title">
                    {order.deliveryTime || "Time pending"} · {order.id} ·{" "}
                    {order.name}
                  </div>

                  <div className="status">
                    Payment: {order.paymentStatus}
                  </div>
                </div>

                <span className="status">
                  {order.zone || "Zone pending"}
                </span>
              </div>
            </article>
          ))
        )}

        {/* ---------------------------------------
            BUSINESS TODAY
        --------------------------------------- */}

        <div className="section-label">
          Business today
        </div>

        <section className="stats">
          <div className="stat">
            <span className="status">Sales</span>
            <b>{formatUSD(salesToday)}</b>
          </div>

          <div className="stat">
            <span className="status">Orders</span>
            <b>{ordersToday}</b>
          </div>

          <div className="stat">
            <span className="status">Profit</span>
            <b>{formatUSD(profitToday)}</b>
          </div>
        </section>
      </div>
    </main>
  );
}
