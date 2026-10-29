"use client";

import React, { createContext, useContext, useState } from "react";

export interface CartItem {
  id: string | number;
  name: string;
  price: string | number;
  dollarPrice?: number;
  size: string;
  color?: string;
  quantity: number;
  image?: string;
  /** Unidades disponibles en inventario para esta variante (límite de compra) */
  maxStock?: number;
}

export interface CartContextType {
  cart: CartItem[];
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string | number, size?: string) => void;
  updateQuantity: (
    id: string | number,
    size: string | undefined,
    quantity: number,
  ) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Ajusta una cantidad al máximo permitido por el inventario
function capQuantity(quantity: number, maxStock?: number): number {
  if (maxStock === undefined || maxStock === null) return quantity;
  return Math.max(0, Math.min(quantity, maxStock));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const addToCart = (newItem: CartItem) => {
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex(
        (item) => item.id === newItem.id && item.size === newItem.size,
      );

      if (existingIndex > -1) {
        const current = prevCart[existingIndex];
        const limit = newItem.maxStock ?? current.maxStock;
        const nextQuantity = capQuantity(
          current.quantity + (newItem.quantity || 1),
          limit,
        );

        const updated = [...prevCart];
        updated[existingIndex] = {
          ...current,
          quantity: nextQuantity,
          maxStock: limit,
        };
        return updated;
      }

      const initialQuantity = capQuantity(
        newItem.quantity || 1,
        newItem.maxStock,
      );

      // Si no hay stock, no se agrega nada
      if (initialQuantity <= 0) return prevCart;

      return [...prevCart, { ...newItem, quantity: initialQuantity }];
    });
    openCart();
  };

  const removeFromCart = (id: string | number, size?: string) => {
    setCart((prevCart) =>
      prevCart.filter((item) => !(item.id === id && item.size === size)),
    );
  };

  const updateQuantity = (
    id: string | number,
    size: string | undefined,
    quantity: number,
  ) => {
    if (quantity <= 0) {
      removeFromCart(id, size);
      return;
    }

    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id !== id || item.size !== size) return item;

        return {
          ...item,
          quantity: capQuantity(quantity, item.maxStock),
        };
      }),
    );
  };

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider
      value={{
        cart,
        isCartOpen,
        openCart,
        closeCart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    return {
      cart: [],
      isCartOpen: false,
      openCart: () => {},
      closeCart: () => {},
      addToCart: () => {},
      removeFromCart: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
    };
  }
  return context;
}
