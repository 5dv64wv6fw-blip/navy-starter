"use client";

import AdminMenu from "@/components/admin/AdminMenu";
import React, { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";

type Outfit = { title: string; image: string };
type HomepageContent = {
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    buttonText: string;
    image: string;
  };
  recommendedProductIds: string[];
  categories: { name: string; slug: string; image?: string }[];
  vibes: {
    eyebrow: string;
    title: string;
    description: string;
    buttonText: string;
    image: string;
  };
  outfits: { eyebrow: string; title: string; items: Outfit[] };
  footer: {
    tagline: string;
    whatsapp: string;
    instagram: string;
    contact: string;
  };
};
type Product = {
  id: string;
  name: string;
  show_web?: boolean;
  webVisible?: boolean;
  variants?: { stock: number }[];
  images?: string[];
};

const defaults: HomepageContent = {
  hero: {
    eyebrow: "Navy summer",
    title: "Basics with a twist.",
    description:
      "El top perfecto para los días que no sabes que ponerte pero aún así te quieres ver arreglada.",
    buttonText: "Shop new in",
    image: "",
  },
  recommendedProductIds: [],
  categories: [
    { name: "Tops", slug: "tops", image: "" },
    { name: "Bottoms", slug: "bottoms", image: "" },
    { name: "Dresses & Sets", slug: "dresses", image: "" },
    { name: "The Basics", slug: "basics", image: "" },
  ],
  vibes: {
    eyebrow: "Our world",
    title: "Coast. Summer. Everyday.",
    description:
      "Navy is a wardrobe for spontaneous plans, warm evenings, old streets, sea days and getting dressed just because it feels good.",
    buttonText: "Discover our vibes",
    image: "",
  },
  outfits: {
    eyebrow: "Styled by Navy",
    title: "Outfits",
    items: [
      { title: "The beach day", image: "" },
      { title: "Late lunch", image: "" },
      { title: "A little getaway", image: "" },
      { title: "Sunday in the city", image: "" },
    ],
  },
  footer: {
    tagline: "Made for your summer.",
    whatsapp: "",
    instagram: "",
    contact: "",
  },
};

function mergeDefaults(input: any): HomepageContent {
  return {
    ...defaults,
    ...input,
    hero: { ...defaults.hero, ...(input?.hero || {}) },
    vibes: { ...defaults.vibes, ...(input?.vibes || {}) },
    footer: { ...defaults.footer, ...(input?.footer || {}) },
    categories: Array.isArray(input?.categories)
      ? input.categories
      : defaults.categories,
    recommendedProductIds: Array.isArray(input?.recommendedProductIds)
      ? input.recommendedProductIds
      : [],
    outfits: {
      ...defaults.outfits,
      ...(input?.outfits || {}),
      items: Array.isArray(input?.outfits?.items)
        ? input.outfits.items
        : defaults.outfits.items,
    },
  };
}

