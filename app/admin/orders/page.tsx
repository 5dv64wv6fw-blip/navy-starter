"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AdminMenu from "@/components/admin/AdminMenu";

import { type Order } from "@/lib/orders";
import { useAdminOrders } from "@/lib/admin-orders-context";

/*
  Campos extra que la API devuelve en cada pedido (ver mapOrder en /api/orders).
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
  Estados que verá Nicole dentro de Orders.
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

// Cada cuánto revisamos si llegó un pedido nuevo
const POLL_INTERVAL_MS = 30000;

/*
  Determina automáticamente en qué etapa se encuentra cada pedido.
*/
const getOrderStage = (order: Order): string => {
  if (order.orderStatus === "Cancelled") return "Cancelado";
  if (order.paymentStatus === "Pending") return "Pago pendiente";
  if (order.paymentStatus === "Rejected") return "Pago pendiente";
  if (order.preparationStatus === "Pending") return "Pendiente de empacar";
  if (
    order.preparationStatus === "Packed" &&
    order.deliveryStatus === "Pending"
  ) {
    return "Entrega pendiente";
  }
  if (order.deliveryStatus === "Coordinated") return "Coordinada";
  if (order.deliveryStatus === "On the way") return "En camino";
  if (order.deliveryStatus === "Delivered") return "Entregado";
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

// Fecha (AAAA-MM-DD) en hora de Venezuela, a partir de una marca UTC
const caracasDay = (iso?: string): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

// Convierte un teléfono venezolano (0412...) en enlace de WhatsApp (58412...)
const whatsappLink = (phone: string) => {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `58${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
};

// Sonido corto generado en el navegador (no necesita archivos)
function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Si el navegador bloquea el audio, seguimos sin sonido
  }
}

// Escapa un valor para CSV (comillas si tiene ; comillas o saltos de línea)
const csvCell = (value: unknown) => {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export default function OrdersPage() {
  const { orders, setOrders } = useAdminOrders();

  // Guardamos setOrders en una ref para que el intervalo no se reinicie en cada render
  const setOrdersRef = useRef(setOrders);
  setOrdersRef.current = setOrders;

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  // Avisos de pedidos nuevos
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const alertsRef = useRef(false);
  const seenIdsRef = useRef<Set<string> | null>(null);
  const originalTitleRef = useRef("");

  // Exportación por mes
  const [exportMonth, setExportMonth] = useState("");

  const toggleDetails = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  /*
    AVISOS: revisa la API cada 30 segundos.
    La primera vez solo guarda los pedidos que ya existen,
    para no avisar de pedidos viejos al abrir la página.
  */
  useEffect(() => {
    let cancelled = false;

    const notifyNewOrders = (newOnes: ExtendedOrder[]) => {
      playBeep();

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification("Nuevo pedido en Navy", {
          body: newOnes.map((o) => `${o.id} · ${o.name}`).join("\n"),
          icon: "/navy-logo.png",
        });
      }
    };

    const checkOrders = async () => {
      try {
        const res = await fetch("/api/orders", { cache: "no-store" });
        if (!res.ok) return;

        const data = await res.json();
        if (!data.success || cancelled) return;

        const incoming = data.orders as ExtendedOrder[];

        // Mantenemos la lista al día (cambios de estado hechos desde otro lugar)
        setOrdersRef.current(incoming);

        const seen = seenIdsRef.current;

        if (seen === null) {
          seenIdsRef.current = new Set(incoming.map((o) => o.id));
          return;
        }

        const newOnes = incoming.filter((o) => !seen.has(o.id));
        if (newOnes.length === 0) return;

        newOnes.forEach((o) => seen.add(o.id));
        setNewOrdersCount((c) => c + newOnes.length);

        if (alertsRef.current) notifyNewOrders(newOnes);
      } catch {
        // Si falla una revisión, la siguiente vuelve a intentarlo
      }
    };

    checkOrders();
    const timer = setInterval(checkOrders, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Muestra el número de pedidos nuevos en la pestaña del navegador
  useEffect(() => {
    if (!originalTitleRef.current) {
      originalTitleRef.current = document.title;
    }
    document.title =
      newOrdersCount > 0
        ? `(${newOrdersCount}) ${originalTitleRef.current}`
        : originalTitleRef.current;
  }, [newOrdersCount]);

  // Se llama con un clic: pide permiso de notificaciones y desbloquea el sonido
  const enableAlerts = async () => {
    try {
      if (
        typeof Notification !== "undefined" &&
        Notification.permission !== "granted"
      ) {
        await Notification.requestPermission();
      }
    } catch {
      // Sin permiso seguimos con el aviso visual y el sonido
    }

    playBeep();
    alertsRef.current = true;
    setAlertsEnabled(true);
  };

  /*
    Meses disponibles para exportar (a partir de los pedidos cargados)
  */
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    (orders as ExtendedOrder[]).forEach((o) => {
      const key = caracasDay(o.createdAt).slice(0, 7);
      if (key) set.add(key);
    });
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [orders]);

  // Por defecto, el mes más reciente
  useEffect(() => {
    if (!exportMonth && monthOptions.length > 0) {
      setExportMonth(monthOptions[0]);
    }
  }, [monthOptions, exportMonth]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("es-VE", {
      month: "long",
      year: "numeric",
    });
  };

  /*
    EXPORTAR: genera un CSV (abre directamente en Excel) con una fila por prenda.
    Usa ";" como separador y BOM UTF-8 para que Excel en español muestre bien las tildes.
  */
  const exportToExcel = () => {
    if (!exportMonth) {
      alert("Selecciona un mes para exportar.");
      return;
    }

    const monthOrders = (orders as ExtendedOrder[]).filter(
      (o) => caracasDay(o.createdAt).slice(0, 7) === exportMonth,
    );

    if (monthOrders.length === 0) {
      alert("No hay pedidos en ese mes.");
      return;
    }

    const headers = [
      "Pedido",
      "Fecha",
      "Clienta",
      "Teléfono",
      "Entrega",
      "Dirección",
      "Referencia",
      "Método de pago",
      "Estado pago",
      "Estado pedido",
      "Prenda",
      "Color",
      "Talla",
      "Cantidad",
      "Precio unitario USD",
      "Total prenda USD",
      "Subtotal USD",
      "Delivery USD",
      "Total pedido USD",
      "Notas",
    ];

    const lines: string[] = [headers.map(csvCell).join(";")];

    for (const o of monthOrders) {
      const base = [
        o.id,
        fmtDateTime(o.createdAt),
        o.name,
        o.phone || "",
        o.address ? "Delivery" : "Pick Up",
        o.address || "",
        o.referencePoint || "",
        o.paymentMethod || "",
        o.paymentStatus,
        o.orderStatus === "Cancelled" ? "Cancelado" : o.orderStatus,
      ];

      const tail = [
        o.subtotalUSD ?? "",
        o.deliveryFeeUSD ?? "",
        o.totalUSD ?? "",
        o.notes || "",
      ];

      const items = o.items || [];

      if (items.length === 0) {
        lines.push([...base, "", "", "", "", "", "", ...tail].map(csvCell).join(";"));
        continue;
      }

      for (const item of items) {
        lines.push(
          [
            ...base,
            item.name,
            item.color || "",
            item.size || "",
            item.quantity,
            item.unitPriceUSD ?? "",
            item.totalPriceUSD ?? "",
            ...tail,
          ]
            .map(csvCell)
            .join(";"),
        );
      }
    }

    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pedidos-${exportMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  /*
    Cambia la parte correcta del pedido
    dependiendo de la etapa seleccionada.
  */
  const handleStageChange = async (orderId: string, newStage: string) => {
    let deliveryTime = "";

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

    if (newStage === "Pago pendiente") {
      update = { orderStatus: "Active", paymentStatus: "Pending" };
    }

    if (newStage === "Pago confirmado") {
      update = { orderStatus: "Active", paymentStatus: "Confirmed" };
    }

    if (newStage === "Pendiente de empacar") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
        preparationStatus: "Pending",
      };
    }

    if (newStage === "Empacado") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
        preparationStatus: "Packed",
      };
    }

    if (newStage === "Entrega pendiente") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
        preparationStatus: "Packed",
        deliveryStatus: "Pending",
        deliveryTime: "",
      };
    }

    if (newStage === "Coordinada") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
        preparationStatus: "Packed",
        deliveryStatus: "Coordinated",
        deliveryTime,
      };
    }

    if (newStage === "En camino") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
        preparationStatus: "Packed",
        deliveryStatus: "On the way",
      };
    }

    if (newStage === "Entregado") {
      update = {
        orderStatus: "Active",
        paymentStatus: "Confirmed",
        preparationStatus: "Packed",
        deliveryStatus: "Delivered",
      };
    }

    // OJO: la base de datos guarda "Cancelled"; la etiqueta que ves es "Cancelado"
    if (newStage === "Cancelado") {
      update = { orderStatus: "Cancelled" };
    }

    if (Object.keys(update).length === 0) return;

    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, ...update }),
      });

      if (!response.ok) {
        throw new Error("Error al actualizar pedido");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al actualizar pedido");
      }

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
  const filteredOrders = (orders as ExtendedOrder[]).filter((order) => {
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
          gap: 12,
          flexWrap: "wrap",
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

        <button
          className="admin-btn secondary"
          onClick={enableAlerts}
          disabled={alertsEnabled}
        >
          {alertsEnabled ? "Avisos activos" : "Activar avisos de pedidos"}
        </button>
      </header>

      {/* MAIN */}

      <div className="admin-main">
        <div className="admin-title">
          <h1>Order Management</h1>

          <span className="muted">Controla el flujo de cada pedido</span>
        </div>

        {/* AVISO DE PEDIDOS NUEVOS */}

        {newOrdersCount > 0 && (
          <div
            role="status"
            onClick={() => setNewOrdersCount(0)}
            style={{
              margin: "16px 0",
              padding: "12px 16px",
              borderRadius: 8,
              background: "#18333a",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            🛍️ Tienes {newOrdersCount} pedido(s) nuevo(s). Toca aquí para
            cerrar este aviso.
          </div>
        )}

        {/* EXPORTAR POR MES */}

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
            margin: "16px 0",
            padding: 12,
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 13 }}>Exportar pedidos del mes:</span>

          <select
            value={exportMonth}
            onChange={(e) => setExportMonth(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              fontSize: 13,
              background: "#fff",
            }}
          >
            {monthOptions.length === 0 && <option value="">Sin pedidos</option>}
            {monthOptions.map((key) => (
              <option key={key} value={key}>
                {monthLabel(key)}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="admin-btn"
            onClick={exportToExcel}
            disabled={monthOptions.length === 0}
          >
            Descargar Excel (CSV)
          </button>
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

          if (ordersInThisStage.length === 0) return null;

          return (
            <div key={stage} style={{ marginBottom: "32px" }}>
              {/* SECTION TITLE */}

              <div
                className="section-label"
                style={{ display: "flex", justifyContent: "space-between" }}
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
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
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
                        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
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
                                    <th style={{ textAlign: "right" }}>Total</th>
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
                          style={{ fontSize: "11px", opacity: 0.7 }}
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
