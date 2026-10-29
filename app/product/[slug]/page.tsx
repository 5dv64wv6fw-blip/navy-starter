"use client";

import Link from "next/link";

import React, { useState, useEffect, use } from "react";

import { useCart } from "../../context/CartContext";

import {
  calculatePricing,
  InventoryItem,
  Rates,
  flattenProducts,
} from "@/lib/inventory";

// Extension local de InventoryItem para incluir propiedades de variante opcionales

interface ColorPhoto {
  id?: string;
  product_id?: string;
  color: string;
  url: string;
  position_x?: number;
  position_y?: number;
  sort_order?: number;
}

interface ProductVariant extends InventoryItem {
  size?: string;

  color?: string;

  stock?: number | string;

  details?: string;

  description?: string;
}

// Mapa de colores para mostrar los círculos de muestra (swatches)

const COLOR_MAP: Record<string, string> = {
  negro: "#111111",

  black: "#111111",

  blanco: "#ffffff",

  white: "#ffffff",

  "off-white": "#f8f7f2",

  offwhite: "#f8f7f2",

  gris: "#8e8e8e",

  gray: "#8e8e8e",

  grey: "#8e8e8e",

  navy: "#1b2b42",

  "azul marino": "#1b2b42",

  azul: "#2b4c7e",

  blue: "#2b4c7e",

  beige: "#f5f2eb",

  arena: "#dcdacb",

  crema: "#fbf9f1",

  marrón: "#5c4033",

  marron: "#5c4033",

  brown: "#5c4033",

  rosa: "#e8c4c4",

  pink: "#e8c4c4",

  verde: "#3d5240",

  green: "#3d5240",
};

// 1. Decodificación segura de URLs

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
    console.error("Error decodificando el slug:", e);
  }

  return decoded;
}

// 2. Normalización de cadenas para comparaciones

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

// 3. Extraer el nombre base quitando la talla y color al final

function getBaseProductName(fullName: string): string {
  if (!fullName) return "";

  return fullName

    .replace(/\s*[\(\[\{]?(XS|S|M|L|XL|Única|Unica)[\]\}\)]?\s*$/i, "")

    .replace(/\s*-\s*(XS|S|M|L|XL|Única|Unica)$/i, "")

    .trim();
}

// 4. Convertir precios a número puro

function parsePrice(priceVal: any): number {
  if (typeof priceVal === "number") return priceVal;

  if (!priceVal) return 0;

  const cleaned = String(priceVal)
    .replace(/[^0-9.,]/g, "")

    .replace(",", ".");

  return parseFloat(cleaned) || 0;
}

