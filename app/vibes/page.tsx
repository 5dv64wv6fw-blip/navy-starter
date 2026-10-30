
"use client";

import React from "react";
import Link from "next/link";

const NAVY = "#18333a";

const headingStyle: React.CSSProperties = {
  fontFamily: '"Gowun Batang", serif',
  color: NAVY,
  margin: 0,
  lineHeight: 1.1,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "clamp(16px, 3vw, 24px)",
};

const twoColumns: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 24,
  alignItems: "center",
};

const videoStyle = (ratio: string): React.CSSProperties => ({
  width: "100%",
  aspectRatio: ratio,
  objectFit: "cover",
  borderRadius: 8,
  display: "block",
});

export default function VibesPage() {
  return (
    <main style={{ minHeight: "100vh" }}>
      {/* Volver */}
      <div style={{ padding: "24px 24px 0" }}>
        <Link
          href="/"
          style={{
            fontSize: 13,
            letterSpacing: "0.05em",
            display: "inline-block",
          }}
        >
          ← Volver al inicio
        </Link>
      </div>

      {/* Encabezado */}
      <section
        className="section"
        style={{ paddingTop: 20, paddingBottom: 20, textAlign: "center" }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <span className="eyebrow">Our Vibes</span>
          <h2
            style={{
              ...headingStyle,
              fontSize: "clamp(36px, 5vw, 54px)",
              marginTop: 12,
            }}
          >
            Effortless Looks & Cool Clothes
          </h2>
          <p className="muted" style={{ marginTop: 16, lineHeight: 1.6 }}>
            Navy-Clothing Store
            <br />
            Est 2024.
            <br />
            Inspired by the coast and everyday life.
          </p>
        </div>
      </section>

      {/* Collage */}
      <section className="section" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <img
            src="/our-vibes.png.png"
            alt="Navy Collage Vibes"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
      </section>

      {/* Texto y Pinterest */}
      <section className="section" style={{ textAlign: "center" }}>
        <div style={{ maxWidth: 550, margin: "0 auto" }}>
          <span className="eyebrow">Coast. Summer. Everyday.</span>
          <p
            className="muted"
            style={{ lineHeight: 1.6, margin: "12px 0 28px" }}
          >
            Adaptamos las vibes playeras a la ciudad, con prendas versátiles que
            te ayudan a resolver el "no sé qué ponerme" de tu día a día.
          </p>
          <a
            href="https://pin.it/3eAocsfA4"
            target="_blank"
            rel="noopener noreferrer"
            className="cta"
            style={{
              background: NAVY,
              color: "#fff",
              border: `1px solid ${NAVY}`,
            }}
          >
            Discover our Pinterest
          </a>
        </div>
      </section>

      {/* By Us */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
          <span className="eyebrow"></span>
          <h2
            style={{
              ...headingStyle,
              fontSize: "clamp(40px, 6vw, 64px)",
              marginTop: 10,
            }}
          >
            By Us
          </h2>
          <p
            className="muted"
            style={{ maxWidth: 520, margin: "12px auto 48px", lineHeight: 1.6 }}
          >
            Diseñadas desde cero, pensadas para tu día a día.
          </p>

          {/* Scandi Skirt: video a la izquierda */}
          <div
            style={{
              ...cardStyle,
              ...twoColumns,
              textAlign: "left",
              marginBottom: 24,
            }}
          >
            <video
              src="/scandi-skirt.mp4"
              aria-label="Scandi Skirt"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              style={videoStyle("4 / 5")}
            />
            <div>
              <h3 style={{ ...headingStyle, fontSize: 30, marginBottom: 12 }}>
                Scandi Skirt
              </h3>
              <p className="muted" style={{ lineHeight: 1.6, margin: 0 }}>
                Inspiradas en el Scandi style!
                <br />
                <strong style={{ fontWeight: 500 }}>
                  Last pieces available
                </strong>
                <br />
                Khaki, Negro y Turquesa
              </p>
            </div>
          </div>

          {/* The Basic: texto a la izquierda, video a la derecha */}
          <div style={{ ...cardStyle, ...twoColumns, textAlign: "left" }}>
            <div>
              <h3 style={{ ...headingStyle, fontSize: 30, marginBottom: 12 }}>
                The Basic
              </h3>
              <p
                className="muted"
                style={{ lineHeight: 1.6, margin: "0 0 16px" }}
              >
                El top perfecto para los días que no sabes qué ponerte pero aún
                así quieres verte arreglada.
              </p>
              <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 4px" }}>
                Colores
              </p>
              <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
                Gris · Navy blue · Marfil · Negro
              </p>
              <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 4px" }}>
                Tallas
              </p>
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                XS/S (se adapta a XS y S) · S/M (se adapta a S y M)
              </p>
            </div>
            <video
              src="/the-basic.mp4"
              aria-label="The Basic"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              style={videoStyle("4 / 5")}
            />
          </div>

          {/* The Basic (puestas) */}
          <div style={{ ...cardStyle, marginTop: 24 }}>
            <span className="eyebrow">Comfy & Cute</span>
            <h3 style={{ ...headingStyle, fontSize: 28, margin: "8px 0 16px" }}>
              The Basic
            </h3>
            <video
              src="/the-basic-look.mp4"
              aria-label="The Basic puesta"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              style={{
                ...videoStyle("9 / 16"),
                maxWidth: 300,
                margin: "0 auto",
              }}
            />
          </div>
        </div>
      </section>

      <footer className="footer">
        <div>
          <strong>NAVY</strong>
          <div className="muted" style={{ marginTop: 8 }}>
            Clothing Store.
          </div>
        </div>
        <div className="footer-links">
          <a href="#">WhatsApp</a>
          <a href="#">Instagram</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    </main>
  );
}
