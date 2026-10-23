import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "No autorizado. Inicia sesión como administradora.",
      },
      { status: 401 },
    );
  }

  const adminUserId = process.env.SUPABASE_ADMIN_USER_ID;

  if (!adminUserId || user.id !== adminUserId) {
    return NextResponse.json(
      {
        success: false,
        error: "No tienes permisos de administradora.",
      },
      { status: 403 },
    );
  }

  return null;
}
function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

function emptyMonth(month: string) {
  return {
    month,
    ventas: 0,
    delivery: 0,
    ingresosTotales: 0,
    costos: 0,
    gastos: 0,
    reinversion: 0,
    retirosNicole: 0,
    gananciaBruta: 0,
    gananciaNeta: 0,
    reinversionGanancia: 0,
    gananciaNicole: 0,
    pedidos: 0,
  };
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = await createClient();

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(
        "id, order_number, paid_at, subtotal_usd, delivery_fee_usd, order_items ( quantity, unit_price_usd, unit_cost_usd )",
      )
      .not("paid_at", "is", null)
      .order("paid_at", { ascending: false });

    if (ordersError) throw ordersError;

    const { data: movements, error: movementsError } = await supabase
      .from("financial_movements")
      .select("*")
      .order("movement_date", { ascending: false });

    if (movementsError) throw movementsError;

    const monthly = new Map<string, ReturnType<typeof emptyMonth>>();

    const getMonth = (key: string) => {
      if (!monthly.has(key)) {
        monthly.set(key, emptyMonth(key));
      }
      return monthly.get(key)!;
    };

    // Ingresos y costos de pedidos pagados.
    for (const order of orders || []) {
      if (!order.paid_at) continue;

      const bucket = getMonth(monthKey(order.paid_at));

      const costoPedido = (order.order_items || []).reduce(
        (sum: number, item: any) =>
          sum + Number(item.unit_cost_usd || 0) * Number(item.quantity || 0),
        0,
      );

      bucket.ventas += Number(order.subtotal_usd || 0);
      bucket.delivery += Number(order.delivery_fee_usd || 0);
      bucket.costos += costoPedido;
      bucket.pedidos += 1;
    }

    // Movimientos registrados manualmente.
    for (const movement of movements || []) {
      const bucket = getMonth(monthKey(movement.movement_date));
      const amount = Number(movement.amount_usd || 0);

      if (movement.category === "gasto") {
        bucket.gastos += amount;
      } else if (movement.category === "reinversion") {
        bucket.reinversion += amount;
      } else if (movement.category === "retiro_nicole") {
        bucket.retirosNicole += amount;
      }
    }

    // Cálculos de ingresos y distribución de ganancias.
    for (const bucket of monthly.values()) {
      bucket.ingresosTotales = bucket.ventas + bucket.delivery;

      bucket.gananciaBruta = bucket.ingresosTotales - bucket.costos;

      bucket.gananciaNeta = bucket.gananciaBruta - bucket.gastos;

      // El reparto se calcula únicamente sobre ganancias positivas.
      const baseDistribucion = Math.max(0, bucket.gananciaNeta);

      bucket.reinversionGanancia = baseDistribucion * 0.3;

      bucket.gananciaNicole = baseDistribucion * 0.7;
    }

    const monthlyList = Array.from(monthly.values()).sort((a, b) =>
      b.month.localeCompare(a.month),
    );

    return NextResponse.json({
      success: true,
      monthly: monthlyList,
      movements: movements || [],
    });
  } catch (error: any) {
    console.error("Error GET /api/finances:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Error al consultar finanzas",
      },
      { status: 500 },
    );
  }
}

const VALID_CATEGORIES = ["gasto", "reinversion", "retiro_nicole"];

export async function POST(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const { category, description, amountUSD, movementDate } = body;

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { success: false, error: "Categoría no válida" },
        { status: 400 },
      );
    }

    if (!description || !String(description).trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "La descripción es requerida",
        },
        { status: 400 },
      );
    }

    const amount = Number(amountUSD);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "El monto debe ser mayor a 0",
        },
        { status: 400 },
      );
    }

    const date = movementDate || new Date().toISOString().split("T")[0];

    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: "Fecha no válida" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("financial_movements")
      .insert({
        category,
        description: String(description).trim(),
        amount_usd: amount,
        movement_date: date,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, movement: data },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Error POST /api/finances:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "No se pudo guardar el movimiento",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Falta el id del movimiento",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("financial_movements")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error DELETE /api/finances:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "No se pudo eliminar el movimiento",
      },
      { status: 500 },
    );
  }
}
