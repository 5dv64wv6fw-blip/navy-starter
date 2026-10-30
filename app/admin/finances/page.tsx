
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminMenu from "@/components/admin/AdminMenu";

interface MonthSummary {
  month: string;
  ventas: number;
  delivery: number;
  costos: number;
  gastos: number;
  reinversion: number;
  retirosNicole: number;
  gananciaBruta: number;
  gananciaNeta: number;
  pedidos: number;
}

interface Movement {
  id: string;
  category: "gasto" | "reinversion" | "retiro_nicole";
  description: string;
  amount_usd: number;
  movement_date: string;
}

const categoryLabels: Record<Movement["category"], string> = {
  gasto: "Gasto",
  reinversion: "Reinversión",
  retiro_nicole: "Pago a Nicole",
};

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("es-VE", {
    month: "long",
    year: "numeric",
  });
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

export default function FinancesPage() {
  const [monthly, setMonthly] = useState<MonthSummary[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());

  const [category, setCategory] =
    useState<Movement["category"]>("gasto");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [movementDate, setMovementDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [isSaving, setIsSaving] = useState(false);

  const loadFinances = async () => {
    try {
      const res = await fetch("/api/finances", {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "No se pudieron cargar las finanzas",
        );
      }

      setMonthly(data.monthly || []);
      setMovements(data.movements || []);
    } catch (error) {
      console.error("Error cargando finanzas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinances();
  }, []);

  // Meses con datos, más el mes actual aunque todavía no tenga nada.
  const availableMonths = useMemo(() => {
    const keys = new Set(monthly.map((m) => m.month));
    keys.add(currentMonthKey());

    return Array.from(keys).sort((a, b) =>
      b.localeCompare(a),
    );
  }, [monthly]);

  const currentSummary: MonthSummary = monthly.find(
    (m) => m.month === selectedMonth,
  ) || {
    month: selectedMonth,
    ventas: 0,
    delivery: 0,
    costos: 0,
    gastos: 0,
    reinversion: 0,
    retirosNicole: 0,
    gananciaBruta: 0,
    gananciaNeta: 0,
    pedidos: 0,
  };

  const monthMovements = movements.filter(
    (m) => m.movement_date.slice(0, 7) === selectedMonth,
  );

  const addMovement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !description.trim() ||
      amount === "" ||
      Number(amount) <= 0
    ) {
      alert("Completa la descripción y un monto mayor a 0.");
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch("/api/finances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          description: description.trim(),
          amountUSD: Number(amount),
          movementDate,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "No se pudo guardar el movimiento",
        );
      }

      setDescription("");
      setAmount("");
      await loadFinances();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el movimiento",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteMovement = async (id: string) => {
    if (!confirm("¿Eliminar este movimiento?")) return;

    try {
      const res = await fetch(
        `/api/finances?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo eliminar");
      }

      await loadFinances();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar",
      );
    }
  };

  return (
    <main
      style={{
        padding: 20,
        maxWidth: 1000,
        margin: "0 auto",
        fontFamily: "sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20,
          borderBottom: "1px solid #eee",
          paddingBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <Link
            href="/admin"
            style={{
              fontWeight: 700,
              fontSize: 18,
              textDecoration: "none",
              color: "#18333a",
            }}
          >
            NAVY ADMIN
          </Link>
          <AdminMenu />
        </div>
      </header>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <h1 style={{ fontSize: 24, margin: 0 }}>
          Finanzas
        </h1>

        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            ...inputStyle,
            width: "auto",
            marginTop: 0,
          }}
        >
          {availableMonths.map((key) => (
            <option key={key} value={key}>
              {monthLabel(key)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "#888" }}>Cargando...</p>
      ) : (
        <>
          {/* RESUMEN DEL MES */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(150px,1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <Card
              label="Ventas de prendas"
              value={currentSummary.ventas}
            />
            <Card
              label="Delivery cobrado"
              value={currentSummary.delivery}
            />
            <Card
              label="Costos"
              value={currentSummary.costos}
              negative
            />
            <Card
              label="Ganancia bruta"
              value={currentSummary.gananciaBruta}
              highlight
            />
            <Card
              label="Gastos"
              value={currentSummary.gastos}
              negative
            />
            <Card
              label="Ganancia neta"
              value={currentSummary.gananciaNeta}
              highlight
            />
            <Card
              label="Reinversión"
              value={currentSummary.reinversion}
              muted
            />
            <Card
              label="Pagos a Nicole"
              value={currentSummary.retirosNicole}
              muted
            />
          </div>

          {/* AGREGAR MOVIMIENTO */}
          <section
            style={{
              border: "1px solid #eee",
              borderRadius: 10,
              padding: 16,
              marginBottom: 24,
              background: "#faf9f6",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                fontSize: 15,
              }}
            >
              Registrar gasto, reinversión o pago a Nicole
            </h3>

            <form
              onSubmit={addMovement}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(150px,1fr))",
                gap: 10,
                alignItems: "end",
              }}
            >
              <div>
                <label style={labelStyle}>
                  Categoría
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value as Movement["category"],
                    )
                  }
                  style={inputStyle}
                >
                  <option value="gasto">Gasto</option>
                  <option value="reinversion">
                    Reinversión
                  </option>
                  <option value="retiro_nicole">
                    Pago a Nicole
                  </option>
                </select>
              </div>

              <div style={{ gridColumn: "span 2" }}>
                <label style={labelStyle}>
                  Descripción
                </label>
                <input
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="Ej. Publicidad Instagram"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Monto USD
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) =>
                    setAmount(
                      e.target.value === ""
                        ? ""
                        : Number(e.target.value),
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Fecha
                </label>
                <input
                  type="date"
                  value={movementDate}
                  onChange={(e) =>
                    setMovementDate(e.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                style={{
                  padding: "9px 16px",
                  border: 0,
                  borderRadius: 6,
                  background: "#18333a",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: isSaving
                    ? "default"
                    : "pointer",
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? "Guardando..." : "Agregar"}
              </button>
            </form>
          </section>

          {/* MOVIMIENTOS DEL MES */}
          <section>
            <h3 style={{ fontSize: 15 }}>
              Movimientos de {monthLabel(selectedMonth)}
            </h3>

            {monthMovements.length === 0 ? (
              <p
                style={{
                  color: "#888",
                  fontSize: 13,
                }}
              >
                No hay movimientos registrados este mes.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {monthMovements.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      border: "1px solid #eee",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          background: "#eee",
                          padding: "2px 6px",
                          borderRadius: 4,
                          marginRight: 8,
                        }}
                      >
                        {categoryLabels[m.category]}
                      </span>

                      {m.description}

                      <span
                        style={{
                          color: "#999",
                          marginLeft: 8,
                        }}
                      >
                        {m.movement_date}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <strong>
                        ${Number(m.amount_usd).toFixed(2)}
                      </strong>

                      <button
                        onClick={() => deleteMovement(m.id)}
                        style={{
                          border: "1px solid #ffcdd2",
                          color: "#d32f2f",
                          background: "#fff",
                          borderRadius: 5,
                          padding: "4px 8px",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Card({
  label,
  value,
  negative,
  highlight,
  muted,
}: {
  label: string;
  value: number;
  negative?: boolean;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        background: highlight ? "#eef3f3" : "#fff",
        border: "1px solid #eee",
        borderRadius: 8,
        padding: 14,
      }}
    >
      <small style={{ color: "#777" }}>
        {label}
      </small>

      <strong
        style={{
          display: "block",
          fontSize: 18,
          marginTop: 4,
          color: muted
            ? "#888"
            : negative
              ? "#d32f2f"
              : "#18333a",
        }}
      >
        {negative && value > 0 ? "-" : ""}$
        {value.toFixed(2)}
      </strong>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: 13,
  marginTop: 5,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#555",
};
