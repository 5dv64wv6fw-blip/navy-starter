"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AdminMenu from "@/components/admin/AdminMenu";
import { createClient } from "@/lib/supabase/client";

interface ProductVariant {
  id: string;
  color: string;
  size: string;
  sku: string;
  initialStock: number;
  stock: number;
}

interface Product {
  id: string;
  name: string;
  category: string;
  dollarPrice: number;
  price: number;
  cost: number;
  webVisible: boolean;
  images: string[];
  colorPhotos?: Record<string, string[]>;
  colorPhotoPositions?: Record<
    string,
    Record<string, { x: number; y: number }>
  >;
  sizeGuideImages: string[];
  careDetails: string;
  variants: ProductVariant[];
}

interface HistoryItem {
  id: string;
  date: string;
  arrivalDate?: string;
  productName: string;
  color: string;
  size: string;
  sku: string;
  quantity: number;
}

const categoriesList = ["Todos", "Tops", "Bottoms", "Dresses", "Accesorios"];

const sizesList = ["XS", "XS/S", "S", "S/M", "M", "L", "XL", "U"];

const defaultImage =
  "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300";

// Nombre del bucket de Supabase Storage donde viven las fotos
const PRODUCT_IMAGES_BUCKET = "product-images";

/*
  Productos iniciales de respaldo.
  El precio en $ es el precio que tú estipulas.
*/
const initialStock: Product[] = [
  {
    id: "3",
    name: "Luna Top",
    category: "Tops",
    dollarPrice: 25,
    price: 34,
    cost: 12,
    webVisible: true,
    images: [
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=300",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300",
    ],
    sizeGuideImages: [],
    careDetails: "Lavar a mano con agua fría. No usar secadora.",
    variants: [
      {
        id: "v1",
        color: "Navy",
        size: "XS/S",
        sku: "LUNA-TOP-NAVY-XSS",
        initialStock: 3,
        stock: 3,
      },
      {
        id: "v2",
        color: "Navy",
        size: "S/M",
        sku: "LUNA-TOP-NAVY-SM",
        initialStock: 5,
        stock: 5,
      },
      {
        id: "v3",
        color: "Ivory",
        size: "XS/S",
        sku: "LUNA-TOP-IVORY-XSS",
        initialStock: 2,
        stock: 2,
      },
      {
        id: "v4",
        color: "Ivory",
        size: "S/M",
        sku: "LUNA-TOP-IVORY-SM",
        initialStock: 4,
        stock: 4,
      },
    ],
  },
  {
    id: "1",
    name: "Cartera Marrón",
    category: "Accesorios",
    dollarPrice: 25,
    price: 34,
    cost: 13,
    webVisible: true,
    images: ["https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300"],
    sizeGuideImages: [],
    careDetails: "Limpiar con un paño suave y seco.",
    variants: [
      {
        id: "v5",
        color: "Marrón",
        size: "U",
        sku: "CARTERA-MARRON-U",
        initialStock: 1,
        stock: 1,
      },
    ],
  },
];

const initialHistory: HistoryItem[] = [];

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sizeCode(size: string) {
  return size.replace("XS/S", "XSS").replace("S/M", "SM").replace("/", "");
}

function makeSku(name: string, color: string, size: string) {
  return `${slug(name)}-${slug(color)}-${sizeCode(size)}`;
}

// Lee la categoría que devuelve la API (category_name).
// Si el producto no tiene categoría, lo dejamos visible como "Sin categoría".
function readCategory(raw: any): string {
  const name = raw.category_name || raw.category;
  return name && name !== "Sin categoría" ? name : "Sin categoría";
}

