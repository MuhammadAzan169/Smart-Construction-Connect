type PackageScopeFields = {
  design_included?: boolean;
  fixtures?: string;
  ceiling?: string;
  kitchen?: string;
  bathroom?: string;
};

type MaterialsFields = {
  cement?: string;
  steel?: string;
  bricks?: string;
  wiring?: string;
  plumbing?: string;
  paint?: string;
};

type FlattenedOperationalArea = {
  city: string;
  area: string;
  subarea: string;
  location: string;
  package: string;
  price_per_sqft: number;
  price_raw: string;
};

export type CompanyProject = {
  id: string;
  title: string;
  type: string;
  city: string;
  year: number;
  description: string;
  image_urls: string[];
  plot_size?: string;
  budget_range?: string;
  duration_months?: number;
  status?: string;
};

export type CompanyDatasetCompany = {
  company_id: string;
  company_name: string;
  slug?: string;
  city?: string;
  description?: string | null;
  logo_url?: string | null;
  dp_url?: string | null;
  verification_status?: string;
  verification?: Record<string, { status: string; notes?: string }>;
  verification_documents?: Record<string, string>;
  rating?: number;
  review_count?: number;
  legal_info?: {
    registered?: boolean;
    secp_registered?: boolean;
    ntn?: string;
    year_established?: number;
  };
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
  };
  construction_capability?: Record<string, unknown>;
  services?: Record<string, unknown>;
  operational_areas?: Record<string, unknown>;
  flattened_operational_areas?: FlattenedOperationalArea[];
  package_scope?: Record<string, PackageScopeFields>;
  materials_used?: Record<string, MaterialsFields>;
  estimated_cost_range?: Record<string, Record<string, unknown>>;
  /** @deprecated old field name */
  estimated_total_cost_range?: Record<string, Record<string, string>>;
  payment_terms?: {
    advance_percentage?: number;
    installments?: string;
    price_type?: string;
    variation_clause?: boolean;
  };
  timeline_estimates?: Record<string, unknown>;
  experience?: {
    total_projects?: number;
    houses_completed?: number;
    ongoing_projects?: number;
    specializations?: string[];
  };
  customer_feedback?: {
    average_rating?: number;
    review_count?: number;
  };
  quality_control?: Record<string, unknown>;
  after_handover_support?: Record<string, unknown>;
  legal_and_contract?: Record<string, unknown>;
  ideal_customer_profile?: Record<string, unknown>;
  ai_scores?: {
    timeline_reliability?: number;
    budget_accuracy?: number;
    quality_consistency?: number;
  };
  projects?: CompanyProject[];
};

// Import the provided dataset JSON from the workspace Database folder.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import companiesJson from "../../../Database/construction/companies.json";


export const companyDataset = (companiesJson as unknown as CompanyDatasetCompany[]).filter(
  (c) => c && typeof c.company_id === "string" && typeof c.company_name === "string",
);

export type CompanyDirectoryItem = {
  id: string;
  name: string;
  location: string;
  cities: string[];
  areas: string[];
  societies: string[];
  locations: string[];
  rating: number;
  reviews: number;
  specialization: string[];
  priceRange: string;
  verified: boolean;
  matchScore: number;
  image: string;
  yearEstablished?: number;
  completedProjects?: number;
  raw: CompanyDatasetCompany;
};

const placeholderImages = [
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1541976590-713941681591?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1590846083693-f23fdede3a7e?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&h=600&fit=crop",
];

function hashToIndex(input: string, modulo: number) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return modulo === 0 ? 0 : h % modulo;
}

