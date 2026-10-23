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
        const updated = [...prevCart];
        updated[existingIndex].quantity += newItem.quantity || 1;
        return updated;
      }
      return [...prevCart, { ...newItem, quantity: newItem.quantity || 1 }];
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
      prevCart.map((item) =>
        item.id === id && item.size === size ? { ...item, quantity } : item,
      ),
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