export default function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);

  const rawSlug = resolvedParams.slug;

  const targetSlug = normalizeSlug(rawSlug);

  const { addToCart } = useCart();

  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const [rates, setRates] = useState<Rates>({ tasaBCV: 85, tasaBNC: 100 });

  const [loading, setLoading] = useState<boolean>(true);

  // Estados de selección

  const [selectedColor, setSelectedColor] = useState<string>("");

  const [selectedSize, setSelectedSize] = useState<string>("");

  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [colorPhotos, setColorPhotos] = useState<ColorPhoto[]>([]);
  const [sizeGuideImages, setSizeGuideImages] = useState<string[]>([]);
  const [careDetails, setCareDetails] = useState<string>("");

  // Acordeones desplegables (incluye 'returns')

  const [openSection, setOpenSection] = useState<
    "details" | "sizeGuide" | "shipping" | "returns" | null
  >("details");

  // Cargar inventario desde la API

  const loadProductData = async () => {
    try {
      const res = await fetch("/api/inventory", { cache: "no-store" });

      if (res.ok) {
        const data = await res.json();

        // Convertimos "producto con variantes" en filas planas (una por color/talla)

        const rawProducts = data.products || [];
        const allProducts = flattenProducts(
          rawProducts,
        ) as unknown as ProductVariant[];

        if (data.rates) setRates(data.rates);

        // Intento 1: Coincidencia directa por ID o Nombre

        let matchingVariants = allProducts.filter((item) => {
          if (item.webVisible === false) return false;

          const itemIdSlug = item.id ? normalizeSlug(String(item.id)) : "";

          const baseName = getBaseProductName(item.name || "");

          const itemNameSlug = normalizeSlug(baseName);

          const itemFullNameSlug = normalizeSlug(item.name || "");

          return (
            itemIdSlug === targetSlug ||
            itemNameSlug === targetSlug ||
            itemFullNameSlug === targetSlug
          );
        });

        // Intento 2 (Fuzzy match)

        if (matchingVariants.length === 0) {
          matchingVariants = allProducts.filter((item) => {
            if (item.webVisible === false) return false;

            const nameSlug = normalizeSlug(item.name || "");

            const idSlug = normalizeSlug(String(item.id || ""));

            return (
              (nameSlug &&
                (targetSlug.includes(nameSlug) ||
                  nameSlug.includes(targetSlug))) ||
              (idSlug &&
                (targetSlug.includes(idSlug) || idSlug.includes(targetSlug)))
            );
          });
        }

        setVariants(matchingVariants);

        const rawProduct =
          rawProducts.find((p: any) => {
            const idSlug = p.id ? normalizeSlug(String(p.id)) : "";
            const nameSlug = normalizeSlug(getBaseProductName(p.name || ""));
            const fullNameSlug = normalizeSlug(p.name || "");
            return (
              idSlug === targetSlug ||
              nameSlug === targetSlug ||
              fullNameSlug === targetSlug
            );
          }) ||
          rawProducts.find((p: any) => {
            const nameSlug = normalizeSlug(getBaseProductName(p.name || ""));
            return (
              nameSlug &&
              (targetSlug.includes(nameSlug) || nameSlug.includes(targetSlug))
            );
          });
        setColorPhotos(
          Array.isArray(rawProduct?.colorPhotos) ? rawProduct.colorPhotos : [],
        );
        setCareDetails(
          String(rawProduct?.careDetails ?? rawProduct?.care_details ?? ""),
        );
        const rawGuideImages =
          rawProduct?.sizeGuideImages ?? rawProduct?.size_guide_images ?? [];
        setSizeGuideImages(
          Array.isArray(rawGuideImages)
            ? rawGuideImages.filter(
                (url: unknown): url is string =>
                  typeof url === "string" && url.trim().length > 0,
              )
            : typeof rawGuideImages === "string" && rawGuideImages.trim()
              ? [rawGuideImages]
              : [],
        );
        setSelectedImageIndex(0);

        // Extraer colores disponibles

        const availableColors = Array.from(
          new Set(
            matchingVariants

              .map((v) => v.color)

              .filter((c): c is string => Boolean(c)),
          ),
        );

        const initialColor = availableColors[0] || "";

        setSelectedColor(initialColor);

        // Filtrar la mejor variante inicial (con stock)

        const variantsForColor = initialColor
          ? matchingVariants.filter((v) => v.color === initialColor)
          : matchingVariants;

        const availableVariant =
          variantsForColor.find((v) => Number(v.stock || 0) > 0) ||
          variantsForColor[0] ||
          matchingVariants[0];

        if (availableVariant?.size) {
          setSelectedSize(availableVariant.size);
        }
      }
    } catch (error) {
      console.error("Error al cargar el producto:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductData();
  }, [rawSlug]);

  // Obtener lista de colores únicos

  const availableColors = Array.from(
    new Set(
      variants.map((v) => v.color).filter((c): c is string => Boolean(c)),
    ),
  );

  // Cambiar de color

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setSelectedImageIndex(0);

    const colorVariants = variants.filter((v) => v.color === color);

    const inStockVariant =
      colorVariants.find((v) => Number(v.stock || 0) > 0) || colorVariants[0];

    if (inStockVariant?.size) {
      setSelectedSize(inStockVariant.size);
    }
  };

  // Filtrar variantes según el color activo

  const activeColorVariants = selectedColor
    ? variants.filter((v) => v.color === selectedColor)
    : variants;

  // Encontrar la variante específica según Color y Talla

  const activeVariant =
    activeColorVariants.find((v) => v.size === selectedSize) ||
    activeColorVariants[0] ||
    variants[0];

  // Nombre base

  const decodedRawName = safeDecode(rawSlug);

  const baseName =
    variants.length > 0
      ? getBaseProductName(variants[0].name)
      : decodedRawName

          .replace(/-/g, " ")

          .replace(/\b\w/g, (l) => l.toUpperCase());

  // Cálculo de precios dinámicos

  const numericPrice = activeVariant ? parsePrice(activeVariant.price) : 0;

  const pricing = calculatePricing(numericPrice, rates);

  // Priorizar fotos específicas del color seleccionado; si no existen,
  // utilizar las fotos generales del producto para mantener compatibilidad.
  const selectedColorPhotos = colorPhotos
    .filter(
      (photo) =>
        photo.color?.trim().toLowerCase() ===
        selectedColor.trim().toLowerCase(),
    )
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  const colorSpecificImages = selectedColorPhotos
    .map((photo) => photo.url)
    .filter(Boolean);
  const activeColorPhoto =
    selectedColorPhotos[
      Math.min(selectedImageIndex, Math.max(selectedColorPhotos.length - 1, 0))
    ];
  const currentImages = Array.from(
    new Set(activeColorVariants.flatMap((v) => v.images || []).filter(Boolean)),
  );
  const allImages =
    colorSpecificImages.length > 0
      ? colorSpecificImages
      : currentImages.length > 0
        ? currentImages
        : Array.from(
            new Set(variants.flatMap((v) => v.images || []).filter(Boolean)),
          );

  const handleAddToCart = () => {
    if (!activeVariant || Number(activeVariant.stock || 0) <= 0) return;

    addToCart({
      id: activeVariant.id || `${targetSlug}-${selectedColor}-${selectedSize}`,

      name: baseName,

      price: `$${pricing.priceBCVFormatted}`,

      dollarPrice: numericPrice,

      size: selectedSize,

      color: selectedColor || undefined,

      image:
        allImages[
          Math.min(selectedImageIndex, Math.max(allImages.length - 1, 0))
        ] ||
        activeVariant.images?.[0] ||
        "",

      quantity: 1,
    } as any);
  };

  const toggleSection = (
    section: "details" | "sizeGuide" | "shipping" | "returns",
  ) => {
    setOpenSection(openSection === section ? null : section);
  };

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",

          backgroundColor: "var(--cream)",

          padding: "120px 24px 40px",
        }}
      >
        <p style={{ textAlign: "center", color: "#888" }}>
          Cargando producto...
        </p>
      </main>
    );
  }

  const isOutOfStock = !activeVariant || Number(activeVariant.stock || 0) <= 0;

  return (
    <main style={{ minHeight: "100vh", backgroundColor: "var(--cream)" }}>
      {/* Espaciador para el navbar */}

      <div style={{ height: "90px" }}></div>

      <section className="section" style={{ paddingTop: "0" }}>
        {/* Breadcrumb de navegación */}

        <Link
          href="/"
          className="muted"
          style={{
            display: "inline-block",

            marginBottom: "40px",

            fontSize: "11px",

            letterSpacing: "0.12em",

            textTransform: "uppercase",

            textDecoration: "none",
          }}
        >
          ← Back to Shop
        </Link>

        {/* Contenedor principal del producto */}

        <div
          style={{
            display: "flex",

            flexWrap: "wrap",

            gap: "48px",

            alignItems: "flex-start",
          }}
        >
          {/* Columna Izquierda: Galería de imágenes */}

          <div style={{ flex: "1 1 400px", maxWidth: "600px" }}>
            <div
              style={{
                width: "100%",

                aspectRatio: "3/4",

                backgroundColor: "#e8e6e1",

                backgroundImage: allImages[
                  Math.min(
                    selectedImageIndex,
                    Math.max(allImages.length - 1, 0),
                  )
                ]
                  ? `url(${allImages[Math.min(selectedImageIndex, Math.max(allImages.length - 1, 0))]})`
                  : "linear-gradient(to bottom right, #e8e6e1, #dcdacb)",

                backgroundSize: "cover",

                backgroundPosition: activeColorPhoto
                  ? `${Number(activeColorPhoto.position_x ?? 50)}% ${Number(activeColorPhoto.position_y ?? 50)}%`
                  : "center",

                display: "flex",

                alignItems: "center",

                justifyContent: "center",

                borderRadius: "4px",

                overflow: "hidden",
              }}
            >
              {allImages.length === 0 && (
                <span
                  style={{
                    letterSpacing: "0.2em",

                    color: "#888",

                    fontSize: "14px",
                  }}
                >
                  NAVY EDITORIAL
                </span>
              )}
            </div>

            {/* Miniaturas de Galería */}

            {allImages.length > 1 && (
              <div
                style={{
                  display: "flex",

                  gap: "12px",

                  marginTop: "16px",

                  overflowX: "auto",
                }}
              >
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    style={{
                      width: "70px",

                      height: "90px",

                      border:
                        selectedImageIndex === idx
                          ? "2px solid #111"
                          : "1px solid #ddd",

                      backgroundImage: `url(${img})`,

                      backgroundSize: "cover",

                      backgroundPosition: "center",

                      cursor: "pointer",

                      padding: 0,

                      borderRadius: "2px",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Columna Derecha: Información y compra */}

          <div style={{ flex: "1 1 400px", paddingTop: "10px" }}>
            <h1
              style={{
                fontFamily: "'Gowun Batang', serif",

                fontSize: "clamp(32px, 4vw, 48px)",

                margin: "0 0 16px",

                lineHeight: 1.1,
              }}
            >
              {baseName}
            </h1>

            {/* Bloque de precios */}

            <div style={{ marginBottom: "24px" }}>
              <div
                style={{ display: "flex", alignItems: "baseline", gap: "12px" }}
              >
                <span style={{ fontSize: "28px", fontWeight: 600 }}>
                  ${pricing.priceBCVFormatted}
                </span>

                <span style={{ fontSize: "15px", color: "#666" }}>
                  Bs. {pricing.priceBsFormatted}
                </span>
              </div>

              {/* Badge Descuento USD */}

              <div
                style={{
                  display: "inline-block",

                  marginTop: "8px",

                  padding: "6px 12px",

                  backgroundColor: "#f5f8f5",

                  borderRadius: "4px",

                  fontSize: "12px",

                  color: "#1e5c22",

                  border: "1px solid #d4e8d5",
                }}
              >
                <strong>{pricing.discountPercent}% off para pagos en $:</strong>{" "}
                ${pricing.cashUSDFormatted}
              </div>
            </div>

            <p
              className="muted"
              style={{
                fontSize: "15px",

                lineHeight: 1.6,

                marginBottom: "32px",

                maxWidth: "450px",
              }}
            >
              {activeVariant?.description ||
                "Pieza atemporal de nuestra colección, diseñada con materiales de alta calidad para acompañarte en tu día a día."}
            </p>

            {/* Selector de Color */}

            {availableColors.length > 0 && (
              <div style={{ marginBottom: "24px", maxWidth: "450px" }}>
                <div style={{ marginBottom: "10px" }}>
                  <span
                    style={{
                      fontSize: "12px",

                      textTransform: "uppercase",

                      letterSpacing: "0.1em",
                    }}
                  >
                    Color: <strong>{selectedColor}</strong>
                  </span>
                </div>

                <div
                  style={{ display: "flex", gap: "12px", alignItems: "center" }}
                >
                  {availableColors.map((color) => {
                    const isSelected = selectedColor === color;

                    const colorHex = COLOR_MAP[color.toLowerCase()] || "#ccc";

                    return (
                      <button
                        key={color}
                        onClick={() => handleColorSelect(color)}
                        title={color}
                        style={{
                          width: "32px",

                          height: "32px",

                          borderRadius: "50%",

                          backgroundColor: colorHex,

                          border: isSelected
                            ? "2px solid #111"
                            : "1px solid #ddd",

                          outline: isSelected ? "2px solid #111" : "none",

                          outlineOffset: "2px",

                          cursor: "pointer",

                          transition: "all 0.2s",

                          padding: 0,

                          boxShadow: "inset 0 0 2px rgba(0,0,0,0.1)",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selector de Tallas Interactivo */}

            <div style={{ marginBottom: "32px", maxWidth: "450px" }}>
              <div
                style={{
                  display: "flex",

                  justifyContent: "space-between",

                  marginBottom: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",

                    textTransform: "uppercase",

                    letterSpacing: "0.1em",
                  }}
                >
                  Talla: <strong>{selectedSize || "Seleccionar"}</strong>
                </span>

                <button
                  onClick={() => toggleSection("sizeGuide")}
                  style={{
                    background: "none",

                    border: "none",

                    fontSize: "12px",

                    textDecoration: "underline",

                    cursor: "pointer",

                    color: "#666",
                  }}
                >
                  Guía de tallas
                </button>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {activeColorVariants.map((v) => {
                  const isSelected = selectedSize === v.size;

                  const outOfStock = Number(v.stock || 0) <= 0;

                  return (
                    <button
                      key={v.id || v.size}
                      onClick={() =>
                        !outOfStock && v.size && setSelectedSize(v.size)
                      }
                      disabled={outOfStock}
                      style={{
                        background: isSelected
                          ? "#111"
                          : outOfStock
                            ? "#f5f5f5"
                            : "transparent",

                        color: isSelected
                          ? "#fff"
                          : outOfStock
                            ? "#aaa"
                            : "#111",

                        border: isSelected
                          ? "1px solid #111"
                          : "1px solid #ccc",

                        padding: "12px 0",

                        width: "65px",

                        cursor: outOfStock ? "not-allowed" : "pointer",

                        fontFamily: "inherit",

                        fontSize: "13px",

                        transition: "all 0.2s",

                        textDecoration: outOfStock ? "line-through" : "none",
                      }}
                      title={outOfStock ? "Agotado" : `Disponibles: ${v.stock}`}
                    >
                      {v.size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botón CTA (Add to Bag) */}

            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="cta"
              style={{
                width: "100%",

                maxWidth: "450px",

                border: "none",

                cursor: isOutOfStock ? "not-allowed" : "pointer",

                textAlign: "center",

                display: "block",

                padding: "18px",

                marginBottom: "40px",

                fontSize: "14px",

                backgroundColor: isOutOfStock ? "#ccc" : "#111",

                color: "#fff",
              }}
            >
              {isOutOfStock ? "Agotado" : "Add to Bag"}
            </button>

            {/* Acordeones Informativos */}

            <div style={{ borderTop: "1px solid #eaeaea", maxWidth: "450px" }}>
              {/* 1. Detalles & Cuidado */}

              <div style={{ borderBottom: "1px solid #eaeaea" }}>
                <button
                  onClick={() => toggleSection("details")}
                  style={{
                    width: "100%",

                    padding: "16px 0",

                    background: "none",

                    border: "none",

                    display: "flex",

                    justifyContent: "space-between",

                    alignItems: "center",

                    cursor: "pointer",

                    fontSize: "13px",

                    textTransform: "uppercase",

                    letterSpacing: "0.1em",

                    fontWeight: 600,
                  }}
                >
                  Detalles & Cuidado
                  <span>{openSection === "details" ? "−" : "+"}</span>
                </button>

                {openSection === "details" && (
                  <div style={{ paddingBottom: "16px" }}>
                    <p
                      className="muted"
                      style={{ fontSize: "14px", lineHeight: 1.6, margin: 0 }}
                    >
                      {careDetails.trim() ||
                        activeVariant?.details ||
                        "Confeccionado en tela de alta durabilidad y textura suave. Lavar a mano o en ciclo delicado con agua fría. Secar a la sombra para mantener la integridad de la fibra."}
                    </p>
                  </div>
                )}
              </div>

              {/* 2. Guía de Tallas */}

              <div style={{ borderBottom: "1px solid #eaeaea" }}>
                <button
                  onClick={() => toggleSection("sizeGuide")}
                  style={{
                    width: "100%",

                    padding: "16px 0",

                    background: "none",

                    border: "none",

                    display: "flex",

                    justifyContent: "space-between",

                    alignItems: "center",

                    cursor: "pointer",

                    fontSize: "13px",

                    textTransform: "uppercase",

                    letterSpacing: "0.1em",

                    fontWeight: 600,
                  }}
                >
                  Guía de Tallas
                  <span>{openSection === "sizeGuide" ? "−" : "+"}</span>
                </button>

                {openSection === "sizeGuide" && (
                  <div
                    style={{
                      paddingBottom: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    {sizeGuideImages.length > 0 ? (
                      sizeGuideImages.map((imageUrl, index) => (
                        <img
                          key={`${imageUrl}-${index}`}
                          src={imageUrl}
                          alt={`Guía de tallas de ${getBaseProductName(variants[0]?.name || "esta prenda")} ${index + 1}`}
                          loading="lazy"
                          style={{
                            display: "block",
                            width: "100%",
                            height: "auto",
                            objectFit: "contain",
                            borderRadius: "4px",
                          }}
                        />
                      ))
                    ) : (
                      <p
                        style={{
                          fontSize: "13px",
                          lineHeight: 1.6,
                          margin: 0,
                          color: "#666",
                        }}
                      >
                        La guía de tallas de esta prenda aún no está disponible.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 3. Envíos & Entregas */}

              <div style={{ borderBottom: "1px solid #eaeaea" }}>
                <button
                  onClick={() => toggleSection("shipping")}
                  style={{
                    width: "100%",

                    padding: "16px 0",

                    background: "none",

                    border: "none",

                    display: "flex",

                    justifyContent: "space-between",

                    alignItems: "center",

                    cursor: "pointer",

                    fontSize: "13px",

                    textTransform: "uppercase",

                    letterSpacing: "0.1em",

                    fontWeight: 600,
                  }}
                >
                  Envíos & Entregas
                  <span>{openSection === "shipping" ? "−" : "+"}</span>
                </button>

                {openSection === "shipping" && (
                  <div style={{ paddingBottom: "16px" }}>
                    <p
                      className="muted"
                      style={{ fontSize: "14px", lineHeight: 1.6, margin: 0 }}
                    >
                      • <strong>Caracas:</strong> Pick-up previo acuerdo o
                      Delivery a domicilio.
                      <br />• <strong>Nacional:</strong> Envíos cobro en destino
                      vía Tealca, Zoom o MRW.
                      <br />• <strong>Procesamiento:</strong> Tu pedido se
                      prepara en 24 a 48 horas hábiles.
                    </p>
                  </div>
                )}
              </div>

              {/* 4. Cambios & Devoluciones */}

              <div style={{ borderBottom: "1px solid #eaeaea" }}>
                <button
                  onClick={() => toggleSection("returns")}
                  style={{
                    width: "100%",

                    padding: "16px 0",

                    background: "none",

                    border: "none",

                    display: "flex",

                    justifyContent: "space-between",

                    alignItems: "center",

                    cursor: "pointer",

                    fontSize: "13px",

                    textTransform: "uppercase",

                    letterSpacing: "0.1em",

                    fontWeight: 600,
                  }}
                >
                  Cambios & Devoluciones
                  <span>{openSection === "returns" ? "−" : "+"}</span>
                </button>

                {openSection === "returns" && (
                  <div style={{ paddingBottom: "16px" }}>
                    <p
                      className="muted"
                      style={{ fontSize: "14px", lineHeight: 1.6, margin: 0 }}
                    >
                      • <strong>Plazo de Cambio:</strong> Aceptamos solicitudes
                      de cambio dentro de los primeros 7 días continuos tras
                      recibir tu pedido.
                      <br />• <strong>Condiciones:</strong> Las prendas deben
                      estar sin usar, sin lavar y conservar sus etiquetas
                      originales.
                      <br />• <strong>Costos de envío:</strong> El costo del
                      delivery o flete por cambio corre por cuenta del cliente
                      (salvo por defecto de fábrica).
                    </p>

                    
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