function titleCaseToken(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function pickPrimaryCity(company: CompanyDatasetCompany): string {
  const cities = company.operational_areas && typeof company.operational_areas === "object"
    ? Object.keys(company.operational_areas)
    : [];
  if (cities.length) return cities[0];
  const first = company.flattened_operational_areas?.[0]?.city;
  return first || "—";
}

function computeCoverage(company: CompanyDatasetCompany) {
  const cities = new Set<string>();
  const areas = new Set<string>();
  const societies = new Set<string>();
  const locations = new Set<string>();

  for (const row of company.flattened_operational_areas ?? []) {
    if (row?.city) cities.add(titleCaseToken(row.city));
    if (row?.area) areas.add(titleCaseToken(row.area));
    if (row?.subarea) societies.add(titleCaseToken(row.subarea));
    if (row?.location) locations.add(row.location);
  }

  // Fallback to nested operational_areas when flattened is missing.
  if (cities.size === 0 && company.operational_areas && typeof company.operational_areas === "object") {
    const op = company.operational_areas as Record<string, unknown>;
    for (const [city, areasObj] of Object.entries(op)) {
      if (city) cities.add(titleCaseToken(city));
      if (!areasObj || typeof areasObj !== "object") continue;
      for (const [area, subareasObj] of Object.entries(areasObj as Record<string, unknown>)) {
        if (area) areas.add(titleCaseToken(area));
        if (!subareasObj || typeof subareasObj !== "object") continue;
        for (const [subarea] of Object.entries(subareasObj as Record<string, unknown>)) {
          if (subarea) societies.add(titleCaseToken(subarea));
        }
      }
    }
  }

  const sort = (set: Set<string>) => Array.from(set).sort((a, b) => a.localeCompare(b));

  return {
    cities: sort(cities),
    areas: sort(areas),
    societies: sort(societies),
    locations: sort(locations),
  };
}

function computePriceRange(company: CompanyDatasetCompany) {
  const prices = (company.flattened_operational_areas ?? [])
    .map((x) => x?.price_per_sqft)
    .filter((n) => typeof n === "number" && Number.isFinite(n));
  if (!prices.length) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function formatSqFtRange(min: number, max: number) {
  const fmt = (n: number) => new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(n);
  return min === max ? `${fmt(min)} PKR/sq ft` : `${fmt(min)} - ${fmt(max)} PKR/sq ft`;
}

function computeMatchScore(company: CompanyDatasetCompany) {
  const s = company.ai_scores;
  const parts = [s?.timeline_reliability, s?.budget_accuracy, s?.quality_consistency]
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (!parts.length) return 80;
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
  return Math.max(0, Math.min(100, Math.round(avg * 100)));
}

function computeSpecializations(company: CompanyDatasetCompany): string[] {
  const specs = company.experience?.specializations ?? [];
  const normalized = specs
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map(titleCaseToken);
  return Array.from(new Set(normalized)).slice(0, 6);
}

function computeVerified(company: CompanyDatasetCompany) {
  return Boolean(company.legal_info?.registered && company.legal_info?.secp_registered);
}

export function getCompanyById(id: string) {
  return companyDataset.find((c) => c.company_id === id);
}

export function getCompanyByEmail(email: string) {
  const needle = email.trim().toLowerCase();
  return companyDataset.find((c) => (c.contact?.email ?? "").trim().toLowerCase() === needle);
}

export function getPackageKeys(company: CompanyDatasetCompany): string[] {
  const fromScope = company.package_scope && typeof company.package_scope === "object" ? Object.keys(company.package_scope) : [];
  const fromFlat = Array.from(new Set((company.flattened_operational_areas ?? []).map((x) => x.package))).filter(Boolean);
  const keys = Array.from(new Set([...fromScope, ...fromFlat]));
  const baseOrder = ["standard", "premium", "executive"];
  return keys.sort((a, b) => {
    const ai = baseOrder.indexOf(a);
    const bi = baseOrder.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return a.localeCompare(b);
  });
}

export const companyDirectory: CompanyDirectoryItem[] = companyDataset.map((raw) => {
  const price = computePriceRange(raw);
  const coverage = computeCoverage(raw);
  return {
    id: raw.company_id,
    name: raw.company_name,
    location: coverage.cities[0] ?? pickPrimaryCity(raw),
    cities: coverage.cities,
    areas: coverage.areas,
    societies: coverage.societies,
    locations: coverage.locations,
    rating: raw.customer_feedback?.average_rating ?? 0,
    reviews: raw.customer_feedback?.review_count ?? 0,
    specialization: computeSpecializations(raw),
    priceRange: price ? formatSqFtRange(price.min, price.max) : "Pricing —",
    verified: computeVerified(raw),
    matchScore: computeMatchScore(raw),
    image: placeholderImages[hashToIndex(raw.company_id, placeholderImages.length)],
    yearEstablished: raw.legal_info?.year_established,
    completedProjects: raw.experience?.houses_completed,
    raw,
  };
});

export function getScopeValueOptions(dataset: CompanyDatasetCompany[]) {
  const fixtures = new Set<string>();
  const ceiling = new Set<string>();
  const kitchen = new Set<string>();
  const bathroom = new Set<string>();

  for (const c of dataset) {
    const scope = c.package_scope ?? {};
    for (const pkg of Object.values(scope)) {
      if (pkg?.fixtures) fixtures.add(pkg.fixtures);
      if (pkg?.ceiling) ceiling.add(pkg.ceiling);
      if (pkg?.kitchen) kitchen.add(pkg.kitchen);
      if (pkg?.bathroom) bathroom.add(pkg.bathroom);
    }
  }

  const sort = (set: Set<string>) => Array.from(set).sort((a, b) => a.localeCompare(b));

  return {
    fixtures: sort(fixtures),
    ceiling: sort(ceiling),
    kitchen: sort(kitchen),
    bathroom: sort(bathroom),
  };
}

export function getPaymentTermOptions(dataset: CompanyDatasetCompany[]) {
  const installments = new Set<string>();
  const priceTypes = new Set<string>();

  for (const c of dataset) {
    const t = c.payment_terms;
    if (t?.installments) installments.add(t.installments);
    if (t?.price_type) priceTypes.add(t.price_type);
  }

  return {
    installments: Array.from(installments).sort((a, b) => a.localeCompare(b)),
    priceTypes: Array.from(priceTypes).sort((a, b) => a.localeCompare(b)),
  };
}

export function humanizeToken(value: string) {
  return titleCaseToken(value);
}

// ── Async API-based fetcher (production) ──

const COMPANY_API =
  window.location.port === "5173" || window.location.port === "8080"
    ? "http://localhost:8000/api/companies/"
    : "/api/companies/";

let _cachedDirectory: CompanyDirectoryItem[] | null = null;

function _buildDirectoryItem(raw: CompanyDatasetCompany): CompanyDirectoryItem {
  const price = computePriceRange(raw);
  const coverage = computeCoverage(raw);
  return {
    id: raw.company_id,
    name: raw.company_name,
    location: coverage.cities[0] ?? pickPrimaryCity(raw),
    cities: coverage.cities,
    areas: coverage.areas,
    societies: coverage.societies,
    locations: coverage.locations,
    rating: raw.customer_feedback?.average_rating ?? 0,
    reviews: raw.customer_feedback?.review_count ?? 0,
    specialization: computeSpecializations(raw),
    priceRange: price ? formatSqFtRange(price.min, price.max) : "Pricing —",
    verified: (raw as Record<string, unknown>).verification_status === "verified" || computeVerified(raw),
    matchScore: computeMatchScore(raw),
    image: (raw as Record<string, unknown>).dp_url as string || raw.logo_url || placeholderImages[hashToIndex(raw.company_id, placeholderImages.length)],
    yearEstablished: raw.legal_info?.year_established,
    completedProjects: raw.experience?.houses_completed,
    raw,
  };
}

export async function fetchCompanyDirectory(): Promise<CompanyDirectoryItem[]> {
  if (_cachedDirectory) return _cachedDirectory;
  try {
    const res = await fetch(COMPANY_API);
    if (!res.ok) throw new Error("Failed to fetch companies");
    const json = await res.json();
    // Support both paginated {items: [...]} and legacy array responses
    const data = (Array.isArray(json) ? json : json.items ?? []) as CompanyDatasetCompany[];
    const dir = data
      .filter((c) => c && typeof c.company_id === "string" && typeof c.company_name === "string")
      .map(_buildDirectoryItem);
    _cachedDirectory = dir;
    return dir;
  } catch {
    // Fallback to static import
    return companyDirectory;
  }
}

export function invalidateCompanyCache() {
  _cachedDirectory = null;
}
