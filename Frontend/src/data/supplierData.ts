export type SupplierMaterial = {
  name: string;
  category: string;
  brand: string;
  price: number;
  unit: string;
  stock: number;
  image_urls?: string[];
  description?: string;
};

export type SupplierDatasetItem = {
  supplier_id: string;
  supplier_name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  dp_url?: string | null;
  city: string;
  area: string;
  /** @deprecated legacy shape — some old records may still nest location */
  location?: { city: string; area: string };
  cities_served: string[];
  contact: { phone: string; email: string; website: string };
  materials: SupplierMaterial[];
  status: string;
  rating: number;
  review_count: number;
  verification_status?: string;
};

export type SupplierDirectoryItem = {
  id: string;
  name: string;
  description: string;
  logo: string;
  dpUrl: string;
  city: string;
  area: string;
  citiesServed: string[];
  categories: string[];
  materialCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  rating: number;
  reviews: number;
  verified: boolean;
  contact: { phone: string; email: string; website: string };
  materials: SupplierMaterial[];
  raw: SupplierDatasetItem;
};

const SUPPLIER_API =
  window.location.port === "5173"
    ? "http://localhost:8000/api/suppliers/"
    : "/api/suppliers/";

let _cachedSuppliers: SupplierDatasetItem[] | null = null;
let _cachedDirectory: SupplierDirectoryItem[] | null = null;

export async function fetchSuppliers(): Promise<SupplierDatasetItem[]> {
  if (_cachedSuppliers) return _cachedSuppliers;
  try {
    const res = await fetch(SUPPLIER_API);
    if (!res.ok) throw new Error("Failed to fetch suppliers");
    const json = await res.json();
    // Support both paginated {items: [...]} and legacy array responses
    const data = Array.isArray(json) ? json : json.items ?? [];
    _cachedSuppliers = data;
    return data;
  } catch {
    return [];
  }
}

export async function fetchSupplierDirectory(): Promise<SupplierDirectoryItem[]> {
  if (_cachedDirectory) return _cachedDirectory;
  const suppliers = await fetchSuppliers();
  const dir = suppliers
    .filter((s) => s && s.supplier_id && s.supplier_name)
    .map((s) => {
      const categories = Array.from(new Set(s.materials.map((m) => m.category))).sort();
      const prices = s.materials.map((m) => m.price).filter((p) => typeof p === "number" && p > 0);
      return {
        id: s.supplier_id,
        name: s.supplier_name,
        description: s.description || "",
        logo: s.logo_url || "",
        dpUrl: s.dp_url || "",
        city: s.city || s.location?.city || "",
        area: s.area || s.location?.area || "",
        verified: s.verification_status === "verified",
        citiesServed: s.cities_served || [],
        categories,
        materialCount: s.materials.length,
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        rating: s.rating || 0,
        reviews: s.review_count || 0,
        contact: s.contact || { phone: "", email: "", website: "" },
        materials: s.materials || [],
        raw: s,
      };
    });
  _cachedDirectory = dir;
  return dir;
}

export function invalidateSupplierCache() {
  _cachedSuppliers = null;
  _cachedDirectory = null;
}