export default function AdminHomepagePage() {
  const [content, setContent] = useState<HomepageContent>(defaults);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [homeRes, inventoryRes] = await Promise.all([
          fetch("/api/homepage", { cache: "no-store" }),
          fetch("/api/inventory", { cache: "no-store" }),
        ]);
        if (homeRes.ok) {
          const data = await homeRes.json();
          setContent(mergeDefaults(data.content));
        }
        if (inventoryRes.ok) {
          const data = await inventoryRes.json();
          setProducts(data.products || []);
        }
      } catch (error) {
        console.error(error);
        setMessage(
          "No se pudo cargar la configuración. Revisa la conexión e inténtalo de nuevo.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = (
    section: "hero" | "vibes" | "footer" | "outfits",
    key: string,
    value: string,
  ) => {
    setContent(
      (prev) =>
        ({
          ...prev,
          [section]: { ...prev[section], [key]: value },
        }) as HomepageContent,
    );
  };

  const uploadImage = async (key: string, file?: File) => {
    if (!file) return;
    setUploading(key);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/homepage/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.url)
        throw new Error(data.error || "No se pudo subir la imagen.");
      setContent((prev) => {
        if (key === "hero.image")
          return { ...prev, hero: { ...prev.hero, image: data.url } };
        if (key === "vibes.image")
          return { ...prev, vibes: { ...prev.vibes, image: data.url } };
        const categoryMatch = key.match(/^category\.(\d+)\.image$/);
        if (categoryMatch) {
          const index = Number(categoryMatch[1]);
          const categories = [...prev.categories];
          categories[index] = { ...categories[index], image: data.url };
          return { ...prev, categories };
        }
        const match = key.match(/^outfit\.(\d+)\.image$/);
        if (match) {
          const index = Number(match[1]);
          const items = [...prev.outfits.items];
          items[index] = { ...items[index], image: data.url };
          return { ...prev, outfits: { ...prev.outfits, items } };
        }
        return prev;
      });
      setMessage("Imagen subida. Recuerda guardar los cambios de la homepage.");
    } catch (error: any) {
      setMessage(error.message || "Error al subir la imagen.");
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/homepage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || "No se pudieron guardar los cambios.");
      setMessage("Cambios guardados correctamente.");
    } catch (error: any) {
      setMessage(error.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const toggleRecommended = (id: string, checked: boolean) => {
    setContent((prev) => ({
      ...prev,
      recommendedProductIds: checked
        ? [...prev.recommendedProductIds, id]
        : prev.recommendedProductIds.filter((productId) => productId !== id),
    }));
  };

  const moveRecommended = (id: string, direction: -1 | 1) => {
    setContent((prev) => {
      const ids = [...prev.recommendedProductIds];
      const index = ids.indexOf(id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= ids.length) return prev;
      [ids[index], ids[next]] = [ids[next], ids[index]];
      return { ...prev, recommendedProductIds: ids };
    });
  };

  const uploadControl = (
    key: string,
    url: string,
    label: string,
    onChange: (file?: File) => void,
  ) => (
    <div
      className="homepage-upload"
      style={{ display: "grid", gap: 8, marginTop: 10 }}
    >
      {url ? (
        <img
          src={url}
          alt={label}
          style={{
            width: "100%",
            maxWidth: 320,
            maxHeight: 220,
            objectFit: "cover",
            borderRadius: 8,
          }}
        />
      ) : (
        <div
          style={{
            padding: 24,
            background: "#f6f4f0",
            color: "#777",
            borderRadius: 8,
            maxWidth: 320,
          }}
        >
          No hay imagen seleccionada
        </div>
      )}
      <label
        style={{
          display: "inline-flex",
          width: "fit-content",
          padding: "9px 12px",
          border: "1px solid var(--line)",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        {uploading === key
          ? "Subiendo imagen…"
          : url
            ? "Cambiar imagen"
            : "Subir imagen"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={uploading !== null}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            onChange(e.target.files?.[0]);
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
      </label>
      {url && (
        <button
          type="button"
          className="admin-btn secondary"
          style={{ width: "fit-content" }}
          onClick={() => onChange(undefined)}
        >
          Quitar imagen
        </button>
      )}
    </div>
  );

  // Allow removal without deleting the file from storage, so old saved pages won't break.
  const clearImage = (key: string) =>
    setContent((prev) => {
      if (key === "hero.image")
        return { ...prev, hero: { ...prev.hero, image: "" } };
      if (key === "vibes.image")
        return { ...prev, vibes: { ...prev.vibes, image: "" } };
      const categoryMatch = key.match(/^category\.(\d+)\.image$/);
      if (categoryMatch) {
        const categories = [...prev.categories];
        const index = Number(categoryMatch[1]);
        categories[index] = { ...categories[index], image: "" };
        return { ...prev, categories };
      }
      const match = key.match(/^outfit\.(\d+)\.image$/);
      if (match) {
        const items = [...prev.outfits.items];
        items[Number(match[1])] = { ...items[Number(match[1])], image: "" };
        return { ...prev, outfits: { ...prev.outfits, items } };
      }
      return prev;
    });

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--line)",
    borderRadius: 6,
    marginTop: 6,
    font: "inherit",
    background: "white",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    marginTop: 14,
    color: "var(--ink)",
  };
  const cardStyle: React.CSSProperties = {
    background: "white",
    border: "1px solid var(--line)",
    borderRadius: 10,
    padding: 20,
    marginBottom: 18,
  };

  if (loading)
    return (
      <main className="admin-shell">
        <div className="admin-main">Cargando configuración de la homepage…</div>
      </main>
    );

  return (
    <main className="admin-shell">
      <header
        className="admin-top"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link className="admin-logo" href="/admin">
          NAVY ADMIN
        </Link>
        <AdminMenu />
      </header>
      <div className="admin-main" style={{ maxWidth: 1000 }}>
        <div className="admin-title">
          <h1>Homepage editor</h1>
          <span className="muted"></span>
        </div>
        {message && (
          <div
            role="status"
            style={{
              padding: 12,
              background: "#f5f3ef",
              borderRadius: 8,
              margin: "18px 0",
            }}
          >
            {message}
          </div>
        )}

        <section style={cardStyle}>
          <h2>Hero / banner principal</h2>
          <label style={labelStyle}>
            Eyebrow
            <input
              style={fieldStyle}
              value={content.hero.eyebrow}
              onChange={(e) => update("hero", "eyebrow", e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Título
            <input
              style={fieldStyle}
              value={content.hero.title}
              onChange={(e) => update("hero", "title", e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Descripción
            <textarea
              style={fieldStyle}
              rows={3}
              value={content.hero.description}
              onChange={(e) => update("hero", "description", e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Texto del botón
            <input
              style={fieldStyle}
              value={content.hero.buttonText}
              onChange={(e) => update("hero", "buttonText", e.target.value)}
            />
          </label>
          {uploadControl("hero.image", content.hero.image, "Hero", (file) =>
            file ? uploadImage("hero.image", file) : clearImage("hero.image"),
          )}
          <p className="muted" style={{ fontSize: 12 }}>
            La imagen solo se verá como fondo si el CSS de .hero permite
            mostrarla; el código de integración lo aplica mediante
            backgroundImage.
          </p>
        </section>

        <section style={cardStyle}>
          <h2>Recommended products</h2>
          <p className="muted">
            Selecciona productos visibles con stock. El orden de la lista
            determina el orden en la homepage.
          </p>
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            {products
              .filter((p) => p.webVisible !== false && p.show_web !== false)
              .map((product) => {
                const checked = content.recommendedProductIds.includes(
                  product.id,
                );
                const hasStock =
                  product.variants?.some((v) => Number(v.stock) > 0) ?? false;
                const order = content.recommendedProductIds.indexOf(product.id);
                return (
                  <div
                    key={product.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: 10,
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      opacity: hasStock ? 1 : 0.55,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!hasStock}
                      onChange={(e) =>
                        toggleRecommended(product.id, e.target.checked)
                      }
                    />
                    {product.images?.[0] && (
                      <img
                        src={product.images[0]}
                        alt=""
                        style={{
                          width: 48,
                          height: 60,
                          objectFit: "cover",
                          borderRadius: 4,
                        }}
                      />
                    )}
                    <span style={{ flex: 1, fontSize: 14 }}>
                      {product.name}
                      {!hasStock ? " · Sin stock" : ""}
                    </span>
                    {checked && (
                      <>
                        <span style={{ fontSize: 12, color: "#777" }}>
                          #{order + 1}
                        </span>
                        <button
                          type="button"
                          className="admin-btn secondary"
                          disabled={order <= 0}
                          onClick={() => moveRecommended(product.id, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="admin-btn secondary"
                          disabled={
                            order === content.recommendedProductIds.length - 1
                          }
                          onClick={() => moveRecommended(product.id, 1)}
                        >
                          ↓
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            {products.length === 0 && (
              <p className="muted">
                No se pudieron cargar productos del inventario.
              </p>
            )}
          </div>
          <p className="muted" style={{ fontSize: 12 }}>
            Si no seleccionas ninguno, la homepage seguirá mostrando
            automáticamente los productos disponibles, como antes.
          </p>
        </section>

        <section style={cardStyle}>
          <h2>Shop by category</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Sube una imagen para cada categoría. Las imágenes se adaptan al
            recuadro actual de la web, sin cambiar su tamaño.
          </p>
          {content.categories.map((category, index) => (
            <div
              key={category.slug}
              style={{
                borderTop: "1px solid var(--line)",
                paddingTop: 12,
                marginTop: 14,
              }}
            >
              <label style={labelStyle}>
                {category.slug}
                <input
                  style={fieldStyle}
                  value={category.name}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      categories: prev.categories.map((item, i) =>
                        i === index ? { ...item, name: e.target.value } : item,
                      ),
                    }))
                  }
                />
              </label>
              {uploadControl(
                `category.${index}.image`,
                category.image || "",
                `Categoría ${category.name}`,
                (file) =>
                  file
                    ? uploadImage(`category.${index}.image`, file)
                    : clearImage(`category.${index}.image`),
              )}
            </div>
          ))}
        </section>

        <section style={cardStyle}>
          <h2>Our World / Vibes</h2>
          <label style={labelStyle}>
            Eyebrow
            <input
              style={fieldStyle}
              value={content.vibes.eyebrow}
              onChange={(e) => update("vibes", "eyebrow", e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Título
            <input
              style={fieldStyle}
              value={content.vibes.title}
              onChange={(e) => update("vibes", "title", e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Descripción
            <textarea
              style={fieldStyle}
              rows={3}
              value={content.vibes.description}
              onChange={(e) => update("vibes", "description", e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Texto del botón
            <input
              style={fieldStyle}
              value={content.vibes.buttonText}
              onChange={(e) => update("vibes", "buttonText", e.target.value)}
            />
          </label>
          {uploadControl(
            "vibes.image",
            content.vibes.image,
            "Our World",
            (file) =>
              file
                ? uploadImage("vibes.image", file)
                : clearImage("vibes.image"),
          )}
        </section>

        <section style={cardStyle}>
          <h2>Outfits</h2>
          <label style={labelStyle}>
            Eyebrow
            <input
              style={fieldStyle}
              value={content.outfits.eyebrow}
              onChange={(e) => update("outfits", "eyebrow", e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Título
            <input
              style={fieldStyle}
              value={content.outfits.title}
              onChange={(e) => update("outfits", "title", e.target.value)}
            />
          </label>
          {content.outfits.items.map((item, index) => (
            <div
              key={index}
              style={{
                borderTop: "1px solid var(--line)",
                paddingTop: 12,
                marginTop: 16,
              }}
            >
              <h3 style={{ fontSize: 15 }}>Outfit {index + 1}</h3>
              <label style={labelStyle}>
                Nombre
                <input
                  style={fieldStyle}
                  value={item.title}
                  onChange={(e) =>
                    setContent((prev) => ({
                      ...prev,
                      outfits: {
                        ...prev.outfits,
                        items: prev.outfits.items.map((x, i) =>
                          i === index ? { ...x, title: e.target.value } : x,
                        ),
                      },
                    }))
                  }
                />
              </label>
              {uploadControl(
                `outfit.${index}.image`,
                item.image,
                item.title,
                (file) =>
                  file
                    ? uploadImage(`outfit.${index}.image`, file)
                    : clearImage(`outfit.${index}.image`),
              )}
            </div>
          ))}
        </section>

        <section style={cardStyle}>
          <h2>Footer</h2>
          <label style={labelStyle}>
            Frase final
            <input
              style={fieldStyle}
              value={content.footer.tagline}
              onChange={(e) => update("footer", "tagline", e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Enlace de WhatsApp
            <input
              style={fieldStyle}
              placeholder="https://wa.me/..."
              value={content.footer.whatsapp}
              onChange={(e) => update("footer", "whatsapp", e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Enlace de Instagram
            <input
              style={fieldStyle}
              placeholder="https://instagram.com/..."
              value={content.footer.instagram}
              onChange={(e) => update("footer", "instagram", e.target.value)}
            />
          </label>
          <label style={labelStyle}>
            Enlace de contacto
            <input
              style={fieldStyle}
              placeholder="mailto:... o URL"
              value={content.footer.contact}
              onChange={(e) => update("footer", "contact", e.target.value)}
            />
          </label>
        </section>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            margin: "24px 0 50px",
          }}
        >
          <button
            className="admin-btn"
            onClick={save}
            disabled={saving || uploading !== null}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          <Link
            className="admin-btn secondary"
            href="/"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Ver homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
