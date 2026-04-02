export type SupplierMaterial = {
  name: string;
  category: string;
  brand: string;
  price: number;
  unit: string;
  stock: number;
};

export type SupplierDatasetItem = {
  supplier_id: string;
  supplier_name: string;
  slug: string;
  description: string;
  logo_url: string | null;
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
};

export type SupplierDirectoryItem = {
  id: string;
  name: string;
  description: string;
  logo: string;
  city: string;
  area: string;
  citiesServed: string[];
  categories: string[];
  materialCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  rating: number;
  reviews: number;
  contact: { phone: string; email: string; website: string };
  materials: SupplierMaterial[];
  raw: SupplierDatasetItem;
};

let _cachedSuppliers: SupplierDatasetItem[] | null = null;
let _cachedDirectory: SupplierDirectoryItem[] | null = null;

export async function fetchSuppliers(): Promise<SupplierDatasetItem[]> {
  if (_cachedSuppliers) return _cachedSuppliers;
  try {
    const res = await fetch("http://localhost:8000/api/suppliers/");
    if (!res.ok) throw new Error("Failed to fetch suppliers");
    const data = await res.json();
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
        city: s.city || s.location?.city || "",
        area: s.area || s.location?.area || "",
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
