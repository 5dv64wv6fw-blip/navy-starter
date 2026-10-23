import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("store_settings")
    .select("id, tasa_bnc, tasa_bcv")
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: data,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json();

  const tasaBnc = Number(body.tasaBnc);
  const tasaBcv = Number(body.tasaBcv);

  if (!Number.isFinite(tasaBnc) || !Number.isFinite(tasaBcv)) {
    return NextResponse.json(
      { error: "Las tasas deben ser números válidos." },
      { status: 400 },
    );
  }

  const { data: existingSettings } = await supabase
    .from("store_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  let data;
  let error;

  if (existingSettings) {
    const result = await supabase
      .from("store_settings")
      .update({
        tasa_bnc: tasaBnc,
        tasa_bcv: tasaBcv,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSettings.id)
      .select("id, tasa_bnc, tasa_bcv")
      .single();

    data = result.data;
    error = result.error;
  } else {
    const result = await supabase
      .from("store_settings")
      .insert({
        tasa_bnc: tasaBnc,
        tasa_bcv: tasaBcv,
      })
      .select("id, tasa_bnc, tasa_bcv")
      .single();

    data = result.data;
    error = result.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: data,
  });
}
