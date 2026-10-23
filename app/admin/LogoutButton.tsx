"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/admin/login");
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        background: "none",
        border: "1px solid #ccc",
        borderRadius: 6,
        padding: "5px 10px",
        fontSize: 12,
        cursor: "pointer",
        color: "#555",
      }}
    >
      Cerrar sesión
    </button>
  );
}
