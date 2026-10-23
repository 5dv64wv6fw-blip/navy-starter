import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  supabaseUrl,
  serviceKey || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

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

async function authorized() {
  const authClient = await createServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  return Boolean(user);
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
  if (!(await authorized())) {
    return NextResponse.json(
      { error: "Debes iniciar sesión para guardar cambios." },
      { status: 401 },
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
    if (!serviceKey) {
      return NextResponse.json(
        {
          error:
            "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor.",
        },
        { status: 500 },
      );
    }
    const { error } = await supabase.from("homepage_settings").upsert({
      id: 1,
      content: body.content,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /api/homepage", error);
    return NextResponse.json(
      { error: error.message || "No se pudo guardar la homepage." },
      { status: 500 },
    );
  }
}
