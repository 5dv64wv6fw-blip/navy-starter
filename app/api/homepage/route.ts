import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// UUID de la administradora. No es secreto: la protección real es la sesión.
const ADMIN_USER_ID = "0a09a9cd-b7ed-49ac-b69a-18dcd2dab933";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Cliente público: solo para leer (la tabla tiene lectura pública)
const supabase = createClient(supabaseUrl, publicKey);

const defaultContent = {
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
    { name: "Tops", slug: "tops" },
    { name: "Bottoms", slug: "bottoms" },
    { name: "Dresses & Sets", slug: "dresses" },
    { name: "The Basics", slug: "basics" },
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

// Devuelve true solo si quien llama es la administradora
async function isAdmin() {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  return Boolean(user && user.id === ADMIN_USER_ID);
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("homepage_settings")
      .select("content")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      content: { ...defaultContent, ...(data?.content || {}) },
    });
  } catch (error: any) {
    console.error("GET /api/homepage", error);
    return NextResponse.json(
      { content: defaultContent, warning: error.message },
      { status: 200 },
    );
  }
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: "No tienes permiso para guardar la homepage." },
      { status: 403 },
    );
  }

  if (!serviceKey) {
    console.error(
      "[homepage] SUPABASE_SERVICE_ROLE_KEY no está definida: no se puede guardar.",
    );
    return NextResponse.json(
      {
        error:
          "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Avisa al equipo técnico.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    if (
      !body.content ||
      typeof body.content !== "object" ||
      Array.isArray(body.content)
    ) {
      return NextResponse.json(
        { error: "La configuración enviada no es válida." },
        { status: 400 },
      );
    }

    // Cliente con clave de servicio: solo se crea aquí, en el servidor
   const admin = createClient(supabaseUrl, serviceKey);
    const { data, error } = await admin
      .from("homepage_settings")
      .upsert({
        id: 1,
        content: body.content,
        updated_at: new Date().toISOString(),
      })
      .select("id, updated_at");

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("La homepage no se actualizó en la base de datos.");
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /api/homepage", error);
    return NextResponse.json(
      { error: error.message || "No se pudo guardar la homepage." },
      { status: 500 },
    );
  }
}
