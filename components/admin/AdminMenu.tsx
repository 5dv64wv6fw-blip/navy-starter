"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Inicio", href: "/admin" },
  { label: "Inventory", href: "/admin/inventory" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Finances", href: "/admin/finances" },
  { label: "Homepage", href: "/admin/homepage" },
];

export default function AdminMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node))
        setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const active = (href: string) =>
    href === "/admin"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div
      ref={root}
      style={{ position: "relative", display: "inline-flex", zIndex: 50 }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          border: "1px solid #d9d9d9",
          borderRadius: 999,
          padding: "10px 15px",
          background: "#fff",
          color: "#172b4d",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <span>Menú admin</span>
        <span aria-hidden="true" style={{ fontSize: 10 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <nav
          role="menu"
          aria-label="Navegación de administración"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 190,
            padding: 6,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            boxShadow: "0 12px 32px rgba(15,23,42,.14)",
          }}
        >
          {items.map((item) => {
            const selected = active(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                aria-current={selected ? "page" : undefined}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "11px 12px",
                  borderRadius: 9,
                  textDecoration: "none",
                  color: selected ? "#fff" : "#172b4d",
                  background: selected ? "#172b4d" : "transparent",
                  fontSize: 14,
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {" "}
                {item.label}{" "}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
