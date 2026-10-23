export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string | null;
  reference_point: string | null;
  gps_link: string | null;
  zone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;

  order_status: string;
  payment_status: string;
  preparation_status: string;
  delivery_status: string;

  subtotal_usd: number;
  delivery_fee_usd: number;
  total_usd: number;

  payment_method: string | null;
  delivery_time: string | null;
  zone: string | null;
  payment_reference: string | null;
  payment_proof_url: string | null;
  notes: string | null;

  created_at: string;
  updated_at: string;
}
export interface Order {
  id: string;
  order_number: string;
  customer_id: string;

  // Estados
  order_status: string;
  payment_status: string;
  preparation_status: string;
  delivery_status: string;

  // Montos
  subtotal_usd: number;
  delivery_fee_usd: number;
  total_usd: number;

  // Detalles logísticos y de pago
  payment_method: string | null;
  delivery_time: string | null;
  zone: string | null;
  payment_reference: string | null;
  payment_proof_url: string | null;
  notes: string | null;

  // Fechas
  created_at: string;
  updated_at: string;
}
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  color: string;
  size: string;
  sku: string;
  quantity: number;
  unit_price_usd: number;
  total_price_usd: number;
  created_at: string;
}
