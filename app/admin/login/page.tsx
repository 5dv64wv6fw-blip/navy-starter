"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError("Email o contraseña incorrectos.");
      return;
    }

    // router.refresh() hace que el middleware vuelva a leer la sesión
    // antes de navegar, para que no rebote de nuevo al login.
    router.refresh();
    router.push("/admin");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#faf9f6",
        padding: 20,
        fontFamily: "sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 32,
          width: "100%",
          maxWidth: 360,
          boxShadow: "0 1px 3px rgba(0,0,0,.05)",
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#18333a",
            marginBottom: 4,
          }}
        >
          NAVY ADMIN
        </h1>
        <p style={{ fontSize: 13, color: "#777", marginBottom: 24 }}>
          Inicia sesión para continuar
        </p>

        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
          Email
        </label>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <label
          style={{
            display: "block",
            fontSize: 13,
            marginTop: 16,
            marginBottom: 6,
          }}
        >
          Contraseña
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <p style={{ color: "#d32f2f", fontSize: 13, marginTop: 12 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: "100%",
            marginTop: 24,
            padding: "10px 16px",
            border: 0,
            borderRadius: 6,
            background: "#18333a",
            color: "#fff",
            fontWeight: 600,
            cursor: isSubmitting ? "default" : "pointer",
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: 14,
};
