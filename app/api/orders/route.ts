import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getPriceNumbers } from "@/lib/inventory";

// Qué columnas (y tablas relacionadas) pedimos a Supabase por cada orden
const ORDER_SELECT = `
  *,
  customers ( first_name, last_name, phone, address, reference_point ),
  order_items ( product_name, color, size, quantity, unit_price_usd, total_price_usd )
`;

// Estado del panel que significa "pedido cancelado"
const CANCELLED_STATUS = "Cancelado";

/*
  Convierte una fila de la base de datos en el objeto que usa el panel.
  GET y PATCH usan esta MISMA función, así el pedido siempre llega completo.
*/
function mapOrder(order: any) {
  const customer = Array.isArray(order.customers)
    ? order.customers[0]
    : order.customers;

  const orderItems = Array.isArray(order.order_items) ? order.order_items : [];
  const total = Number(order.total_usd || order.total || 0);

  const customerName = customer?.first_name
    ? `${customer.first_name} ${customer.last_name || ""}`.trim()
    : "Sin nombre";

  return {
    id: order.order_number || order.id,
    databaseId: order.id,
    name: customerName,
    orderStatus: order.order_status || "Active",
    paymentStatus: order.payment_status || "Pending",
    preparationStatus: order.preparation_status || "Pending",
    deliveryStatus: order.delivery_status || "Pending",
    detail: `${orderItems.length} items · $${total}`,
    deliveryTime: order.delivery_time || "",
    zone: order.zone || "",

    // Detalles del pedido
    phone: customer?.phone || "",
    address: customer?.address || "",
    referencePoint: customer?.reference_point || "",
    paymentMethod: order.payment_method || "",
    notes: order.notes || "",
    createdAt: order.created_at || "",
    subtotalUSD: Number(order.subtotal_usd || 0),
    deliveryFeeUSD: Number(order.delivery_fee_usd || 0),
    totalUSD: total,
    items: orderItems.map((item: any) => ({
      name: item.product_name,
      color: item.color,
      size: item.size,
      quantity: Number(item.quantity || 0),
      unitPriceUSD: Number(item.unit_price_usd || 0),
      totalPriceUSD: Number(item.total_price_usd || 0),
    })),
  };
}

/*
  Comprueba que quien llama a este endpoint inició sesión como admin.
  Se usa en GET y PATCH (leer y cambiar estados de pedidos), pero NO
  en POST: el checkout de la tienda lo usa cualquier clienta sin sesión.
*/
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

  return null;
}

// Cliente con permisos de servidor. Solo se crea aquí, nunca llega al navegador.
function getAdminDb() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Configuración del servidor incompleta");
  }

  return createAdminClient(supabaseUrl, serviceKey);
}

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = await createClient();

    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("🚨 [ERROR SUPABASE GET /api/orders]:", ordersError);
      return NextResponse.json(
        {
          success: false,
          error: ordersError.message,
          code: ordersError.code,
          details: ordersError.details || ordersError.hint,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      orders: (ordersData || []).map(mapOrder),
    });
  } catch (error: any) {
    console.error("🚨 [ERROR FATAL SERVIDOR /api/orders]:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message || "Error interno del servidor al obtener pedidos",
      },
      { status: 500 },
    );
  }
}

/*
  RESERVA: descuenta del stock disponible las prendas de un pedido recién
  creado. Se ejecuta una sola vez por pedido (stock_reserved).
  Si alguna variante no tiene stock suficiente en este momento, lanza error
  y el pedido se deshace.
*/
async function reserveStockForOrder(db: any, orderDatabaseId: string) {
  const { data: items, error: itemsError } = await db
    .from("order_items")
    .select("variant_id, quantity, product_name, size")
    .eq("order_id", orderDatabaseId);

  if (itemsError) throw itemsError;

  // Descontamos cada variante. Usamos una validación de stock antes de restar.
  for (const item of items || []) {
    if (!item.variant_id) continue;

    const { data: variant, error: variantError } = await db
      .from("product_variants")
      .select("id, stock")
      .eq("id", item.variant_id)
      .single();

    if (variantError || !variant) {
      throw new Error(`No se encontró la talla de ${item.product_name}.`);
    }

    const stockActual = Number(variant.stock || 0);
    const cantidad = Number(item.quantity || 0);

    if (stockActual < cantidad) {
      throw new Error(
        `Ya no hay suficiente stock de ${item.product_name} (${item.size}).`,
      );
    }

    const { error: updateError } = await db
      .from("product_variants")
      .update({ stock: stockActual - cantidad })
      .eq("id", variant.id);

    if (updateError) throw updateError;
  }

  const { error: flagError } = await db
    .from("orders")
    .update({ stock_reserved: true })
    .eq("id", orderDatabaseId);

  if (flagError) throw flagError;
}

