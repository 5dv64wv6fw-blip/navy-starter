import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Inicialización del cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Función auxiliar: Buscar o crear categoría por nombre
async function getOrCreateCategory(categoryName: string) {
  if (!categoryName) return null;
  const normalizedName = categoryName.trim();

  // 1. Buscar si ya existe
  const { data: existingCategory, error: fetchError } = await supabase
    .from("categories")
    .select("id")
    .ilike("name", normalizedName)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existingCategory) return existingCategory.id;

  // 2. Crear si no existe
  const { data: newCategory, error: insertError } = await supabase
    .from("categories")
    .insert({ name: normalizedName })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return newCategory.id;
}

/*
  Comprueba que quien llama a este endpoint inició sesión como admin.
  Se usa en POST, PATCH y DELETE (crear, editar, borrar), pero NO en
  GET: el catálogo lo necesita leer cualquier visitante de la tienda.
*/
async function requireAdmin() {
  const supabaseAuth = await createServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "No autorizado. Inicia sesión como administradora." },
      { status: 401 },
    );
  }

  return null;
}

// ========================================================
// GET: Consultar Productos, Variantes e Historial de Stock
// ========================================================
export async function GET() {
  try {
    const [
      { data: products, error: productsError },
      { data: history, error: historyError },
      { data: productPhotos, error: photosError },
    ] = await Promise.all([
      supabase
        .from("products")
        .select(
          `
            *,
            categories (id, name),
            product_variants (*)
          `,
        )
        // Solo productos que NO están archivados (borrado suave)
        .eq("is_archived", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("stock_history")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("product_photos")
        .select(
          "id, product_id, color, url, position_x, position_y, sort_order",
        )
        .order("sort_order", { ascending: true }),
    ]);

    if (productsError) throw productsError;
    if (historyError) throw historyError;
    if (photosError) throw photosError;

    const photosByProduct = new Map<string, any[]>();
    for (const photo of productPhotos || []) {
      const current = photosByProduct.get(photo.product_id) || [];
      current.push(photo);
      photosByProduct.set(photo.product_id, current);
    }

    // Normalización de productos y formato seguro de datos
    const formattedProducts = (products || []).map((product) => ({
      ...product,
      price: Number(product.dollar_price ?? product.price ?? 0),
      dollar_price: Number(product.dollar_price ?? product.price ?? 0),
      show_web: Boolean(product.show_web),
      webVisible: product.show_web !== false,
      dollarPrice: Number(product.dollar_price ?? product.price ?? 0),
      images: Array.isArray(product.images) ? product.images : [],
      sizeGuideImages: Array.isArray(product.size_guide_images)
        ? product.size_guide_images
        : Array.isArray(product.sizeGuideImages)
          ? product.sizeGuideImages
          : [],
      careDetails: product.care_details || product.careDetails || "",
      colorPhotos: photosByProduct.get(product.id) || [],
      category_name: product.categories?.name || "Sin categoría",
      variants: (product.product_variants || []).map((v: any) => ({
        ...v,
        stock: Number(v.stock ?? 0),
        price: Number(v.price ?? product.dollar_price ?? 0),
      })),
    }));

   
  // Tasas guardadas desde el panel admin (tabla store_settings)
const { data: { user } } = await supabase.auth.getUser();
console.log("[inventory] user:", user?.id ?? "ANÓNIMO");

const { data: settings, error: settingsError, count } = await supabase
  .from("store_settings")
  .select("tasa_bnc, tasa_bcv", { count: "exact" })
  .limit(1)
  .maybeSingle();

console.log("[inventory] filas:", count, "settings:", settings, "error:", settingsError);

if (settingsError) {
  console.error("Error al leer las tasas:", settingsError);
}
    const rates = {
      tasaBNC: Number(settings?.tasa_bnc) || 1000,
      tasaBCV: Number(settings?.tasa_bcv) || 745,
    };


    return NextResponse.json({
      products: formattedProducts,
      history: history || [],
      rates,
    });
  } catch (error: any) {
    console.error("Error en GET /api/products:", error);
    return NextResponse.json(
      { error: error.message || "Error al consultar el inventario" },
      { status: 500 },
    );
  }
}

// ========================================================
// POST: Crear Producto, Variantes e Historial Inicial
// ========================================================
export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let createdProductId: string | null = null;

  try {
    const body = await req.json();
    const {
      name,
      description,
      careDetails,
      care_details,
      dollar_price,
      dollarPrice,
      cost_usd,
      cost,
      category_name,
      category,
      images,
      sizeGuideImages,
      size_guide_images,
      show_web,
      webVisible,
      variants,
      colorPhotos,
    } = body;

    const finalDollarPrice = dollar_price ?? dollarPrice;
    const finalCost = Number(cost_usd ?? cost ?? 0);
    const finalCategoryName = category_name ?? category;
    const finalShowWeb = show_web ?? webVisible;

    if (!name || finalDollarPrice == null) {
      return NextResponse.json(
        { error: "El nombre y el precio en dólares son requeridos" },
        { status: 400 },
      );
    }

    // 1. Obtener o crear ID de categoría
    const categoryId = finalCategoryName
      ? await getOrCreateCategory(finalCategoryName)
      : null;

    // 2. Insertar registro principal del Producto
    const { data: newProduct, error: productError } = await supabase
      .from("products")
      .insert({
        name,
        description: description || "",
        care_details: String(careDetails ?? care_details ?? ""),
        dollar_price: Number(finalDollarPrice),
        cost_usd: finalCost,
        category_id: categoryId,
        images: images || [],
        size_guide_images: Array.isArray(sizeGuideImages ?? size_guide_images)
          ? (sizeGuideImages ?? size_guide_images).filter(
              (url: unknown) => typeof url === "string" && url.trim(),
            )
          : [],
        show_web: finalShowWeb ?? true,
      })
      .select("id")
      .single();

    if (productError || !newProduct)
      throw productError || new Error("Error al crear el producto");
    createdProductId = newProduct.id;

    // 2b. Guardar galería por color (si se enviaron fotos específicas).
    if (Array.isArray(colorPhotos) && colorPhotos.length > 0) {
      const rows = colorPhotos
        .filter((photo: any) => photo?.color && photo?.url)
        .map((photo: any, index: number) => ({
          product_id: createdProductId,
          color: String(photo.color).trim(),
          url: String(photo.url).trim(),
          position_x: Number(photo.position_x ?? 50),
          position_y: Number(photo.position_y ?? 50),
          sort_order: Number(photo.sort_order ?? index),
        }));
      if (rows.length) {
        const { error: photosInsertError } = await supabase
          .from("product_photos")
          .insert(rows);
        if (photosInsertError) throw photosInsertError;
      }
    }

    // 3. Insertar Variantes asociadas
    let createdVariants: any[] = [];
    if (Array.isArray(variants) && variants.length > 0) {
      const variantsToInsert = variants.map((v: any) => ({
        product_id: createdProductId,
        color: v.color || null,
        size: v.size || null,
        stock: Number(v.stock || 0),
        sku: v.sku || null,
      }));

      const { data: insertedVariants, error: variantsError } = await supabase
        .from("product_variants")
        .insert(variantsToInsert)
        .select();

      if (variantsError) throw variantsError;
      createdVariants = insertedVariants || [];
    }

    // 4. Registrar en Historial de Stock si hay cantidades iniciales mayores a 0
    const historyEntries = createdVariants
      .filter((v: any) => Number(v.stock) > 0)
      .map((v: any) => ({
        product_id: createdProductId,
        variant_id: v.id,
        quantity_change: Number(v.stock),
        type: "INITIAL_STOCK",
        notes: "Stock inicial registrado al crear producto",
      }));

    if (historyEntries.length > 0) {
      const { error: historyError } = await supabase
        .from("stock_history")
        .insert(historyEntries);
      if (historyError)
        console.error("Error registrando historial inicial:", historyError);
    }

    return NextResponse.json(
      { success: true, productId: createdProductId },
      { status: 201 },
    );
  } catch (error: any) {
    console.error("Error en POST /api/products:", error);

    // Rollback manual: Si se creó el producto pero fallaron las variantes o procesos posteriores
    if (createdProductId) {
      await supabase.from("products").delete().eq("id", createdProductId);
    }

    return NextResponse.json(
      { error: error.message || "Error al guardar el producto" },
      { status: 500 },
    );
  }
}

