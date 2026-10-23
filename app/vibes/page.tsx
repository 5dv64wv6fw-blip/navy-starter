"use client";

import React from "react";
import Link from "next/link";

export default function VibesPage() {
  return (
    <main>
      {/* Botón de regreso solo texto */}
      <div style={{ padding: "24px 24px 0 24px" }}>
        <Link
          href="/"
          style={{
            textDecoration: "none",
            color: "inherit",
            fontSize: "13px",
            letterSpacing: "0.05em",
            display: "inline-block",
          }}
        >
          ← Volver al inicio
        </Link>
      </div>

      {/* Encabezado con la tipografía h2 de la página principal */}
      <section
        className="section"
        style={{
          paddingTop: "20px",
          textAlign: "center",
          paddingBottom: "20px",
        }}
      >
        <div
          className="vibe-copy"
          style={{ maxWidth: "600px", margin: "0 auto" }}
        >
          <span className="eyebrow">The Aesthetic</span>
          <h2>Effortless & Timeless</h2>
          <p
            className="muted"
            style={{
              marginTop: "16px",
              lineHeight: "1.6",
            }}
          >
            Basics con ese toque especial diseñados para acompañarte en tus días
            de sol, escapadas de fin de semana y momentos inolvidables.
          </p>
        </div>
      </section>

      {/* Sección con el collage centrado */}
      <section className="section">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "32px",
            maxWidth: "800px",
            margin: "0 auto 60px auto",
            padding: "0 16px",
            textAlign: "center",
          }}
        >
          {/* Imagen del Collage */}
          <div
            style={{
              width: "100%",
              maxWidth: "580px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src="/collage-vibes.png"
              alt="Navy Collage Vibes"
              style={{
                width: "100%",
                height: "auto",
                maxHeight: "600px",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>

          {/* Texto inferior y botón a Pinterest */}
          <div
            className="vibe-copy"
            style={{ maxWidth: "550px", marginTop: "12px" }}
          >
            <span className="eyebrow">Coast. Summer. Everyday.</span>
            <p
              className="muted"
              style={{
                lineHeight: "1.6",
                marginTop: "12px",
                marginBottom: "28px",
              }}
            >
              Navy is a wardrobe for spontaneous plans, warm evenings, old
              streets, sea days and getting dressed just because it feels good.
            </p>

            <a
              className="cta"
              href="https://pin.it/3eAocsfA4"
              target="_blank"
              rel="noopener noreferrer"
            >
              Discover our Pinterest
            </a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div>
          <strong>NAVY</strong>
          <div className="muted" style={{ marginTop: 8 }}>
            Made for your summer.
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