/*
  LIBERACIÓN: devuelve al stock disponible las prendas de un pedido cancelado.
  Se ejecuta una sola vez por pedido (stock_released), así nunca se suma dos veces.
*/
async function releaseStockForOrder(db: any, orderDatabaseId: string) {
  const { data: items, error: itemsError } = await db
    .from("order_items")
    .select("variant_id, quantity")
    .eq("order_id", orderDatabaseId);

  if (itemsError) throw itemsError;

  for (const item of items || []) {
    if (!item.variant_id) continue;

    const { data: variant, error: variantError } = await db
      .from("product_variants")
      .select("id, stock")
      .eq("id", item.variant_id)
      .single();

    if (variantError || !variant) {
      console.error("Variante no encontrada al liberar stock:", variantError);
      continue;
    }

    const { error: updateError } = await db
      .from("product_variants")
      .update({
        stock: Number(variant.stock || 0) + Number(item.quantity || 0),
      })
      .eq("id", variant.id);

    if (updateError) throw updateError;
  }

  const { error: flagError } = await db
    .from("orders")
    .update({ stock_released: true })
    .eq("id", orderDatabaseId);

  if (flagError) throw flagError;
}

export async function PATCH(request: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();

    const {
      orderId,
      paymentStatus,
      preparationStatus,
      deliveryStatus,
      orderStatus,
      deliveryTime,
      zone,
    } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Falta el parámetro orderId" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const updates: Record<string, unknown> = {};

    if (orderStatus !== undefined) updates.order_status = orderStatus;
    if (paymentStatus !== undefined) updates.payment_status = paymentStatus;
    if (preparationStatus !== undefined)
      updates.preparation_status = preparationStatus;
    if (deliveryStatus !== undefined) updates.delivery_status = deliveryStatus;
    if (deliveryTime !== undefined) updates.delivery_time = deliveryTime;
    if (zone !== undefined) updates.zone = zone;

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("orders")
      .update(updates)
      .eq("order_number", orderId)
      .select(ORDER_SELECT)
      .single();

    if (error) {
      console.error("🚨 [ERROR SUPABASE PATCH /api/orders]:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 },
      );
    }

    // Si el pedido se cancela y su stock estaba reservado y aún no se liberó,
    // devolvemos las prendas al inventario disponible.
    if (
      data.order_status === CANCELLED_STATUS &&
      data.stock_reserved &&
      !data.stock_released
    ) {
      const db = getAdminDb();
      await releaseStockForOrder(db, data.id);
      data.stock_released = true;
    }

    return NextResponse.json({
      success: true,
      order: mapOrder(data),
    });
  } catch (error: any) {
    console.error("🚨 [ERROR FATAL PATCH /api/orders]:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Error al actualizar pedido",
      },
      { status: 500 },
    );
  }
}

// ========================================================
// POST: Crear un pedido nuevo desde el checkout de la web
// ========================================================

// Métodos de pago permitidos (los mismos que ofrece el checkout)
const PAYMENT_METHODS = [
  "Pago Móvil",
  "Zinli",
  "Dólares en efectivo",
  "Binance",
];

