export type OrderStatus = "Active" | "Cancelled";

export type PaymentStatus = "Pending" | "Confirmed" | "Rejected";

export type PreparationStatus = "Pending" | "Packed";

export type DeliveryStatus =
  | "Pending"
  | "Coordinated"
  | "On the way"
  | "Delivered";

// Una prenda dentro de un pedido
export interface OrderItem {
  name: string;
  color: string;
  size: string;
  quantity: number;
  unitPriceUSD: number;
  totalPriceUSD: number;
  unitCostUSD?: number;
}

export interface Order {
  id: string;
  name: string;

  // Estado general del pedido
  orderStatus: OrderStatus;

  // Estado del pago
  paymentStatus: PaymentStatus;

  // Estado de preparación
  preparationStatus: PreparationStatus;

  // Estado de entrega
  deliveryStatus: DeliveryStatus;

  // Información del pedido
  detail: string;

  // Información de entrega
  deliveryTime?: string;
  zone?: string;

  // Detalles completos (vienen de la base de datos)
  phone?: string;
  address?: string;
  referencePoint?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt?: string;
  subtotalUSD?: number;
  deliveryFeeUSD?: number;
  totalUSD?: number;
  items?: OrderItem[];
}

export const initialOrders: Order[] = [
  {
    id: "NVY-1048",
    name: "María González",

    orderStatus: "Active",
    paymentStatus: "Pending",
    preparationStatus: "Pending",
    deliveryStatus: "Pending",

    detail: "2 items · $80",
  },

  {
    id: "NVY-1047",
    name: "Valentina Rodríguez",

    orderStatus: "Active",
    paymentStatus: "Confirmed",
    preparationStatus: "Pending",
    deliveryStatus: "Pending",

    detail: "1 item · $42",
  },

  {
    id: "NVY-1046",
    name: "Sofía Pérez",

    orderStatus: "Active",
    paymentStatus: "Confirmed",
    preparationStatus: "Packed",
    deliveryStatus: "Coordinated",

    detail: "3 items · $120",

    deliveryTime: "Sept 5 · 4–6 PM",
    zone: "Chacao",
  },
];