// ========================================================
// PATCH: Modificaciones (Visibilidad, Ajuste Stock, Edición)
// ========================================================
export async function PATCH(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: any;

  // 1. Lectura segura del JSON entrante
  try {
    body = await req.json();
  } catch (parseError: any) {
    console.error("Error al parsear el JSON entrante:", parseError);
    return NextResponse.json(
      {
        error:
          "El cuerpo de la petición no es un JSON válido o es demasiado grande.",
      },
      { status: 400 },
    );
  }

  try {
    const { action } = body;

    switch (action) {
      case "toggle-visibility": {
        const { productId, show_web } = body;
        if (!productId)
          return NextResponse.json(
            { error: "productId es requerido" },
            { status: 400 },
          );

        const { error } = await supabase
          .from("products")
          .update({ show_web: Boolean(show_web) })
          .eq("id", productId);

        if (error) throw error;
        return NextResponse.json({ success: true });
      }

      case "update-stock": {
        const { variantId, change, arrivalDate } = body;
        if (!variantId || change == null)
          return NextResponse.json(
            { error: "variantId y change son requeridos" },
            { status: 400 },
          );

        // Traemos también el nombre del producto y los datos de la
        // variante, porque stock_history guarda esta información
        // repetida en cada fila (no solo los ids).
        const { data: variant, error: fetchErr } = await supabase
          .from("product_variants")
          .select("id, product_id, stock, color, size, sku, products ( name )")
          .eq("id", variantId)
          .single();

        if (fetchErr || !variant)
          throw fetchErr || new Error("Variante no encontrada");

        const newStock = Math.max(
          0,
          Number(variant.stock || 0) + Number(change),
        );

        const { error: updateErr } = await supabase
          .from("product_variants")
          .update({ stock: newStock })
          .eq("id", variantId);

        if (updateErr) throw updateErr;

        // "Historial de Entradas" es solo para mercancía que LLEGA.
        // Un descuento manual (change negativo) no se registra ahí.
        if (Number(change) > 0) {
          const product = Array.isArray(variant.products)
            ? variant.products[0]
            : (variant as any).products;

          await supabase.from("stock_history").insert({
            product_id: variant.product_id,
            variant_id: variantId,
            product_name: product?.name || "",
            color: variant.color || "",
            size: variant.size || "",
            sku: variant.sku || "",
            quantity: Number(change),
            arrival_date: arrivalDate || null,
          });
        }

        return NextResponse.json({ success: true, newStock });
      }

      case "update-product": {
        const targetProduct = body.product || body;
        const productId =
          body.productId || targetProduct.id || targetProduct.productId;

        const {
          name,
          description,
          careDetails,
          care_details,
          dollar_price,
          dollarPrice,
          cost_usd,
          cost,
          category_name,
          category,
          images,
          sizeGuideImages,
          size_guide_images,
          show_web,
          webVisible,
          variants,
          colorPhotos,
        } = targetProduct;

        const finalDollarPrice = dollar_price ?? dollarPrice;
        const finalCost = Number(cost_usd ?? cost ?? 0);
        const finalCategoryName = category_name ?? category;
        const finalShowWeb = show_web ?? webVisible;

        if (!productId) {
          return NextResponse.json(
            { error: "productId es requerido" },
            { status: 400 },
          );
        }

        const categoryId = finalCategoryName
          ? await getOrCreateCategory(finalCategoryName)
          : null;

        const { error: prodUpdateErr } = await supabase
          .from("products")
          .update({
            name,
            description: description || "",
            care_details: String(careDetails ?? care_details ?? ""),
            dollar_price: Number(finalDollarPrice || 0),
            cost_usd: finalCost,
            category_id: categoryId,
            images: images || [],
            ...(Array.isArray(sizeGuideImages ?? size_guide_images)
              ? {
                  size_guide_images: (
                    sizeGuideImages ?? size_guide_images
                  ).filter(
                    (url: unknown) => typeof url === "string" && url.trim(),
                  ),
                }
              : {}),
            show_web: Boolean(finalShowWeb),
            updated_at: new Date().toISOString(),
          })
          .eq("id", productId);

        if (prodUpdateErr) throw prodUpdateErr;

        if (Array.isArray(variants)) {
          const { data: existingVariants, error: fetchVarErr } = await supabase
            .from("product_variants")
            .select("id, stock")
            .eq("product_id", productId);

          if (fetchVarErr) throw fetchVarErr;

          const existingMap = new Map(
            (existingVariants || []).map((v) => [v.id, Number(v.stock || 0)]),
          );
          const incomingIds = new Set(
            variants.filter((v: any) => v.id).map((v: any) => v.id),
          );

          const idsToDelete = (existingVariants || [])
            .filter((v) => !incomingIds.has(v.id))
            .map((v) => v.id);
          if (idsToDelete.length > 0) {
            const { error: delErr } = await supabase
              .from("product_variants")
              .delete()
              .in("id", idsToDelete);
            if (delErr) throw delErr;
          }

          const historyEntries: any[] = [];

          for (const v of variants) {
            let savedVariant: { id: string; stock: number } | null = null;

            if (v.id) {
              const { data, error: updateVarErr } = await supabase
                .from("product_variants")
                .update({
                  color: v.color || null,
                  size: v.size || null,
                  stock: Number(v.stock || 0),
                  sku: v.sku || null,
                })
                .eq("id", v.id)
                .select("id, stock")
                .single();

              if (updateVarErr) throw updateVarErr;
              savedVariant = data;
            } else {
              const { data, error: insertVarErr } = await supabase
                .from("product_variants")
                .insert({
                  product_id: productId,
                  color: v.color || null,
                  size: v.size || null,
                  stock: Number(v.stock || 0),
                  sku: v.sku || null,
                })
                .select("id, stock")
                .single();

              if (insertVarErr) throw insertVarErr;
              savedVariant = data;
            }

            const oldStock = Number(
              v.id && existingMap.has(v.id) ? (existingMap.get(v.id) ?? 0) : 0,
            );
            const newStock = Number(v.stock || 0);
            const stockIncrease = newStock - oldStock;

            if (stockIncrease > 0 && savedVariant) {
              historyEntries.push({
                product_id: productId,
                variant_id: savedVariant.id,
                quantity_change: stockIncrease,
                type: v.id ? "RESTOCK" : "INITIAL_STOCK",
                notes: v.id
                  ? "Incremento de stock por edición"
                  : "Stock inicial de nueva variante",
              });
            }
          }

          if (historyEntries.length > 0) {
            await supabase.from("stock_history").insert(historyEntries);
          }
        }

        // Solo reemplazamos la galería por color cuando el cliente envía
        // explícitamente colorPhotos. Si no viene, preservamos las fotos existentes.
        if (Array.isArray(colorPhotos)) {
          const { error: deletePhotosError } = await supabase
            .from("product_photos")
            .delete()
            .eq("product_id", productId);
          if (deletePhotosError) throw deletePhotosError;

          const photoRows = colorPhotos
            .filter((photo: any) => photo?.color && photo?.url)
            .map((photo: any, index: number) => ({
              product_id: productId,
              color: String(photo.color).trim(),
              url: String(photo.url).trim(),
              position_x: Number(photo.position_x ?? 50),
              position_y: Number(photo.position_y ?? 50),
              sort_order: Number(photo.sort_order ?? index),
            }));

          if (photoRows.length) {
            const { error: insertPhotosError } = await supabase
              .from("product_photos")
              .insert(photoRows);
            if (insertPhotosError) throw insertPhotosError;
          }
        }

        return NextResponse.json({ success: true, productId });
      }

      default:
        return NextResponse.json(
          { error: "Acción no válida" },
          { status: 400 },
        );
    }
  } catch (error: any) {
    console.error("DETALLE ERROR 500 SERVIDOR:", error);
    return NextResponse.json(
      { error: error?.message || "Error interno del servidor", details: error },
      { status: 500 },
    );
  }
}

// ========================================================
// DELETE: Archivar Producto (borrado suave)
// ========================================================
export async function DELETE(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { error: "productId es requerido" },
        { status: 400 },
      );
    }

    // En vez de borrar, archivamos: así los pedidos viejos no se rompen
    const { error } = await supabase
      .from("products")
      .update({ is_archived: true, show_web: false })
      .eq("id", productId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error en DELETE /api/products:", error);
    return NextResponse.json(
      { error: error.message || "Error al archivar el producto" },
      { status: 500 },
    );
  }
}
