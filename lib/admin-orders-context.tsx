"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { type Order } from "@/lib/orders";

interface AdminOrdersContextType {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

const AdminOrdersContext = createContext<AdminOrdersContextType | undefined>(
  undefined,
);

export function AdminOrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const pathname = usePathname();

  // En /admin/login todavía no hay sesión, así que la API
  // respondería 401. No tiene sentido pedir los pedidos ahí.
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) return;

    async function loadOrders() {
      try {
        const response = await fetch("/api/orders");

        if (!response.ok) {
          // 1. Leemos el cuerpo como texto plano UNA SOLA VEZ
          const rawText = await response.text();
          let detalleError = rawText;

          // 2. Intentamos parsear el texto a JSON si aplica
          try {
            const errorData = JSON.parse(rawText);
            detalleError =
              errorData.message || errorData.error || JSON.stringify(errorData);
          } catch {
            // Si no es JSON (es HTML o texto plano), conserva el rawText
          }

          // 3. Imprimimos el mensaje formateado como string para ver el detalle real en pantalla
          console.error(
            `[API Error ${response.status} ${response.statusText}]: ${detalleError}`,
          );

          throw new Error(
            `Error HTTP ${response.status}: ${response.statusText || "Fallo en la API"}`,
          );
        }

        const data = await response.json();

        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
        } else if (Array.isArray(data.orders)) {
          setOrders(data.orders);
        } else if (Array.isArray(data)) {
          setOrders(data);
        }
      } catch (error) {
        console.error("Error cargando pedidos:", error);
      }
    }

    loadOrders();
  }, [isLoginPage]);

  return (
    <AdminOrdersContext.Provider
      value={{
        orders,
        setOrders,
      }}
    >
      {children}
    </AdminOrdersContext.Provider>
  );
}

export function useAdminOrders() {
  const context = useContext(AdminOrdersContext);

  if (!context) {
    throw new Error("useAdminOrders must be used inside AdminOrdersProvider");
  }

  return context;
}
