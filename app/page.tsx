"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "./context/CartContext";
import { calculatePricing, InventoryItem, Rates } from "@/lib/inventory";

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

export default function Home() {
  const { cart, openCart } = useCart();
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [rates, setRates] = useState<Rates>({
    tasaBCV: 745,
    tasaBNC: 1000,
    discountPercent: 15,
  });
  const [loading, setLoading] = useState(true);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>(
    {},
  );
  const [homepage, setHomepage] = useState<HomepageContent>(defaults);

  const scrollToSection = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const loadData = async () => {
    console.log("NAVY: iniciando carga");

    try {
      const catalogPromise = fetch("/api/inventory", {
        cache: "no-store",
      }).then(async (res) => {
        console.log("NAVY inventory status:", res.status);
        return res;
      });

      const homepagePromise = fetch("/api/homepage", {
        cache: "no-store",
      }).then(async (res) => {
        console.log("NAVY homepage status:", res.status);
        return res;
      });

      const [catalogRes, homepageRes] = await Promise.all([
        catalogPromise,
        homepagePromise,
      ]);

      if (catalogRes.ok) {
        const data = await catalogRes.json();
        console.log("NAVY productos recibidos:", data.products?.length);
        setProducts(data.products || []);
        if (data.rates) setRates(data.rates);
      } else {
        console.error("NAVY: falló inventory", catalogRes.status);
      }

      if (homepageRes.ok) {
        const data = await homepageRes.json();
        console.log("NAVY: contenido homepage recibido", !!data.content);
        setHomepage(mergeDefaults(data.content));
      } else {
        console.error("NAVY: falló homepage", homepageRes.status);
      }
    } catch (error) {
      console.error("NAVY: error al cargar datos", error);
    } finally {
      console.log("NAVY: terminó la carga");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleFocus = () => loadData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const visibleProducts = products.filter((item) => item.webVisible !== false);
  const activeProducts = visibleProducts.filter((item) =>
    item.variants?.some((variant) => Number(variant.stock) > 0),
  );
  const selectedRecommended = homepage.recommendedProductIds.length
    ? homepage.recommendedProductIds
        .map((id) => activeProducts.find((p) => p.id === id))
        .filter((p): p is InventoryItem => Boolean(p))
    : activeProducts;
  const displayedProducts = selectedRecommended.length
    ? selectedRecommended
    : homepage.recommendedProductIds.length
      ? []
      : activeProducts;

  return (
    <main>
      <header className="site-nav">
        <Link className="logo" href="/">
          <img
            src="/navy-logo.png"
            alt="Navy"
            style={{ height: 50, width: "auto", display: "block" }}
          />
        </Link>
        <nav className="nav-links">
          <Link href="/shop">Shop All</Link>
          <a href="#shop" onClick={scrollToSection("shop")}>
            New In
          </a>
          <Link href="/vibes">Our Vibes</Link>
          <a href="#outfits" onClick={scrollToSection("outfits")}>
            Outfits
          </a>
        </nav>
        <button
          onClick={openCart}
          style={{
            background: "transparent",
            border: "1px solid #fcf9f9",
            color: "#fffefe",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            padding: "8px 16px",
            borderRadius: 50,
            letterSpacing: "0.05em",
          }}
        >
          Bag · {totalItems}
        </button>
      </header>

      <section
        className="hero"
        style={
          homepage.hero.image
            ? {
                backgroundImage: `linear-gradient(90deg, rgba(0,0,0,.34), rgba(0,0,0,.04)), url("${homepage.hero.image}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="hero-copy">
          <span className="eyebrow">{homepage.hero.eyebrow}</span>
          <h1>{homepage.hero.title}</h1>
          <p>{homepage.hero.description}</p>
          <a className="cta" href="#shop" onClick={scrollToSection("shop")}>
            {homepage.hero.buttonText}
          </a>
        </div>
      </section>

      <section className="section" id="shop">
        <div className="section-head">
          <div>
            <span className="eyebrow">Selected for you</span>
            <h2>Recommended</h2>
          </div>
          <Link
            href="/shop"
            className="muted"
            style={{ textDecoration: "none", cursor: "pointer" }}
          >
            Shop all →
          </Link>
        </div>
        {loading ? (
          <div
            style={{ padding: "40px 0", color: "#888", textAlign: "center" }}
          >
            Cargando catálogo...
          </div>
        ) : displayedProducts.length === 0 ? (
          <div
            style={{ padding: "40px 0", color: "#888", textAlign: "center" }}
          >
            No hay productos disponibles en este momento.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "nowrap",
              overflowX: "auto",
              gap: 16,
              paddingBottom: 24,
              scrollbarWidth: "none",
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {displayedProducts.map((product) => {
              const defaultSize =
                product.variants.find((v) => Number(v.stock) > 0)?.size ||
                product.variants[0]?.size;
              const currentSize = selectedSizes[product.id] || defaultSize;
              const activeVariant =
                product.variants.find((v) => v.size === currentSize) ||
                product.variants[0];
              const pricing = calculatePricing(
                Number(product.dollarPrice || 0),
                rates,
              );
              const productSlug = product.name
                .toLowerCase()
                .trim()
                .replace(/\s+/g, "-")
                .replace(/[^\w-]+/g, "");
              return (
                <div
                  key={product.id}
                  style={{
                    flex: "0 0 auto",
                    width: 280,
                    scrollSnapAlign: "start",
                  }}
                >
                  <Link
                    href={`/product/${productSlug}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <article>
                      <div
                        className="product-image"
                        style={{ overflow: "hidden", position: "relative" }}
                      >
                        {product.images?.length ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        ) : (
                          <span>NAVY</span>
                        )}
                      </div>
                    </article>
                  </Link>
                  <div style={{ marginTop: 10, padding: "0 4px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 6,
                      }}
                    >
                      <strong style={{ fontWeight: 500, fontSize: 14 }}>
                        {product.name}
                      </strong>
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            display: "block",
                          }}
                        >
                          ${pricing.priceBCVFormatted}
                        </span>
                        <small
                          style={{
                            fontSize: 11,
                            color: "#666",
                            display: "block",
                          }}
                        >
                          Bs. {pricing.priceBsFormatted}
                        </small>
                      </div>
                    </div>
                    <div
                      style={{
                        margin: "6px 0 10px",
                        padding: "5px 8px",
                        backgroundColor: "#f5f8f5",
                        borderRadius: 4,
                        fontSize: 11,
                        color: "#1e5c22",
                        border: "1px solid #d4e8d5",
                      }}
                    >
                      <strong>
                        {pricing.discountPercent}% off para pagos en $:
                      </strong>{" "}
                      ${pricing.cashUSDFormatted}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{ fontSize: 11, color: "#666", marginRight: 2 }}
                      >
                        Talla:
                      </span>
                      {product.variants.map((v) => {
                        const isSelected = v.size === currentSize;
                        const out = Number(v.stock) === 0;
                        return (
                          <button
                            key={v.id}
                            onClick={() => {
                              if (!out)
                                setSelectedSizes({
                                  ...selectedSizes,
                                  [product.id]: v.size,
                                });
                            }}
                            disabled={out}
                            style={{
                              padding: "3px 8px",
                              fontSize: 11,
                              borderRadius: 4,
                              border: isSelected
                                ? "1px solid #000"
                                : "1px solid #ddd",
                              backgroundColor: isSelected
                                ? "#000"
                                : out
                                  ? "#f5f5f5"
                                  : "#fff",
                              color: isSelected
                                ? "#fff"
                                : out
                                  ? "#aaa"
                                  : "#000",
                              cursor: out ? "not-allowed" : "pointer",
                              textDecoration: out ? "line-through" : "none",
                            }}
                            title={out ? "Agotado" : `Disponibles: ${v.stock}`}
                          >
                            {v.size}
                          </button>
                        );
                      })}
                    </div>
                    {activeVariant?.color && (
                      <div
                        style={{ marginTop: 8, fontSize: 11, color: "#666" }}
                      >
                        Color: {activeVariant.color}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Find your piece</span>
            <h2>Shop by category</h2>
          </div>
        </div>
        <div className="categories">
          {homepage.categories.map((c) => (
            <Link
              className="category"
              key={c.slug}
              href={`/category/${c.slug}`}
              style={
                c.image
                  ? {
                      backgroundImage: `linear-gradient(rgba(0,0,0,.18), rgba(0,0,0,.28)), url("${c.image}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      color: "#fff",
                    }
                  : undefined
              }
            >
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="section" id="vibes">
        <div className="vibes">
          <div
            className="vibe-collage"
            style={
              homepage.vibes.image
                ? {
                    backgroundImage: `url("${homepage.vibes.image}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          />
          <div className="vibe-copy">
            <span className="eyebrow">{homepage.vibes.eyebrow}</span>
            <h2>{homepage.vibes.title}</h2>
            <p className="muted">{homepage.vibes.description}</p>
            {/* CAMBIO: botón "Discover our vibes" con color propio */}
            <Link
              className="cta"
              style={{
                alignSelf: "flex-start",
                marginTop: 18,
                backgroundColor: "#18333a",
                color: "#fff",
                border: "1px solid #18333a",
              }}
              href="/vibes"
            >
              {homepage.vibes.buttonText}
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="outfits">
        <div className="section-head">
          <div>
            <span className="eyebrow">{homepage.outfits.eyebrow}</span>
            <h2>{homepage.outfits.title}</h2>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "nowrap",
            overflowX: "auto",
            gap: 16,
            paddingBottom: 24,
            scrollbarWidth: "none",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {homepage.outfits.items.map((item, index) => (
            <article
              key={`${item.title}-${index}`}
              style={{ flex: "0 0 auto", width: 280, scrollSnapAlign: "start" }}
            >
              <div
                className="product-image"
                style={{ overflow: "hidden", position: "relative" }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <span>{item.title}</span>
                )}
              </div>
              <div style={{ marginTop: 10, fontSize: 13 }}>{item.title}</div>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div>
          <strong>NAVY</strong>
          <div className="muted" style={{ marginTop: 8 }}>
            {homepage.footer.tagline}
          </div>
        </div>
        <div className="footer-links">
          {homepage.footer.whatsapp && (
            <a href={homepage.footer.whatsapp} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          )}
          {homepage.footer.instagram && (
            <a
              href={homepage.footer.instagram}
              target="_blank"
              rel="noreferrer"
            >
              Instagram
            </a>
          )}
          {homepage.footer.contact && (
            <a href={homepage.footer.contact}>Contact</a>
          )}
        </div>
      </footer>
    </main>
  );
}