// CAMBIO: devuelve la fecha (AAAA-MM-DD) en hora de Venezuela.
// Las fechas de llegada ya son de calendario y se respetan tal cual.
// Las marcas de tiempo de la base de datos (UTC) se convierten a hora local.
function toCaracasDate(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/*
  La base de datos guarda cada entrada con "created_at" y "arrival_date".
  La pantalla espera "date" y "arrivalDate".
*/
function normalizeHistoryItem(raw: any): HistoryItem {
  return {
    id: String(raw.id ?? `${Date.now()}-${Math.random()}`),
    date: raw.date || raw.created_at || new Date().toISOString(),
    arrivalDate: raw.arrivalDate || raw.arrival_date || undefined,
    productName: raw.productName || raw.product_name || "Sin nombre",
    color: raw.color || "",
    size: raw.size || "",
    sku: raw.sku || "",
    quantity: Number(raw.quantity ?? 0),
  };
}

function normalizeColorPhotos(raw: any): Record<string, string[]> {
  if (!Array.isArray(raw)) return raw && typeof raw === "object" ? raw : {};
  return raw.reduce((acc: Record<string, string[]>, photo: any) => {
    const color = String(photo?.color || "").trim();
    const url = String(photo?.url || "").trim();
    if (color && url) acc[color] = [...(acc[color] || []), url];
    return acc;
  }, {});
}

function normalizeColorPhotoPositions(
  raw: any,
): Record<string, Record<string, { x: number; y: number }>> {
  if (!Array.isArray(raw)) return {};
  return raw.reduce(
    (
      acc: Record<string, Record<string, { x: number; y: number }>>,
      photo: any,
    ) => {
      const color = String(photo?.color || "").trim();
      const url = String(photo?.url || "").trim();
      if (!color || !url) return acc;
      if (!acc[color]) acc[color] = {};
      acc[color][url] = {
        x: Math.max(0, Math.min(100, Number(photo?.position_x ?? 50))),
        y: Math.max(0, Math.min(100, Number(photo?.position_y ?? 50))),
      };
      return acc;
    },
    {},
  );
}

function normalizeProduct(raw: any): Product {
  const dollarPrice = Number(
    raw.dollarPrice ?? raw.dollar_price ?? raw.price_usd ?? 0,
  );

  if (Array.isArray(raw.variants)) {
    return {
      id: String(raw.id),
      name: raw.name || "Sin nombre",
      category: readCategory(raw),

      dollarPrice,

      price: Number(raw.price || 0),
      cost: Number(raw.cost || raw.cost_usd || 0),

      webVisible: raw.webVisible !== false,

      images: raw.images || [],
      colorPhotos: normalizeColorPhotos(raw.colorPhotos),
      colorPhotoPositions: normalizeColorPhotoPositions(raw.colorPhotos),
      sizeGuideImages: raw.sizeGuideImages || raw.size_guide_images || [],

      careDetails: raw.careDetails || raw.care || "",

      variants: raw.variants.map((v: any) => ({
        id: String(v.id || Date.now()),
        color: v.color || "Único",
        size: v.size || "U",

        sku:
          v.sku ||
          makeSku(raw.name || "PRODUCTO", v.color || "UNICO", v.size || "U"),

        initialStock: Number(v.initialStock ?? v.initial_stock ?? v.stock ?? 0),

        stock: Number(v.stock ?? 0),
      })),
    };
  }

  // Compatibilidad con estructura anterior
  return {
    id: String(raw.id),
    name: raw.name || "Sin nombre",
    category: raw.category || "Tops",

    dollarPrice,

    price: Number(raw.price || 0),
    cost: Number(raw.cost || raw.cost_usd || 0),

    webVisible: raw.webVisible !== false,

    images: raw.images || [],
    colorPhotos: normalizeColorPhotos(raw.colorPhotos),
    sizeGuideImages: raw.sizeGuideImages || raw.size_guide_images || [],

    careDetails: raw.careDetails || raw.care || "",

    variants: [
      {
        id: `legacy-${raw.id}`,
        color: raw.color || "Único",
        size: raw.size || "U",

        sku:
          raw.sku ||
          makeSku(
            raw.name || "PRODUCTO",
            raw.color || "UNICO",
            raw.size || "U",
          ),

        initialStock: Number(
          raw.initialStock ?? raw.initial_stock ?? raw.stock ?? 0,
        ),

        stock: Number(raw.stock ?? 0),
      },
    ],
  };
}

export default function InventoryPage() {
  const supabase = createClient();

  const [inventory, setInventory] = useState<Product[]>([]);

  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);

  const [activeMainTab, setActiveMainTab] = useState<"inventory" | "history">(
    "inventory",
  );

  const [stockFilter, setStockFilter] = useState<
    "instock" | "outstock" | "all"
  >("instock");

  const [categoryFilter, setCategoryFilter] = useState("Todos");

  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingItem, setEditingItem] = useState<Product | null>(null);

  /*
    Tasas
  */
  const [tasaBnc, setTasaBnc] = useState(1000);

  const [tasaBcv, setTasaBcv] = useState(745);

  /*
    Este porcentaje es SOLO la promoción
    que se muestra al pagar en $.

    NO se utiliza para calcular el precio
    en dólares.
  */
  const [discountPercent, setDiscountPercent] = useState(15);

  /*
    Redondeo del precio publicado
  */
  const [roundPricesUp, setRoundPricesUp] = useState(true);

  /*
    Formulario
  */
  const [formName, setFormName] = useState("");

  const [formCategory, setFormCategory] = useState("Tops");

  /*
    Costo real de la pieza
  */
  const [formCost, setFormCost] = useState<number | "">("");

  /*
    Precio en dólares que TÚ estipulas.
    Este es el precio que el cliente paga
    si paga directamente en $.
  */
  const [formDollarPrice, setFormDollarPrice] = useState<number | "">("");

  const [formWebVisible, setFormWebVisible] = useState(true);

  const [formImages, setFormImages] = useState<string[]>([]);
  const [formColorPhotos, setFormColorPhotos] = useState<
    Record<string, string[]>
  >({});
  const [formColorPhotoPositions, setFormColorPhotoPositions] = useState<
    Record<string, Record<string, { x: number; y: number }>>
  >({});
  const [colorPhotoUrlInputs, setColorPhotoUrlInputs] = useState<
    Record<string, string>
  >({});

  const [formGuideImages, setFormGuideImages] = useState<string[]>([]);

  const [formCare, setFormCare] = useState("");

  const [formArrivalDate, setFormArrivalDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const [imageUrlInput, setImageUrlInput] = useState("");

  const [guideUrlInput, setGuideUrlInput] = useState("");

  const [formColors, setFormColors] = useState<string[]>([]);

  const [newColor, setNewColor] = useState("");

  const [variantDrafts, setVariantDrafts] = useState<
    Record<string, Record<string, number>>
  >({});

  // Mientras se suben fotos a Supabase Storage, deshabilitamos el input
  // y mostramos un aviso para que no parezca que la pantalla se congeló.
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingGuide, setUploadingGuide] = useState(false);

  /*
    Cargar información desde la API.
    La usamos al entrar a la página y también
    después de crear/editar un producto, para
    traer siempre los ids reales de Supabase.
  */
  const reloadInventory = async () => {
    try {
      const res = await fetch("/api/inventory", { cache: "no-store" });

      if (!res.ok) {
        throw new Error("API error");
      }

      const data = await res.json();

      setInventory((data.products || initialStock).map(normalizeProduct));

      setHistory((data.history || initialHistory).map(normalizeHistoryItem));

      setTasaBnc(data.rates?.tasaBNC ?? 1000);

      setTasaBcv(data.rates?.tasaBCV ?? 745);

      if (typeof data.rates?.discountPercent === "number") {
        setDiscountPercent(data.rates.discountPercent);
      }
    } catch (error) {
      console.error("Error cargando inventario:", error);
      setInventory((prev) => (prev.length ? prev : initialStock));
    }
  };

  useEffect(() => {
    reloadInventory();
  }, []);

  /*
    PRECIO PUBLICADO
    Precio estipulado en $ × BNC ÷ BCV
  */
  const calculatePublishedPrice = (dollarPrice: number) => {
    if (!dollarPrice || tasaBnc <= 0 || tasaBcv <= 0) {
      return 0;
    }

    const calculated = (dollarPrice * tasaBnc) / tasaBcv;

    return roundPricesUp ? Math.ceil(calculated) : calculated;
  };

  /*
    Guarda las tasas y el porcentaje.
  */
  const saveRates = async () => {
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tasaBnc,
          tasaBcv,
          discountPercent,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudieron guardar las tasas");
      }

      alert("Configuración guardada.");
    } catch (error) {
      console.error(error);
      alert("Las tasas quedaron en pantalla, pero no se pudieron guardar.");
    }
  };

  /*
    Reiniciar formulario
  */
  const resetForm = () => {
    setEditingItem(null);

    setFormName("");
    setFormCategory("Tops");

    setFormCost("");
    setFormDollarPrice("");

    setFormWebVisible(true);

    setFormImages([]);
    setFormColorPhotos({});
    setFormColorPhotoPositions({});
    setColorPhotoUrlInputs({});
    setFormGuideImages([]);

    setFormCare("");

    setImageUrlInput("");
    setGuideUrlInput("");

    setFormColors([]);
    setNewColor("");

    setVariantDrafts({});

    setFormArrivalDate(new Date().toISOString().split("T")[0]);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  /*
    Editar producto
  */
  const openEditModal = (item: Product) => {
    setEditingItem(item);

    setFormName(item.name);
    setFormCategory(
      categoriesList.includes(item.category) ? item.category : "Tops",
    );

    setFormCost(item.cost);

    setFormDollarPrice(item.dollarPrice > 0 ? item.dollarPrice : "");

    setFormArrivalDate(new Date().toISOString().split("T")[0]);

    setFormWebVisible(item.webVisible);

    setFormImages(item.images || []);
    setFormColorPhotos(item.colorPhotos || {});
    setFormColorPhotoPositions(item.colorPhotoPositions || {});
    setColorPhotoUrlInputs({});

    setFormGuideImages(item.sizeGuideImages || []);

    setFormCare(item.careDetails || "");

    const colors = [...new Set(item.variants.map((v) => v.color))];

    setFormColors(colors);

    const drafts: Record<string, Record<string, number>> = {};

    colors.forEach((color) => {
      drafts[color] = {};

      item.variants
        .filter((v) => v.color === color)
        .forEach((v) => {
          drafts[color][v.size] = v.stock;
        });
    });

    setVariantDrafts(drafts);

    setNewColor("");
    setImageUrlInput("");
    setGuideUrlInput("");

    setIsModalOpen(true);
  };

  /*
    Colores
  */
  const addColor = () => {
    const color = newColor.trim();

    if (!color || formColors.includes(color)) {
      return;
    }

    setFormColors((prev) => [...prev, color]);

    setVariantDrafts((prev) => ({
      ...prev,
      [color]: {},
    }));

    setNewColor("");
  };

  const removeColor = (color: string) => {
    setFormColors((prev) => prev.filter((c) => c !== color));
    setFormColorPhotos((prev) => {
      const copy = { ...prev };
      delete copy[color];
      return copy;
    });
    setFormColorPhotoPositions((prev) => {
      const copy = { ...prev };
      delete copy[color];
      return copy;
    });
    setColorPhotoUrlInputs((prev) => {
      const copy = { ...prev };
      delete copy[color];
      return copy;
    });

    setVariantDrafts((prev) => {
      const copy = {
        ...prev,
      };

      delete copy[color];

      return copy;
    });
  };

  /*
    Tallas
  */
  const toggleSize = (color: string, size: string) => {
    setVariantDrafts((prev) => {
      const current = {
        ...(prev[color] || {}),
      };

      if (Object.prototype.hasOwnProperty.call(current, size)) {
        delete current[size];
      } else {
        current[size] = 0;
      }

      return {
        ...prev,
        [color]: current,
      };
    });
  };

  const setVariantStock = (color: string, size: string, value: number) => {
    setVariantDrafts((prev) => ({
      ...prev,
      [color]: {
        ...(prev[color] || {}),
        [size]: Math.max(0, value),
      },
    }));
  };

  /*
    URLs
  */
  const addUrl = (
    url: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    clear: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (!url.trim()) {
      return;
    }

    setter((prev) => [...prev, url.trim()]);

    clear("");
  };

  /*
    Fotos — subida real a Supabase Storage.
  */
  const uploadFilesToStorage = async (
    fileArray: File[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    setUploading: React.Dispatch<React.SetStateAction<boolean>>,
  ) => {
    setUploading(true);

    try {
      for (const file of fileArray) {
        try {
          // Un nombre único para que dos fotos nunca se sobrescriban entre sí
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

          const { error } = await supabase.storage
            .from(PRODUCT_IMAGES_BUCKET)
            .upload(path, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (error) {
            console.error("Error subiendo imagen:", error);
            alert(`No se pudo subir "${file.name}": ${error.message}`);
            continue;
          }

          const { data } = supabase.storage
            .from(PRODUCT_IMAGES_BUCKET)
            .getPublicUrl(path);

          setter((prev) => [...prev, data.publicUrl]);
        } catch (fileError) {
          // Un fallo con ESTE archivo no debe detener a los demás
          console.error(`Error inesperado subiendo "${file.name}":`, fileError);
          alert(
            `No se pudo subir "${file.name}". Revisa la consola (F12) para más detalles.`,
          );
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleImageFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Copiamos la lista antes de limpiar el input
    const fileArray = Array.from(files);
    e.target.value = "";

    uploadFilesToStorage(fileArray, setFormImages, setUploadingImages);
  };

  const handleGuideFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    e.target.value = "";

    uploadFilesToStorage(fileArray, setFormGuideImages, setUploadingGuide);
  };

  /*
    GUARDAR PRODUCTO
  */
  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formName.trim() ||
      formCost === "" ||
      formDollarPrice === "" ||
      formColors.length === 0
    ) {
      alert("Completa nombre, costo, precio pagando en $ y al menos un color.");

      return;
    }

    const variants: ProductVariant[] = [];

    formColors.forEach((color) => {
      Object.entries(variantDrafts[color] || {}).forEach(([size, stock]) => {
        const old = editingItem?.variants.find(
          (v) => v.color === color && v.size === size,
        );

        variants.push({
          id: old?.id || `${Date.now()}-${variants.length}`,

          color,
          size,

          sku: old?.sku || makeSku(formName, color, size),

          initialStock: old?.initialStock ?? Number(stock),

          stock: Number(stock),
        });
      });
    });

    if (!variants.length) {
      alert("Selecciona al menos una combinación de color y talla.");

      return;
    }

    /*
      formDollarPrice = precio que tú estipulas.
      El precio publicado se calcula usando ESE precio.
    */
    const dollarPrice = Number(formDollarPrice);

    const publishedPrice = calculatePublishedPrice(dollarPrice);

    const product: Product = {
      id: editingItem?.id || Date.now().toString(),
      name: formName.trim(),
      category: formCategory,
      dollarPrice,
      price: publishedPrice,
      cost: Number(formCost),
      webVisible: formWebVisible,
      images: formImages.length ? formImages : [defaultImage],
      colorPhotos: formColorPhotos,
      sizeGuideImages: formGuideImages,
      careDetails: formCare,
      variants,
    };

    try {
      // ¿Este id es un UUID real de Supabase? (los ids temporales no lo son)
      const isUuid = (value: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          value,
        );

      // Traducimos nuestro producto al formato que espera la API
      const payload = {
        ...(editingItem
          ? { action: "update-product", productId: editingItem.id }
          : {}),
        name: product.name,
        dollar_price: product.dollarPrice,
        cost_usd: product.cost,
        category_name: product.category,
        images: product.images,
        sizeGuideImages: product.sizeGuideImages,
        careDetails: product.careDetails,
        colorPhotos: Object.entries(formColorPhotos).flatMap(([color, urls]) =>
          (urls as string[]).map((url, index) => ({
            color,
            url,
            position_x: formColorPhotoPositions[color]?.[url]?.x ?? 50,
            position_y: formColorPhotoPositions[color]?.[url]?.y ?? 50,
            sort_order: index,
          })),
        ),
        show_web: product.webVisible,
        variants: product.variants.map((v) => ({
          // Solo mandamos el id si ya existe en la base de datos
          ...(isUuid(v.id) ? { id: v.id } : {}),
          color: v.color,
          size: v.size,
          sku: v.sku,
          stock: v.stock,
        })),
      };

      const response = await fetch("/api/inventory", {
        method: editingItem ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const rawText = await response.text();
        let errorData: any = null;

        try {
          errorData = JSON.parse(rawText);
        } catch {
          console.error(
            `[Error HTTP ${response.status}] El servidor respondió con HTML/Texto:`,
            rawText,
          );
        }

        console.error(
          "ERROR REAL DEL API:",
          JSON.stringify(errorData ?? rawText, null, 2),
        );

        throw new Error(
          errorData?.error ||
            errorData?.message ||
            `Error ${response.status}: No se pudo guardar el producto.`,
        );
      }

      /*
        Volvemos a pedir el inventario completo a la API.
        Así traemos los ids reales que generó Supabase.
      */
      await reloadInventory();

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("ERROR GUARDANDO PRODUCTO:", error);

      alert(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el producto.",
      );
    }
  };

  /*
    Actualizar stock

    Cambia el número en pantalla al instante y lo guarda en Supabase
    con la acción "update-stock". Si falla, revertimos la pantalla.
  */
  const updateStock = async (
    productId: string,
    variantId: string,
    amount: number,
  ) => {
    const product = inventory.find((p) => p.id === productId);
    const variant = product?.variants.find((v) => v.id === variantId);

    if (!product || !variant) return;

    const previousStock = variant.stock;
    const nextStock = Math.max(0, previousStock + amount);

    const arrivalDate =
      amount > 0
        ? window.prompt(
            "Fecha de llegada del stock (AAAA-MM-DD):",
            new Date().toISOString().split("T")[0],
          ) || new Date().toISOString().split("T")[0]
        : "";

    // 1. Actualizamos la pantalla al instante
    setInventory((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;

        return {
          ...p,
          variants: p.variants.map((v) =>
            v.id === variantId ? { ...v, stock: nextStock } : v,
          ),
        };
      }),
    );

    if (amount > 0) {
      setHistory((h) => [
        {
          id: `${Date.now()}`,
          date: new Date().toISOString(),
          arrivalDate,
          productName: product.name,
          color: variant.color,
          size: variant.size,
          sku: variant.sku,
          quantity: amount,
        },
        ...h,
      ]);
    }

    // 2. Guardamos el cambio en la base de datos
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-stock",
          variantId,
          change: amount,
          arrivalDate: amount > 0 ? arrivalDate : undefined,
        }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
    } catch (error) {
      // 3. Si falló, devolvemos la pantalla al estado anterior
      setInventory((prev) =>
        prev.map((p) => {
          if (p.id !== productId) return p;

          return {
            ...p,
            variants: p.variants.map((v) =>
              v.id === variantId ? { ...v, stock: previousStock } : v,
            ),
          };
        }),
      );

      if (amount > 0) {
        setHistory((h) => h.slice(1));
      }

      alert("No se pudo actualizar el stock. Inténtalo de nuevo.");
    }
  };

  /*
    Eliminar producto
  */
  const deleteProduct = async (id: string) => {
    if (
      !confirm("¿Eliminar esta prenda y todas sus variantes del inventario?")
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/inventory?productId=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Error ${res.status}`);
      }

      setInventory((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la prenda.",
      );
    }
  };

  /*
    Visibilidad web
  */
  const toggleVisibility = async (id: string) => {
    const product = inventory.find((p) => p.id === id);
    if (!product) return;

    const newValue = !product.webVisible;

    // 1. Actualizamos la pantalla al instante
    setInventory((prev) =>
      prev.map((p) => (p.id === id ? { ...p, webVisible: newValue } : p)),
    );

    // 2. Guardamos el cambio en la base de datos
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-visibility",
          productId: id,
          show_web: newValue,
        }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
    } catch (error) {
      // 3. Si falló, devolvemos la pantalla al estado anterior
      setInventory((prev) =>
        prev.map((p) => (p.id === id ? { ...p, webVisible: !newValue } : p)),
      );
      alert("No se pudo cambiar la visibilidad. Inténtalo de nuevo.");
    }
  };

  /*
    Expandir variantes
  */
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  /*
    Filtros
  */
  const filteredInventory = inventory.filter((p) => {
    const total = p.variants.reduce((s, v) => s + v.stock, 0);

    const stockOk =
      stockFilter === "instock"
        ? total > 0
        : stockFilter === "outstock"
          ? total === 0
          : true;

    return (
      stockOk && (categoryFilter === "Todos" || p.category === categoryFilter)
    );
  });

  /*
    HISTORIAL POR MES
    Agrupa las entradas por mes (AAAA-MM) según la hora de Venezuela,
    del más reciente al más antiguo.
  */
  const historyByMonth = (() => {
    const groups = new Map<string, HistoryItem[]>();

    for (const h of history) {
      const day = toCaracasDate(h.arrivalDate || h.date || "");
      if (!day) continue;
      const key = day.slice(0, 7);
      groups.set(key, [...(groups.get(key) || []), h]);
    }

    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => {
        const [y, m] = key.split("-").map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString("es-VE", {
          month: "long",
          year: "numeric",
        });
        return {
          key,
          label,
          items,
          totalUnits: items.reduce((s, i) => s + i.quantity, 0),
        };
      });
  })();

  const totalUnits = inventory.reduce(
    (s, p) => s + p.variants.reduce((x, v) => x + v.stock, 0),
    0,
  );

  /*
    Ganancia usando el precio publicado.
  */
  const currentProfit = inventory.reduce(
    (s, p) =>
      s + (p.price - p.cost) * p.variants.reduce((x, v) => x + v.stock, 0),
    0,
  );

  const tasaDiff =
    tasaBcv > 0 ? (((tasaBnc - tasaBcv) / tasaBcv) * 100).toFixed(1) : "0";

  return (
    <main className="admin-shell">
      {/* ENCABEZADO: mismo menú que el resto del panel */}
      <header
        className="admin-top"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link className="admin-logo" href="/admin">
          NAVY ADMIN
        </Link>
        <AdminMenu />
      </header>

      <div className="admin-main">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, margin: 0 }}>Inventory & Web Control</h1>

            <span style={{ fontSize: 13, color: "#666" }}>
              Navy - Clothing Store · V3
            </span>
          </div>

          <button
            onClick={openAddModal}
            style={{
              padding: "9px 16px",
              cursor: "pointer",
              background: "#18333a",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              fontWeight: 600,
            }}
          >
            + Add Product
          </button>
        </div>

        {/* CONFIGURACIÓN DE PRECIOS */}
        <section
          style={{
            marginBottom: 20,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 12 }}>
            Configuración de precios
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
              gap: 12,
            }}
          >
            <div>
              <small>Tasa BNC (Bs)</small>

              <input
                type="number"
                value={tasaBnc}
                onChange={(e) => setTasaBnc(Number(e.target.value))}
                style={inputStyle}
              />
            </div>

            <div>
              <small>Tasa BCV (Bs)</small>

              <input
                type="number"
                step="0.01"
                value={tasaBcv}
                onChange={(e) => setTasaBcv(Number(e.target.value))}
                style={inputStyle}
              />
            </div>

            <div>
              <small>Descuento pagando en $</small>

              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={discountPercent}
                  onChange={(e) =>
                    setDiscountPercent(
                      Math.max(0, Math.min(100, Number(e.target.value))),
                    )
                  }
                  style={{ ...inputStyle, marginTop: 5 }}
                />

                <span>%</span>
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                paddingTop: 20,
              }}
            >
              <input
                type="checkbox"
                checked={roundPricesUp}
                onChange={(e) => setRoundPricesUp(e.target.checked)}
              />
              Redondear hacia arriba
            </label>
          </div>

          <button onClick={saveRates} style={{ ...primaryBtn, marginTop: 16 }}>
            Guardar configuración
          </button>
        </section>

        {/* RESUMEN */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
            gap: 12,
            marginBottom: 20,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div>
            <small>Total unidades</small>

            <strong style={{ display: "block", fontSize: 18 }}>
              {totalUnits}
            </strong>
          </div>

          <div>
            <small>Diferencia entre tasas</small>

            <strong style={{ display: "block", fontSize: 18 }}>
              +{tasaDiff}%
            </strong>
          </div>

          <div>
            <small>Ganancia actual</small>

            <strong style={{ display: "block", fontSize: 18 }}>
              ${currentProfit.toFixed(2)}
            </strong>
          </div>
        </div>

        {/* TABS */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 16,
            borderBottom: "1px solid #eee",
            paddingBottom: 12,
          }}
        >
          <button
            onClick={() => setActiveMainTab("inventory")}
            style={{
              border: 0,
              background: "none",
              fontWeight: activeMainTab === "inventory" ? 700 : 400,
              cursor: "pointer",
            }}
          >
            Inventario Actual
          </button>

          <button
            onClick={() => setActiveMainTab("history")}
            style={{
              border: 0,
              background: "none",
              fontWeight: activeMainTab === "history" ? 700 : 400,
              cursor: "pointer",
            }}
          >
            Historial de Entradas 📅
          </button>
        </div>

        {activeMainTab === "inventory" ? (
          <>
            {/* FILTROS */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "1px solid #ccc",
                      background: categoryFilter === cat ? "#18333a" : "#fff",
                      color: categoryFilter === cat ? "#fff" : "#18333a",
                      cursor: "pointer",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {(["instock", "outstock", "all"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStockFilter(f)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "1px solid #ccc",
                      background: stockFilter === f ? "#eef3f3" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    {f === "instock"
                      ? "Disponibles"
                      : f === "outstock"
                        ? "Agotadas"
                        : "Todas"}
                  </button>
                ))}
              </div>
            </div>

            {/* PRODUCTOS */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredInventory.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#888",
                    padding: 30,
                  }}
                >
                  No hay productos que coincidan con los filtros.
                </p>
              ) : (
                filteredInventory.map((item) => {
                  const total = item.variants.reduce((s, v) => s + v.stock, 0);

                  const profit = item.price - item.cost;

                  const margin = item.price
                    ? Math.round((profit / item.price) * 100)
                    : 0;

                  const expanded = expandedIds.includes(item.id);

                  const colors = [
                    ...new Set(item.variants.map((v) => v.color)),
                  ];

                  const sizes = [...new Set(item.variants.map((v) => v.size))];

                  /*
                    Bs del precio publicado
                  */
                  const bs =
                    tasaBcv > 0
                      ? (item.price * tasaBcv).toLocaleString("es-VE", {
                          maximumFractionDigits: 2,
                        })
                      : "0,00";

                  return (
                    <article
                      key={item.id}
                      style={{
                        background: "#fff",
                        border: "1px solid #eee",
                        borderRadius: 8,
                        boxShadow: "0 1px 3px rgba(0,0,0,.05)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 16,
                          padding: "14px 16px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                            minWidth: 280,
                          }}
                        >
                          <img
                            src={item.images?.[0] || defaultImage}
                            alt={item.name}
                            style={{
                              width: 52,
                              height: 64,
                              objectFit: "cover",
                              borderRadius: 5,
                            }}
                          />

                          <div>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                              }}
                            >
                              <strong>{item.name}</strong>

                              <span
                                style={{
                                  fontSize: 11,
                                  background: "#eee",
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                }}
                              >
                                {item.category}
                              </span>
                            </div>

                            <div
                              style={{
                                color: "#777",
                                fontSize: 12,
                                marginTop: 5,
                              }}
                            >
                              {colors.length} color
                              {colors.length !== 1 ? "es" : ""} · {sizes.length}{" "}
                              talla
                              {sizes.length !== 1 ? "s" : ""} ·{" "}
                              {item.variants.length} variantes
                            </div>

                            <div style={{ color: "#777", fontSize: 12 }}>
                              Stock total:{" "}
                              <strong style={{ color: "#18333a" }}>
                                {total}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* PRECIOS */}
                        <div
                          style={{
                            display: "flex",
                            gap: 18,
                            flexWrap: "wrap",
                            fontSize: 12,
                          }}
                        >
                          <div>
                            <small>Precio publicado</small>

                            <strong style={{ display: "block" }}>
                              ${item.price}
                            </strong>

                            <span>Bs. {bs}</span>
                          </div>

                          <div>
                            <small>Pagando en $</small>

                            <strong style={{ display: "block", fontSize: 16 }}>
                              ${item.dollarPrice.toFixed(2)}
                            </strong>

                            <span style={{ color: "#18333a", fontWeight: 600 }}>
                              {discountPercent}% OFF
                            </span>
                          </div>

                          <div>
                            <small>Costo / Ganancia</small>

                            <span style={{ display: "block" }}>
                              ${item.cost} / <strong>${profit}</strong>
                            </span>

                            <small>Margen {margin}%</small>
                          </div>
                        </div>

                        {/* ACCIONES */}
                        <div
                          style={{
                            display: "flex",
                            gap: 7,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => toggleVisibility(item.id)}
                            style={{
                              padding: "5px 8px",
                              borderRadius: 12,
                              border: "1px solid #ccc",
                              background: item.webVisible
                                ? "#e8f5e9"
                                : "#f5f5f5",
                              cursor: "pointer",
                              fontSize: 11,
                            }}
                          >
                            {item.webVisible
                              ? "● Web: Visible"
                              : "○ Web: Oculto"}
                          </button>

                          <button
                            onClick={() => toggleExpanded(item.id)}
                            style={{
                              padding: "6px 10px",
                              border: "1px solid #ccc",
                              borderRadius: 5,
                              background: "#fff",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            {expanded
                              ? "Ocultar variantes ▲"
                              : "Ver variantes ▼"}
                          </button>

                          <button
                            onClick={() => openEditModal(item)}
                            style={{
                              padding: "6px 10px",
                              border: "1px solid #ccc",
                              borderRadius: 5,
                              background: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            ✏️ Editar
                          </button>

                          <button
                            onClick={() => deleteProduct(item.id)}
                            style={{
                              padding: "6px 10px",
                              border: "1px solid #ffcdd2",
                              color: "#d32f2f",
                              borderRadius: 5,
                              background: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* VARIANTES */}
                      {expanded && (
                        <div
                          style={{
                            borderTop: "1px solid #eee",
                            padding: 16,
                            background: "#fafafa",
                          }}
                        >
                          <div style={{ display: "grid", gap: 8 }}>
                            {item.variants.map((v) => (
                              <div
                                key={v.id}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1.2fr .8fr 2fr auto",
                                  gap: 10,
                                  alignItems: "center",
                                  padding: "9px 10px",
                                  background: "#fff",
                                  border: "1px solid #eee",
                                  borderRadius: 6,
                                  fontSize: 12,
                                }}
                              >
                                <strong>{v.color}</strong>

                                <span>{v.size}</span>

                                <span style={{ color: "#777" }}>
                                  SKU: {v.sku}
                                </span>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 5,
                                  }}
                                >
                                  <button
                                    onClick={() =>
                                      updateStock(item.id, v.id, -1)
                                    }
                                    disabled={v.stock <= 0}
                                    style={{
                                      width: 25,
                                      height: 25,
                                      border: 0,
                                      cursor: "pointer",
                                    }}
                                  >
                                    −
                                  </button>

                                  <strong
                                    style={{ minWidth: 22, textAlign: "center" }}
                                  >
                                    {v.stock}
                                  </strong>

                                  <button
                                    onClick={() =>
                                      updateStock(item.id, v.id, 1)
                                    }
                                    style={{
                                      width: 25,
                                      height: 25,
                                      border: 0,
                                      cursor: "pointer",
                                    }}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* HISTORIAL POR MES */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {historyByMonth.length === 0 && (
              <p style={{ color: "#888" }}>No hay registros.</p>
            )}

            {historyByMonth.map((group) => (
              <div
                key={group.key}
                style={{
                  background: "#fff",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 16,
                  overflowX: "auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <h3 style={{ margin: 0, textTransform: "capitalize" }}>
                    {group.label}
                  </h3>
                  <strong style={{ color: "green" }}>
                    +{group.totalUnits} unidades
                  </strong>
                </div>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        textAlign: "left",
                        borderBottom: "2px solid #eee",
                      }}
                    >
                      <th>Fecha</th>
                      <th>Producto</th>
                      <th>Color</th>
                      <th>Talla</th>
                      <th>SKU</th>
                      <th>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((h) => (
                      <tr
                        key={h.id}
                        style={{ borderBottom: "1px solid #f0f0f0" }}
                      >
                        {/* CAMBIO: fecha en hora de Venezuela */}
                        <td>{toCaracasDate(h.arrivalDate || h.date)}</td>
                        <td>{h.productName}</td>
                        <td>{h.color}</td>
                        <td>{h.size}</td>
                        <td>{h.sku}</td>
                        <td style={{ color: "green", fontWeight: 700 }}>
                          +{h.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* MODAL */}
        {isModalOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,.45)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000,
              padding: 15,
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 24,
                width: "min(700px, 100%)",
                maxHeight: "92vh",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #eee",
                  paddingBottom: 12,
                  marginBottom: 16,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 20 }}>
                  {editingItem ? "Editar Prenda" : "Nueva Prenda"}
                </h2>

                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  style={{
                    border: 0,
                    background: "none",
                    fontSize: 20,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={saveProduct}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* NOMBRE */}
                <div>
                  <label>Nombre del producto *</label>

                  <input
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ej. Luna Top"
                    style={inputStyle}
                  />
                </div>

                {/* CATEGORÍA + COSTO */}
                <div style={grid2}>
                  <div>
                    <label>Categoría</label>

                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      style={inputStyle}
                    >
                      {categoriesList
                        .filter((x) => x !== "Todos")
                        .map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label>Costo USD *</label>

                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      value={formCost}
                      onChange={(e) =>
                        setFormCost(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* PRECIO EN DÓLARES */}
                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    background: "#f8f6f1",
                    border: "1px solid #eee",
                  }}
                >
                  <label style={{ display: "block", fontWeight: 600 }}>
                    Precio pagando en $ *
                  </label>

                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={formDollarPrice}
                    onChange={(e) =>
                      setFormDollarPrice(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="Ej. 25"
                    style={inputStyle}
                  />
                </div>

                {/* PRECIO PUBLICADO */}
                <div
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    background: "#eef3f3",
                    border: "1px solid #dce5e5",
                  }}
                >
                  <div style={{ fontSize: 12, color: "#666" }}>
                    Precio publicado automático
                  </div>

                  <strong
                    style={{ fontSize: 26, display: "block", marginTop: 2 }}
                  >
                    {formDollarPrice !== "" && tasaBnc > 0 && tasaBcv > 0
                      ? `$${calculatePublishedPrice(Number(formDollarPrice))}`
                      : "—"}
                  </strong>

                  {formDollarPrice !== "" && tasaBnc > 0 && tasaBcv > 0 && (
                    <div
                      style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}
                    >
                      Pagando en $: ${Number(formDollarPrice).toFixed(2)} ·{" "}
                      {discountPercent}% OFF
                    </div>
                  )}
                </div>

                {/* COLORES */}
                <section style={sectionStyle}>
                  <h3 style={sectionTitle}>1. Colores</h3>

                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addColor();
                        }
                      }}
                      placeholder="Ej. Navy, Ivory, Pink"
                      style={{ ...inputStyle, flex: 1 }}
                    />

                    <button
                      type="button"
                      onClick={addColor}
                      style={secondaryBtn}
                    >
                      + Agregar
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 7,
                      flexWrap: "wrap",
                      marginTop: 10,
                    }}
                  >
                    {formColors.map((c) => (
                      <span
                        key={c}
                        style={{
                          background: "#eef3f3",
                          padding: "6px 9px",
                          borderRadius: 15,
                          fontSize: 12,
                        }}
                      >
                        {c}{" "}
                        <button
                          type="button"
                          onClick={() => removeColor(c)}
                          style={{
                            border: 0,
                            background: "none",
                            cursor: "pointer",
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </section>

                {/* TALLAS */}
                <section style={sectionStyle}>
                  <h3 style={sectionTitle}>2. Tallas y stock</h3>

                  <p style={{ fontSize: 12, color: "#777", marginTop: 0 }}>
                    Selecciona las tallas disponibles para cada color. El SKU se
                    genera automáticamente.
                  </p>

                  {formColors.length === 0 && (
                    <p style={{ color: "#999", fontSize: 13 }}>
                      Agrega primero un color.
                    </p>
                  )}

                  {formColors.map((color) => (
                    <div
                      key={color}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 10,
                      }}
                    >
                      <strong>{color}</strong>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit,minmax(120px,1fr))",
                          gap: 8,
                          marginTop: 10,
                        }}
                      >
                        {sizesList.map((size) => {
                          const selected = Object.prototype.hasOwnProperty.call(
                            variantDrafts[color] || {},
                            size,
                          );

                          const stock = variantDrafts[color]?.[size] ?? 0;

                          return (
                            <div
                              key={size}
                              style={{
                                border: selected
                                  ? "1px solid #18333a"
                                  : "1px solid #ddd",
                                borderRadius: 6,
                                padding: 8,
                              }}
                            >
                              <label
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  alignItems: "center",
                                  fontSize: 12,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleSize(color, size)}
                                />

                                {size}
                              </label>

                              {selected && (
                                <>
                                  <input
                                    type="number"
                                    min="0"
                                    value={stock}
                                    onChange={(e) =>
                                      setVariantStock(
                                        color,
                                        size,
                                        Number(e.target.value),
                                      )
                                    }
                                    style={{ ...inputStyle, marginTop: 6 }}
                                  />

                                  <small style={{ color: "#777" }}>
                                    SKU:{" "}
                                    {makeSku(
                                      formName || "PRODUCTO",
                                      color,
                                      size,
                                    )}
                                  </small>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>

                {/* FECHA */}
                <section style={sectionStyle}>
                  <h3 style={sectionTitle}>3. Fecha de llegada del stock</h3>

                  <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    <span>Fecha de llegada</span>

                    <input
                      type="date"
                      value={formArrivalDate}
                      onChange={(e) => setFormArrivalDate(e.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <p style={{ fontSize: 12, color: "#777", marginBottom: 0 }}>
                    Esta fecha se guardará en el historial cuando entre stock.
                  </p>
                </section>

                {/* FOTOS */}
                <section style={sectionStyle}>
                  <h3 style={sectionTitle}>4. Fotos del producto</h3>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploadingImages}
                    onChange={handleImageFiles}
                  />

                  {uploadingImages && (
                    <p style={{ fontSize: 12, color: "#18333a", marginTop: 6 }}>
                      Subiendo fotos...
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="Pegar URL de imagen"
                      style={{ ...inputStyle, flex: 1 }}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        addUrl(imageUrlInput, setFormImages, setImageUrlInput)
                      }
                      style={secondaryBtn}
                    >
                      Añadir
                    </button>
                  </div>

                  <Preview
                    images={formImages}
                    remove={(i) =>
                      setFormImages((p) => p.filter((_, x) => x !== i))
                    }
                  />
                </section>

                {/* GALERÍA ESPECÍFICA POR COLOR */}
                <section style={sectionStyle}>
                  <h3 style={sectionTitle}>5. Fotos por color</h3>
                  <p style={{ fontSize: 12, color: "#777", marginTop: 0 }}>
                    Sube las fotos de cada color por separado. Si un color no
                    tiene fotos aquí, la tienda utilizará las fotos generales
                    del producto.
                  </p>
                  {formColors.length === 0 && (
                    <p style={{ fontSize: 13, color: "#777" }}>
                      Agrega primero los colores del producto.
                    </p>
                  )}
                  {formColors.map((color) => (
                    <div
                      key={color}
                      style={{
                        border: "1px solid #e5e5e5",
                        padding: 12,
                        borderRadius: 6,
                        marginBottom: 14,
                      }}
                    >
                      <strong style={{ display: "block", marginBottom: 8 }}>
                        {color}
                      </strong>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={uploadingImages}
                        onChange={(e) => {
                          const files = e.target.files;
                          if (!files?.length) return;
                          const fileArray = Array.from(files);
                          e.target.value = "";
                          uploadFilesToStorage(
                            fileArray,
                            (updater) =>
                              setFormColorPhotos((prev) => {
                                const oldUrls = prev[color] || [];
                                const nextUrls =
                                  typeof updater === "function"
                                    ? updater(oldUrls)
                                    : updater;
                                return { ...prev, [color]: nextUrls };
                              }),
                            setUploadingImages,
                          );
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <input
                          type="url"
                          value={colorPhotoUrlInputs[color] || ""}
                          onChange={(e) =>
                            setColorPhotoUrlInputs((prev) => ({
                              ...prev,
                              [color]: e.target.value,
                            }))
                          }
                          placeholder={`URL de foto para ${color}`}
                          style={{ ...inputStyle, flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const url = (colorPhotoUrlInputs[color] || "").trim();
                            if (!url) return;
                            setFormColorPhotos((prev) => ({
                              ...prev,
                              [color]: [...(prev[color] || []), url],
                            }));
                            setColorPhotoUrlInputs((prev) => ({
                              ...prev,
                              [color]: "",
                            }));
                          }}
                          style={secondaryBtn}
                        >
                          Añadir
                        </button>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(190px, 1fr))",
                          gap: 12,
                          marginTop: 12,
                        }}
                      >
                        {(formColorPhotos[color] || []).map((url, index) => {
                          const position = formColorPhotoPositions[color]?.[
                            url
                          ] || { x: 50, y: 50 };
                          const updatePosition = (
                            axis: "x" | "y",
                            value: number,
                          ) => {
                            setFormColorPhotoPositions((prev) => ({
                              ...prev,
                              [color]: {
                                ...(prev[color] || {}),
                                [url]: {
                                  ...(prev[color]?.[url] || { x: 50, y: 50 }),
                                  [axis]: value,
                                },
                              },
                            }));
                          };
                          const removePhoto = () => {
                            setFormColorPhotos((prev) => ({
                              ...prev,
                              [color]: (prev[color] || []).filter(
                                (_, i) => i !== index,
                              ),
                            }));
                            setFormColorPhotoPositions((prev) => {
                              const nextColorPositions = {
                                ...(prev[color] || {}),
                              };
                              delete nextColorPositions[url];
                              return { ...prev, [color]: nextColorPositions };
                            });
                          };
                          return (
                            <div
                              key={`${url}-${index}`}
                              style={{
                                border: "1px solid #e5e5e5",
                                borderRadius: 8,
                                padding: 10,
                              }}
                            >
                              <div
                                style={{
                                  position: "relative",
                                  width: "100%",
                                  aspectRatio: "3 / 4",
                                  overflow: "hidden",
                                  borderRadius: 5,
                                  background: "#f2f0eb",
                                }}
                              >
                                <img
                                  src={url}
                                  alt={`Foto ${index + 1} de ${color}`}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    objectPosition: `${position.x}% ${position.y}%`,
                                    display: "block",
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={removePhoto}
                                  aria-label={`Eliminar foto ${index + 1} de ${color}`}
                                  style={{
                                    position: "absolute",
                                    top: 6,
                                    right: 6,
                                    border: 0,
                                    borderRadius: "50%",
                                    background: "rgba(0,0,0,.72)",
                                    color: "white",
                                    width: 26,
                                    height: 26,
                                    cursor: "pointer",
                                    fontSize: 18,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  marginTop: 8,
                                  color: "#444",
                                }}
                              >
                                <label
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 8,
                                  }}
                                >
                                  <span>Horizontal</span>
                                  <strong>{position.x}%</strong>
                                </label>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={position.x}
                                  onChange={(e) =>
                                    updatePosition("x", Number(e.target.value))
                                  }
                                  style={{ width: "100%", accentColor: "#111" }}
                                />
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  marginTop: 5,
                                  color: "#444",
                                }}
                              >
                                <label
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 8,
                                  }}
                                >
                                  <span>Vertical</span>
                                  <strong>{position.y}%</strong>
                                </label>
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={position.y}
                                  onChange={(e) =>
                                    updatePosition("y", Number(e.target.value))
                                  }
                                  style={{ width: "100%", accentColor: "#111" }}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  updatePosition("x", 50);
                                  updatePosition("y", 50);
                                }}
                                style={{
                                  ...secondaryBtn,
                                  width: "100%",
                                  marginTop: 6,
                                  fontSize: 11,
                                }}
                              >
                                Centrar imagen
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>

                {/* GUÍA */}
                <section style={sectionStyle}>
                  <h3 style={sectionTitle}>6. Guía de tallas</h3>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploadingGuide}
                    onChange={handleGuideFiles}
                  />

                  {uploadingGuide && (
                    <p style={{ fontSize: 12, color: "#18333a", marginTop: 6 }}>
                      Subiendo fotos...
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <input
                      type="url"
                      value={guideUrlInput}
                      onChange={(e) => setGuideUrlInput(e.target.value)}
                      placeholder="Pegar URL de guía de tallas"
                      style={{ ...inputStyle, flex: 1 }}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        addUrl(
                          guideUrlInput,
                          setFormGuideImages,
                          setGuideUrlInput,
                        )
                      }
                      style={secondaryBtn}
                    >
                      Añadir
                    </button>
                  </div>

                  <Preview
                    images={formGuideImages}
                    remove={(i) =>
                      setFormGuideImages((p) => p.filter((_, x) => x !== i))
                    }
                  />
                </section>

                {/* CUIDADO */}
                <section style={sectionStyle}>
                  <h3 style={sectionTitle}>7. Detalles de cuidado</h3>

                  <textarea
                    value={formCare}
                    onChange={(e) => setFormCare(e.target.value)}
                    placeholder="Ej. Lavar a mano con agua fría. No usar secadora..."
                    rows={5}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </section>

                {/* VISIBILIDAD */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#f9f9f9",
                    padding: 10,
                    borderRadius: 6,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formWebVisible}
                    onChange={(e) => setFormWebVisible(e.target.checked)}
                  />
                  Publicar y hacer visible en NavyWeb
                </label>

                {/* BOTONES */}
                <div
                  style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    style={secondaryBtn}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    style={primaryBtn}
                    disabled={uploadingImages || uploadingGuide}
                  >
                    {editingItem ? "Guardar Cambios" : "Crear Producto"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Preview({
  images,
  remove,
}: {
  images: string[];
  remove: (i: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
      {images.map((url, i) => (
        <div
          key={`${url}-${i}`}
          style={{
            position: "relative",
            width: 70,
            height: 82,
            border: "1px solid #ddd",
            borderRadius: 5,
            overflow: "hidden",
          }}
        >
          <img
            src={url}
            alt="preview"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />

          <button
            type="button"
            onClick={() => remove(i)}
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              border: 0,
              borderRadius: "50%",
              background: "rgba(0,0,0,.6)",
              color: "#fff",
              width: 18,
              height: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: 13,
  marginTop: 5,
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 8,
  padding: 14,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  margin: "0 0 10px",
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 16px",
  border: 0,
  borderRadius: 6,
  background: "#18333a",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #ccc",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
};
