import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export async function POST(req: Request) {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Debes iniciar sesión para subir imágenes." },
      { status: 401 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error:
          "Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.",
      },
      { status: 500 },
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Selecciona una imagen." },
        { status: 400 },
      );
    }
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa JPG, PNG, WebP o AVIF." },
        { status: 400 },
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "La imagen supera el límite de 10 MB." },
        { status: 400 },
      );
    }

    const ext = (
      {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/avif": "avif",
      } as Record<string, string>
    )[file.type];
    const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
    const client = createClient(url, serviceKey);
    const { error } = await client.storage
      .from("homepage")
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });
    if (error) throw error;
    const { data } = client.storage.from("homepage").getPublicUrl(path);
    return NextResponse.json({ success: true, url: data.publicUrl, path });
  } catch (error: any) {
    console.error("POST /api/homepage/upload", error);
    return NextResponse.json(
      { error: error.message || "No se pudo subir la imagen." },
      { status: 500 },
    );
  }
}
