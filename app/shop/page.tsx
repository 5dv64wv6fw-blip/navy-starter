"use client";

import Link from "next/link";
import React, { useState, useEffect, useMemo } from "react";
import {
  calculatePricing,
  InventoryItem,
  Rates,
  flattenProducts,
} from "@/lib/inventory";

// Helper para normalizar nombres y slugs
function safeDecode(str: string): string {
  if (!str) return "";
  let decoded = str;
  try {
    for (let i = 0; i < 3; i++) {
      if (decoded.includes("%")) {
        const temp = decodeURIComponent(decoded);
        if (temp === decoded) break;
        decoded = temp;
      }
    }
  } catch (e) {
    console.error("Error decodificando:", e);
  }
  return decoded;
}

function normalizeSlug(str: string): string {
  if (!str) return "";
  const decoded = safeDecode(str);
  return decoded
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getBaseProductName(fullName: string): string {
  if (!fullName) return "";
  return fullName
    .replace(/\s*[\(\[\{]?(XS|S|M|L|XL|Única|Unica)[\]\}\)]?\s*$/i, "")
    .replace(/\s*-\s*(XS|S|M|L|XL|Única|Unica)$/i, "")
    .trim();
}

function parsePrice(priceVal: unknown): number {
  if (typeof priceVal === "number") return priceVal;
  if (!priceVal) return 0;
  const cleaned = String(priceVal)
    .replace(/[^0-9.,]/g, "")
    .replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// Estructura para la tarjeta del catálogo agrupado
interface GroupedProduct {
  slug: string;
  name: string;
  category: string;
  mainImage: string;
  hoverImage?: string;
  minPrice: number;
  totalStock: number;
  colors: string[];
}

export default function ShopAllPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [rates, setRates] = useState<Rates>({ tasaBCV: 85, tasaBNC: 100 });
  const [loading, setLoading] = useState<boolean>(true);

  // Filtros
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"featured" | "low-high" | "high-low">(
    "featured",
  );

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const res = await fetch("/api/inventory", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          // Convertimos "producto con variantes" en filas planas (una por color/talla)
          setItems(
            flattenProducts(data.products || []) as unknown as InventoryItem[],
          );
          if (data.rates) setRates(data.rates);
        }
      } catch (err) {
        console.error("Error cargando inventario:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, []);

  // Agrupar variantes por prenda base
  const groupedProducts = useMemo(() => {
    const map = new Map<string, GroupedProduct>();

    items.forEach((item) => {
      const rawItem = item as any;
      if (rawItem.webVisible === false) return;

      const baseName = getBaseProductName(rawItem.name || "Producto");
      const slug = normalizeSlug(baseName);
      const price = parsePrice(rawItem.price);
      const color = rawItem.color as string;
      const category = (rawItem.category as string) || "Tops";

      const existing = map.get(slug);

      if (existing) {
        existing.totalStock += Number(rawItem.stock || 0);
        if (price < existing.minPrice && price > 0) existing.minPrice = price;
        if (color && !existing.colors.includes(color))
          existing.colors.push(color);
        if (!existing.hoverImage && rawItem.images && rawItem.images[1]) {
          existing.hoverImage = rawItem.images[1];
        }
      } else {
        const images = rawItem.images || [];
        map.set(slug, {
          slug,
          name: baseName,
          category,
          mainImage: images[0] || "",
          hoverImage: images[1] || undefined,
          minPrice: price,
          totalStock: Number(rawItem.stock || 0),
          colors: color ? [color] : [],
        });
      }
    });

    return Array.from(map.values());
  }, [items]);

  // Lista de categorías disponibles para la barra de filtro
  const categories = useMemo(() => {
    const set = new Set<string>();
    groupedProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["All", ...Array.from(set)];
  }, [groupedProducts]);

  // Filtrado y Ordenamiento
  const filteredProducts = useMemo(() => {
    let result = [...groupedProducts];

    if (selectedCategory !== "All") {
      result = result.filter(
        (p) => p.category.toLowerCase() === selectedCategory.toLowerCase(),
      );
    }

    if (sortBy === "low-high") {
      result.sort((a, b) => a.minPrice - b.minPrice);
    } else if (sortBy === "high-low") {
      result.sort((a, b) => b.minPrice - a.minPrice);
    }

    return result;
  }, [groupedProducts, selectedCategory, sortBy]);

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--cream)",
        paddingBottom: "80px",
      }}
    >
      {/* Espaciador superior */}
      <div style={{ height: "40px" }}></div>

      <section className="section" style={{ paddingTop: "20px" }}>
        {/* Botón para regresar a Home */}
        <div style={{ marginBottom: "20px" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              textDecoration: "none",
              color: "#666",
              fontSize: "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontWeight: 500,
              transition: "color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#111")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#666")}
          >
            ← Volver al inicio
          </Link>
        </div>

        {/* Cabecera de la sección */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#888",
              marginBottom: "8px",
            }}
          >
            Collection
          </p>
          <h1
            style={{
              fontFamily: "'Gowun Batang', serif",
              fontSize: "clamp(32px, 5vw, 52px)",
              margin: 0,
              fontWeight: 400,
            }}
          >
            Shop All
          </h1>
        </div>

        {/* Barra de Filtros y Ordenamiento */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            borderTop: "1px solid #e5e3dc",
            borderBottom: "1px solid #e5e3dc",
            padding: "16px 0",
            marginBottom: "40px",
          }}
        >
          {/* Categorías */}
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "13px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  color: selectedCategory === cat ? "#111" : "#888",
                  fontWeight: selectedCategory === cat ? 600 : 400,
                  borderBottom:
                    selectedCategory === cat
                      ? "1px solid #111"
                      : "1px solid transparent",
                  paddingBottom: "2px",
                  transition: "all 0.2s",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Selector de Ordenamiento */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "12px",
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Ordenar:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "13px",
                fontFamily: "inherit",
                cursor: "pointer",
                outline: "none",
                padding: "4px",
              }}
            >
              <option value="featured">Destacados</option>
              <option value="low-high">Precio: Menor a Mayor</option>
              <option value="high-low">Precio: Mayor a Menor</option>
            </select>
          </div>
        </div>

        {/* Estado de Carga */}
        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 0",
              color: "#888",
              fontSize: "14px",
            }}
          >
            Cargando piezas...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 0",
              color: "#888",
              fontSize: "14px",
            }}
          >
            No encontramos productos en esta categoría.
          </div>
        ) : (
          /* Grid de Productos */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              columnGap: "24px",
              rowGap: "48px",
            }}
          >
            {filteredProducts.map((product) => {
              const pricing = calculatePricing(product.minPrice, rates);
              const isSoldOut = product.totalStock <= 0;

              return (
                <Link
                  key={product.slug}
                  href={`/product/${product.slug}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "block",
                  }}
                >
                  <div className="product-card" style={{ cursor: "pointer" }}>
                    {/* Marco de Imagen con Soporte para Hover */}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: "3/4",
                        backgroundColor: "#eceae5",
                        borderRadius: "3px",
                        overflow: "hidden",
                        marginBottom: "16px",
                      }}
                    >
                      {product.mainImage ? (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            backgroundImage: `url(${product.mainImage})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            transition:
                              "opacity 0.3s ease, transform 0.4s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (product.hoverImage) {
                              e.currentTarget.style.backgroundImage = `url(${product.hoverImage})`;
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundImage = `url(${product.mainImage})`;
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#aa9",
                            fontSize: "12px",
                            letterSpacing: "0.15em",
                          }}
                        >
                          NAVY EDITORIAL
                        </div>
                      )}

                      {/* Badge de Agotado */}
                      {isSoldOut && (
                        <div
                          style={{
                            position: "absolute",
                            top: "12px",
                            right: "12px",
                            backgroundColor: "rgba(17, 17, 17, 0.85)",
                            color: "#fff",
                            fontSize: "10px",
                            textTransform: "uppercase",
                            letterSpacing: "0.1em",
                            padding: "4px 8px",
                            borderRadius: "2px",
                          }}
                        >
                          Sold Out
                        </div>
                      )}
                    </div>

                    {/* Información de la Prenda */}
                    <div>
                      <h3
                        style={{
                          fontFamily: "'Gowun Batang', serif",
                          fontSize: "18px",
                          fontWeight: 400,
                          margin: "0 0 6px",
                          lineHeight: 1.2,
                        }}
                      >
                        {product.name}
                      </h3>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <span style={{ fontSize: "15px", fontWeight: 600 }}>
                          ${pricing.priceBCVFormatted}
                        </span>
                        <span style={{ fontSize: "12px", color: "#888" }}>
                          Bs. {pricing.priceBsFormatted}
                        </span>
                      </div>

                      <div style={{ fontSize: "11px", color: "#2e6b32" }}>
                        <strong>{pricing.discountPercent}% off cash:</strong> $
                        {pricing.cashUSDFormatted}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
