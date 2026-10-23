export interface InventoryVariant {
  id: string;
  color: string;
  size: string;
  sku: string;
  initialStock: number;
  stock: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;

  // Precio que tú estipulas para pagos directos en $
  dollarPrice: number;

  // Precio publicado calculado con BNC / BCV
  price: number;

  cost: number;

  webVisible: boolean;

  images: string[];

  sizeGuideImages: string[];

  careDetails: string;

  variants: InventoryVariant[];
}

export interface Rates {
  tasaBCV: number;
  tasaBNC: number;
  discountPercent?: number;
}

export const DEFAULT_RATES: Rates = {
  tasaBCV: 745,
  tasaBNC: 1000,
  discountPercent: 15,
};

/*
  Calcula el precio publicado.

  Precio estipulado en $
  × BNC
  ÷ BCV

  Si roundPricesUp está activado,
  se redondea hacia arriba.
*/
export function calculatePricing(
  dollarPrice: number,
  rates: Rates,
  roundPricesUp = true,
) {
  const tasaBCV =
    rates.tasaBCV && rates.tasaBCV > 0 ? rates.tasaBCV : DEFAULT_RATES.tasaBCV;

  const tasaBNC =
    rates.tasaBNC && rates.tasaBNC > 0 ? rates.tasaBNC : DEFAULT_RATES.tasaBNC;

  const discountPercent =
    typeof rates.discountPercent === "number"
      ? rates.discountPercent
      : DEFAULT_RATES.discountPercent;

  if (!dollarPrice || dollarPrice <= 0) {
    return {
      priceBsFormatted: "0,00",
      priceBCVFormatted: "0.00",
      cashUSDFormatted: "0.00",
      discountPercent,
    };
  }

  // Precio publicado antes del redondeo
  const rawPublishedUSD = (dollarPrice * tasaBNC) / tasaBCV;

  // Precio publicado final
  const publishedUSD = roundPricesUp
    ? Math.ceil(rawPublishedUSD)
    : rawPublishedUSD;

  // Los Bs se calculan usando el precio publicado FINAL
  const publishedBs = publishedUSD * tasaBCV;

  return {
    priceBsFormatted: publishedBs.toLocaleString("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),

    priceBCVFormatted: publishedUSD.toFixed(2),

    cashUSDFormatted: dollarPrice.toFixed(2),

    discountPercent,
  };
}
/*
  Convierte los productos de la API (un producto con variantes adentro)
  en filas planas: una fila por cada combinación de color y talla.
*/
export function flattenProducts(products: any[]) {
  return products.flatMap((product) => {
    const base = {
      productId: product.id,
      name: product.name,
      category: product.category_name || product.category || "Sin categoría",
      price: Number(product.dollar_price ?? product.price ?? 0),
      images: Array.isArray(product.images) ? product.images : [],
      webVisible: product.show_web ?? product.webVisible ?? true,
    };

    const variants = Array.isArray(product.variants) ? product.variants : [];

    // Producto sin variantes: una sola fila sin stock
    if (variants.length === 0) {
      return [{ ...base, id: product.id, stock: 0 }];
    }

    return variants.map((v: any) => ({
      ...base,
      id: v.id,
      color: v.color ?? undefined,
      size: v.size ?? undefined,
      stock: Number(v.stock ?? 0),
    }));
  });
}
/*
  Versión numérica de calculatePricing (para sumar totales).

  cashUSD      = tu precio exacto en dólares
  publishedUSD = precio × BNC ÷ BCV, redondeado hacia arriba
  publishedBs  = publishedUSD × BCV
*/
export function getPriceNumbers(dollarPrice: number, rates: Rates) {
  const tasaBCV =
    rates.tasaBCV && rates.tasaBCV > 0 ? rates.tasaBCV : DEFAULT_RATES.tasaBCV;
  const tasaBNC =
    rates.tasaBNC && rates.tasaBNC > 0 ? rates.tasaBNC : DEFAULT_RATES.tasaBNC;

  const publishedUSD = Math.ceil((dollarPrice * tasaBNC) / tasaBCV);

  return {
    cashUSD: dollarPrice,
    publishedUSD,
    publishedBs: publishedUSD * tasaBCV,
  };
}
