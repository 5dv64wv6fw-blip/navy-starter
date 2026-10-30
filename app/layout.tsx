
import "./globals.css";
import type { Metadata } from "next";
import { CartProvider } from "./context/CartContext";
import CartDrawer from "./components/CartDrawer";

export const metadata: Metadata = {
  title: "Navy Clothing Store",
  description: "European coastal clothing for the Navy girl.",
  icons: {
    icon: "/icon.svg",
  },
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
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
