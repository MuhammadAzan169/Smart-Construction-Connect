// Deterministic, construction-themed imagery for companies & suppliers.
//
// The seeded demo data shipped with random, off-brand photos (people, pets, etc.).
// Rather than depend on those files, we deterministically map every entity to a
// fitting construction/architecture photo based on its name/slug, so the same
// company always shows the same image and everything looks on-brand.

const BASE = "https://images.unsplash.com/photo-";
const IMG = (id: string, w = 400) => `${BASE}${id}?auto=format&fit=crop&w=${w}&q=80`;

// Buildings, houses & architecture — used for construction companies.
const COMPANY_IMAGES = [
  "1600585154340-be6161a56a0c", // modern house
  "1512917774080-9991f1c4c750", // suburban house
  "1580587771525-78b9dba3b914", // white modern house
  "1486406146926-c627a92ad1ab", // office tower
  "1487958449943-2429e8be8625", // concrete facade
  "1449157291145-7efd050a4d0e", // glass architecture
  "1516156008625-3a9d6067fab5", // apartment block
  "1503387762-592deb58ef4e",    // construction site
];

// Sites, cranes, workers & materials — used for material suppliers.
const SUPPLIER_IMAGES = [
  "1587293852726-70cdb56c2866", // steel / rebar
  "1590274853856-f22d5ee3d228", // tower crane
  "1504307651254-35680f356dfd", // worker on site
  "1541888946425-d81bb19240f5", // structure under construction
  "1503387762-592deb58ef4e",    // construction site
  "1487958449943-2429e8be8625", // concrete
];

/** Stable non-negative hash for a string (djb2). */
function hash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  return h;
}

function pick(seed: string, pool: string[], w: number): string {
  return IMG(pool[hash(seed) % pool.length], w);
}

export function companyImage(seed: string, w = 400): string {
  return pick(seed || "company", COMPANY_IMAGES, w);
}

export function supplierImage(seed: string, w = 400): string {
  return pick(seed || "supplier", SUPPLIER_IMAGES, w);
}

/** Return a shallow copy of an entity record with construction-themed imagery. */
export function withEntityImage(
  entity: Record<string, unknown> | null | undefined,
  kind: "company" | "supplier",
): Record<string, unknown> | null | undefined {
  if (!entity || typeof entity !== "object") return entity;
  const seed = String(
    entity.slug ?? entity.company_name ?? entity.supplier_name ?? entity.name ?? entity.company_id ?? entity.supplier_id ?? "",
  );
  const img = kind === "company" ? companyImage(seed) : supplierImage(seed);
  const cover = kind === "company" ? companyImage(seed + "-cover", 1200) : supplierImage(seed + "-cover", 1200);
  return { ...entity, logo_url: img, dp_url: cover };
}

export function withEntityImages(
  items: Record<string, unknown>[] | undefined,
  kind: "company" | "supplier",
): Record<string, unknown>[] {
  if (!Array.isArray(items)) return items ?? [];
  return items.map((it) => withEntityImage(it, kind) as Record<string, unknown>);
}
