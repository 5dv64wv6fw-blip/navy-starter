import type { ReactNode } from "react";

import { AdminOrdersProvider } from "@/lib/admin-orders-context";
import LogoutButton from "./LogoutButton";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminOrdersProvider>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "10px 20px 0",
        }}
      >
        <LogoutButton />
      </div>
      {children}
    </AdminOrdersProvider>
  );
}