// Costo de delivery en USD (más adelante lo calcularemos por zona)
const DELIVERY_FEE_USD = 5;

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(request: Request) {
  let db: any;
  try {
    db = getAdminDb();
  } catch {
    return NextResponse.json(
      { success: false, error: "Configuración del servidor incompleta" },
      { status: 500 },
    );
  }

  let createdOrderId: string | null = null;

  try {
    const body = await request.json();

    // 1. Leer y limpiar lo que envía el navegador
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const phone = String(body.phone ?? "").replace(/[^\d+]/g, "");
    const deliveryType =
      body.deliveryType === "delivery" ? "delivery" : "pickup";
    const address = String(body.address ?? "").trim();
    const itemsPayment = String(body.itemsPayment ?? "");
    const deliveryPayment = String(body.deliveryPayment ?? "");
    const changeAmount = String(body.changeAmount ?? "").trim();
    const rawItems = Array.isArray(body.items) ? body.items : [];

    // 2. Validaciones básicas
    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: "Nombre y apellido son requeridos" },
        { status: 400 },
      );
    }
    if (phone.replace("+", "").length < 7) {
      return NextResponse.json(
        { success: false, error: "El teléfono no es válido" },
        { status: 400 },
      );
    }
    if (!PAYMENT_METHODS.includes(itemsPayment)) {
      return NextResponse.json(
        { success: false, error: "Método de pago no válido" },
        { status: 400 },
      );
    }
    if (
      deliveryType === "delivery" &&
      !PAYMENT_METHODS.includes(deliveryPayment)
    ) {
      return NextResponse.json(
        { success: false, error: "Método de pago del delivery no válido" },
        { status: 400 },
      );
    }
    if (deliveryType === "delivery" && !address) {
      return NextResponse.json(
        { success: false, error: "La dirección es requerida para delivery" },
        { status: 400 },
      );
    }
    if (rawItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "El carrito está vacío" },
        { status: 400 },
      );
    }

    // 3. Agrupar cantidades por variante (del navegador solo aceptamos id y cantidad)
    const qtyByVariant = new Map<string, number>();
    for (const item of rawItems) {
      const quantity = Math.floor(Number(item?.quantity));
      if (
        !item?.variantId ||
        !Number.isFinite(quantity) ||
        quantity < 1 ||
        quantity > 20
      ) {
        return NextResponse.json(
          { success: false, error: "Hay una prenda con datos no válidos" },
          { status: 400 },
        );
      }
      const id = String(item.variantId);
      // Sumamos las cantidades repetidas de la misma variante antes de validar stock
      qtyByVariant.set(id, (qtyByVariant.get(id) || 0) + quantity);
    }

    // 4. Buscar cada variante en TU inventario (precios y datos reales)
    const { data: variants, error: variantsError } = await db
      .from("product_variants")
      .select(
        "id, product_id, color, size, sku, stock, products ( id, name, dollar_price, cost_usd, show_web, is_archived )",
      )
      .in("id", Array.from(qtyByVariant.keys()));

    if (variantsError) throw variantsError;

    const variantsById = new Map<string, any>(
      (variants || []).map((v: any) => [v.id, v]),
    );

    // 5. Armar las líneas del pedido con precios calculados por el servidor
    const lines: any[] = [];
    for (const [variantId, quantity] of qtyByVariant.entries()) {
      const variant = variantsById.get(variantId);
      const product = Array.isArray(variant?.products)
        ? variant.products[0]
        : variant?.products;

      if (
        !variant ||
        !product ||
        product.is_archived ||
        product.show_web === false
      ) {
        return NextResponse.json(
          { success: false, error: "Una de las prendas ya no está disponible" },
          { status: 409 },
        );
      }

      // Validación previa de stock (la validación definitiva se hace al reservar)
      const stockReal = Number(variant.stock || 0);
      if (stockReal < quantity) {
        return NextResponse.json(
          {
            success: false,
            error:
              stockReal > 0
                ? `Solo quedan ${stockReal} unidad(es) de ${product.name} (${variant.size || "única"}).`
                : `${product.name} (${variant.size || "única"}) ya está agotado.`,
          },
          { status: 409 },
        );
      }

      const unitPrice = Number(product.dollar_price || 0);

      lines.push({
        product_id: product.id,
        variant_id: variant.id,
        product_name: product.name,
        color: variant.color || "Único",
        size: variant.size || "Única",
        sku: variant.sku || "SIN-SKU",
        quantity,
        unit_price_usd: unitPrice,
        unit_cost_usd: Number(product.cost_usd || 0),
        total_price_usd: round2(unitPrice * quantity),
      });
    }

    // 6. Totales en USD (precios exactos)
    const subtotalUSD = round2(
      lines.reduce((sum, l) => sum + l.total_price_usd, 0),
    );
    const deliveryFeeUSD = deliveryType === "delivery" ? DELIVERY_FEE_USD : 0;
    const totalUSD = round2(subtotalUSD + deliveryFeeUSD);

    // 7. Tasas guardadas en el panel, para dejar registrado el monto en Bs
    const { data: settings } = await db
      .from("store_settings")
      .select("tasa_bnc, tasa_bcv")
      .limit(1)
      .maybeSingle();

    const rates = {
      tasaBNC: Number(settings?.tasa_bnc) || 1000,
      tasaBCV: Number(settings?.tasa_bcv) || 745,
    };

    const itemsBs = lines.reduce(
      (sum, l) =>
        sum + getPriceNumbers(l.unit_price_usd, rates).publishedBs * l.quantity,
      0,
    );
    const deliveryBs = deliveryFeeUSD * rates.tasaBCV;

    const describeAmount = (method: string, usd: number, bs: number) =>
      method === "Pago Móvil" ? `Bs. ${bs.toFixed(2)}` : `$${usd.toFixed(2)}`;

    const notes = [
      `Entrega: ${deliveryType === "delivery" ? "Delivery" : "Pick Up"}`,
      `Pago prendas: ${itemsPayment} (${describeAmount(itemsPayment, subtotalUSD, itemsBs)})`,
      deliveryType === "delivery"
        ? `Pago delivery: ${deliveryPayment} (${describeAmount(deliveryPayment, deliveryFeeUSD, deliveryBs)})`
        : address
          ? `Nota pick up: ${address}`
          : null,
      changeAmount ? `Vuelto: ${changeAmount}` : null,
      `Tasas: BCV ${rates.tasaBCV} · BNC ${rates.tasaBNC}`,
    ]
      .filter(Boolean)
      .join(" | ");

    // 8. Cliente: si ya existe ese teléfono lo reutilizamos, si no lo creamos
    const { data: existingCustomers, error: findError } = await db
      .from("customers")
      .select("id")
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(1);

    if (findError) throw findError;

    let customerId: string;
    const customerFields = {
      first_name: firstName,
      last_name: lastName,
      phone,
      ...(deliveryType === "delivery" && address ? { address } : {}),
    };

    if (existingCustomers && existingCustomers.length > 0) {
      customerId = existingCustomers[0].id;
      const { error: updateError } = await db
        .from("customers")
        .update({ ...customerFields, updated_at: new Date().toISOString() })
        .eq("id", customerId);
      if (updateError) throw updateError;
    } else {
      const { data: newCustomer, error: insertCustomerError } = await db
        .from("customers")
        .insert(customerFields)
        .select("id")
        .single();
      if (insertCustomerError || !newCustomer)
        throw insertCustomerError || new Error("No se pudo crear el cliente");
      customerId = newCustomer.id;
    }

    // 9. Crear la orden (el número NVY-#### lo genera la base de datos)
    const { data: order, error: orderError } = await db
      .from("orders")
      .insert({
        customer_id: customerId,
        subtotal_usd: subtotalUSD,
        delivery_fee_usd: deliveryFeeUSD,
        total_usd: totalUSD,
        payment_method: itemsPayment,
        notes,
      })
      .select("id, order_number")
      .single();

    if (orderError || !order)
      throw orderError || new Error("No se pudo crear la orden");
    createdOrderId = order.id;

    // 10. Guardar las prendas de la orden
    const { error: itemsError } = await db
      .from("order_items")
      .insert(lines.map((l) => ({ ...l, order_id: order.id })));

    if (itemsError) throw itemsError;

    // 11. RESERVA: descontamos el stock ahora, para que nadie más lo compre
    await reserveStockForOrder(db, order.id);

    return NextResponse.json(
      {
        success: true,
        orderNumber: order.order_number,
        subtotalUSD,
        deliveryFeeUSD,
        totalUSD,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("🚨 [ERROR POST /api/orders]:", error);

    // Si la orden se creó pero falló algo después (prendas o reserva),
    // la eliminamos. Como la reserva puede haber restado stock de algunas
    // variantes, devolvemos esas unidades antes de borrar el pedido.
    if (createdOrderId) {
      const { data: savedOrder } = await db
        .from("orders")
        .select("stock_reserved")
        .eq("id", createdOrderId)
        .maybeSingle();

      if (savedOrder?.stock_reserved) {
        await releaseStockForOrder(db, createdOrderId).catch((e: unknown) =>
          console.error("Error liberando stock tras fallo:", e),
        );
      }

      await db.from("order_items").delete().eq("order_id", createdOrderId);
      await db.from("orders").delete().eq("id", createdOrderId);
    }

    return NextResponse.json(
      { success: false, error: error?.message || "No se pudo crear el pedido" },
      { status: 500 },
    );
  }
}
