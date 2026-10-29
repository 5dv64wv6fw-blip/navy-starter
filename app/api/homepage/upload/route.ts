import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// UUID de la administradora. No es secreto: la protección real es la sesión.
const ADMIN_USER_ID = "0a09a9cd-b7ed-49ac-b69a-18dcd2dab933";

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function POST(req: Request) {
  // 1. Solo la administradora puede subir imágenes
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

  if (user.id !== ADMIN_USER_ID) {
    return NextResponse.json(
      { error: "No tienes permiso para subir imágenes." },
      { status: 403 },
    );
  }

  // 2. Configuración del servidor
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "[homepage/upload] Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
    );
    return NextResponse.json(
      {
        error:
          "Falta configuración del servidor para subir imágenes. Avisa al equipo técnico.",
      },
      { status: 500 },
    );
  }

  try {
    // 3. Validar el archivo
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

    // 4. Subir al bucket "homepage"
    const ext = extensions[file.type];
    const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: uploadError } = await admin.storage
      .from("homepage")
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      console.error("[homepage/upload] Error de Storage:", uploadError);
      return NextResponse.json(
        {
          error: `No se pudo subir la imagen: ${uploadError.message}`,
        },
        { status: 500 },
      );
    }

    const { data } = admin.storage.from("homepage").getPublicUrl(path);

    return NextResponse.json({ success: true, url: data.publicUrl, path });
  } catch (error: any) {
    console.error("POST /api/homepage/upload", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo subir la imagen." },
      { status: 500 },
    );
  }
}
