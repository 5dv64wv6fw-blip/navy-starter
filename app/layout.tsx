import "./globals.css";
import type { Metadata } from "next";
import { CartProvider } from "./context/CartContext";
import CartDrawer from "./components/CartDrawer"; // <-- 1. Importamos el cajón

export const metadata: Metadata = {
  title: "Navy Clothing Store",
  description: "European coastal clothing for the Navy girl.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <CartProvider>
          {children}
          <CartDrawer />{" "}
          {/* <-- 2. Lo colocamos aquí para que viva en toda la web */}
        </CartProvider>
      </body>
    </html>
  );
}
