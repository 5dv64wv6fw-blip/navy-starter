"use server";

import { createClient } from "@supabase/supabase-js";

// Para acciones de servidor sencillas que no requieren leer cookies (como esta prueba),
// podemos usar el cliente estándar de Supabase.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

export async function createTestOrder() {
  try {
    // 1. Crear el cliente de prueba
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        first_name: "Cliente",
        last_name: "Prueba Navy",
        phone: "0414-0000000",
        zone: "Caracas", // Dato opcional según tu estructura
      })
      .select()
      .single();

    if (customerError)
      throw new Error(`Error creando cliente: ${customerError.message}`);

    // 2. Crear la orden vinculada al ID de ese cliente
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: customer.id,
        subtotal_usd: 45.0,
        delivery_fee_usd: 5.0,
        total_usd: 50.0,
        order_status: "Active",
        payment_status: "Pending",
        notes: "Primera prueba de conexión exitosa",
      })
      .select()
      .single();

    if (orderError)
      throw new Error(`Error creando orden: ${orderError.message}`);

    // Retornamos la orden para ver el número generado (NVY-XXXX)
    return { success: true, order };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: error.message };
  }
}
