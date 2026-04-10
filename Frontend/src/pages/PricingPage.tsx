import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  companyDataset,
  getCompanyByEmail,
  getPackageKeys,
  getScopeValueOptions,
  humanizeToken,
  type CompanyDatasetCompany,
} from "@/data/companyData";
import { cities as cityOptions, societiesByCity } from "@/data/locationOptions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Check, Loader2, MapPin, Package, Plus, RotateCcw, Save, Wrench, X } from "lucide-react";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type PackageScopeFields = {
  design_included?: boolean;
  fixtures?: string;
  ceiling?: string;
  kitchen?: string;
  bathroom?: string;
};

type PackageDef = { id: string; label: string };

type CostRange = { min: number | null; max: number | null };

type PricingRow = {
  id: string;
  plotSizeLabel: string;
  costs: Record<string, CostRange>;
  removable?: boolean;
};

type AreaRate = {
  id: string;
  city: string;
  society: string;
  phase: string;
  rates: Record<string, number | null>;
};

type CompanyPricingState = {
  packages: PackageDef[];
  rows: PricingRow[];
  packageScope: Record<string, PackageScopeFields>;
  areaRates: AreaRate[];
  materialsUsed: Record<string, { cement: string; steel: string; bricks: string; wiring: string; plumbing: string; paint: string }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseOptionalNumber(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : Math.max(0, Math.round(n));
}

function normalizeMaybeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === "string") return parseOptionalNumber(value);
  return null;
}

function slugifyPackageId(label: string) {
  return label.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 30);
}

const storageKey = (companyKey: string) => `scc_pricing_v3:${companyKey}`;

function defaultRows(packageIds: string[]): PricingRow[] {
  const mk = (id: string, label: string): PricingRow => {
    const costs: Record<string, CostRange> = {};
    for (const pkgId of packageIds) costs[pkgId] = { min: null, max: null };
    return { id, plotSizeLabel: label, costs };
  };
  return [mk("3-marla", "3 Marla"), mk("5-marla", "5 Marla"), mk("10-marla", "10 Marla"), mk("1-kanal", "1 Kanal (20 Marla)"), mk("2-kanal", "2 Kanal (40 Marla)")];
}

function normalizePricingState(state: CompanyPricingState): CompanyPricingState {
  const packages = (state.packages ?? []).filter((p) => p && typeof p.id === "string" && typeof p.label === "string");
  const seen = new Set<string>();
  const deduped: PackageDef[] = [];
  for (const p of packages) { if (!seen.has(p.id)) { seen.add(p.id); deduped.push(p); } }
  const fallback = deduped.length ? deduped : [{ id: "standard", label: "Standard" }];
  const pkgIds = fallback.map((p) => p.id);

  const rows: PricingRow[] = (state.rows ?? []).map((r, idx) => {
    const id = typeof r?.id === "string" ? r.id : `row-${idx}`;
    const plotSizeLabel = typeof r?.plotSizeLabel === "string" ? r.plotSizeLabel : `Plot ${idx + 1}`;
    const costsRaw: Record<string, unknown> = r?.costs && typeof r.costs === "object" ? (r.costs as unknown as Record<string, unknown>) : {};
    const costs: Record<string, CostRange> = {};
    for (const pkgId of pkgIds) {
      const c = costsRaw[pkgId];
      const cell = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
      costs[pkgId] = { min: normalizeMaybeNumber(cell.min), max: normalizeMaybeNumber(cell.max) };
    }
    const rv = (r as unknown as Record<string, unknown>).removable;
    return { id, plotSizeLabel, removable: typeof rv === "boolean" ? rv : Boolean(rv), costs };
  });

  const packageScope: Record<string, PackageScopeFields> = {};
  const scopeRaw: Record<string, unknown> = state.packageScope && typeof state.packageScope === "object" ? (state.packageScope as unknown as Record<string, unknown>) : {};
  for (const pkgId of pkgIds) {
    const v = scopeRaw[pkgId] && typeof scopeRaw[pkgId] === "object" ? (scopeRaw[pkgId] as Record<string, unknown>) : {};
    packageScope[pkgId] = {
      design_included: typeof v.design_included === "boolean" ? v.design_included : false,
      fixtures: typeof v.fixtures === "string" ? v.fixtures : "",
      ceiling: typeof v.ceiling === "string" ? v.ceiling : "",
      kitchen: typeof v.kitchen === "string" ? v.kitchen : "",
      bathroom: typeof v.bathroom === "string" ? v.bathroom : "",
    };
  }

  const areaRates: AreaRate[] = Array.isArray(state.areaRates)
    ? (state.areaRates as unknown[]).filter((r): r is AreaRate => !!r && typeof r === "object").map((r, idx) => {
        const rates: Record<string, number | null> = {};
        for (const pkgId of pkgIds) rates[pkgId] = normalizeMaybeNumber((r.rates ?? {})[pkgId]);
        return { id: typeof r.id === "string" ? r.id : `op-${idx}`, city: typeof r.city === "string" ? r.city : "", society: typeof r.society === "string" ? r.society : "", phase: typeof r.phase === "string" ? r.phase : "", rates };
      })
    : [];

  const blank = () => ({ cement: "", steel: "", bricks: "", wiring: "", plumbing: "", paint: "" });
  const materialsUsed: CompanyPricingState["materialsUsed"] = {};
  const mRaw = state.materialsUsed && typeof state.materialsUsed === "object" ? (state.materialsUsed as unknown as Record<string, unknown>) : {};
  for (const pkgId of pkgIds) {
    const m = mRaw[pkgId] && typeof mRaw[pkgId] === "object" ? (mRaw[pkgId] as Record<string, unknown>) : {};
    const s = (v: unknown) => (typeof v === "string" ? v : "");
    materialsUsed[pkgId] = { cement: s(m.cement), steel: s(m.steel), bricks: s(m.bricks), wiring: s(m.wiring), plumbing: s(m.plumbing), paint: s(m.paint) };
  }
  if (pkgIds.length === 0) materialsUsed.standard = blank();

  return { packages: fallback, rows: rows.length ? rows : defaultRows(pkgIds), packageScope, areaRates, materialsUsed };
}

function safeLoadPricingState(companyKey: string, defaults: CompanyPricingState): CompanyPricingState {
  try {
    const raw = localStorage.getItem(storageKey(companyKey));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaults;
    return normalizePricingState(parsed as CompanyPricingState);
  } catch { return defaults; }
}

function defaultPricingFromCompany(company: CompanyDatasetCompany | null): CompanyPricingState {
  const pkgKeys = company ? getPackageKeys(company) : ["standard", "premium", "executive"];
  const labelOf = (k: string) => k === "standard" ? "Standard" : k === "premium" ? "Premium" : k === "executive" ? "Executive" : humanizeToken(k);
  const packages: PackageDef[] = pkgKeys.map((k) => ({ id: k, label: labelOf(k) }));

  const packageScope: Record<string, PackageScopeFields> = {};
  for (const p of packages) {
    const src = (company?.package_scope?.[p.id] ?? {}) as PackageScopeFields;
    packageScope[p.id] = { design_included: typeof src.design_included === "boolean" ? src.design_included : false, fixtures: typeof src.fixtures === "string" ? src.fixtures : "", ceiling: typeof src.ceiling === "string" ? src.ceiling : "", kitchen: typeof src.kitchen === "string" ? src.kitchen : "", bathroom: typeof src.bathroom === "string" ? src.bathroom : "" };
  }

  const ranges = company?.estimated_total_cost_range;
  const rows: PricingRow[] = ranges && typeof ranges === "object"
    ? Object.entries(ranges).map(([plotKey, perPkg]: [string, unknown]) => {
        const costs: Record<string, CostRange> = {};
        for (const pkgId of pkgKeys) {
          const cell = (perPkg as Record<string, unknown>)?.[pkgId];
          if (cell && typeof cell === "object" && !Array.isArray(cell)) {
            const c = cell as Record<string, unknown>;
            costs[pkgId] = { min: normalizeMaybeNumber(c.min), max: normalizeMaybeNumber(c.max) };
          } else { costs[pkgId] = { min: null, max: null }; }
        }
        return { id: plotKey, plotSizeLabel: plotKey.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()), removable: false, costs };
      })
    : defaultRows(pkgKeys);

  const areaRates: AreaRate[] = [];
  const seenKeys = new Set<string>();
  for (const row of company?.flattened_operational_areas ?? []) {
    const city = typeof row?.city === "string" ? row.city : "";
    const society = (typeof row?.subarea === "string" && row.subarea) || (typeof row?.area === "string" ? row.area : "");
    const phase = typeof row?.location === "string" ? row.location : "";
    const key = `${city}||${society}||${phase}`;
    if (!city || !society || !phase || seenKeys.has(key)) continue;
    seenKeys.add(key);
    const rates: Record<string, number | null> = {};
    for (const pkgId of pkgKeys) rates[pkgId] = null;
    areaRates.push({ id: key, city, society, phase, rates });
  }
  for (const row of company?.flattened_operational_areas ?? []) {
    const key = `${row?.city}||${(row?.subarea || row?.area)}||${row?.location}`;
    const target = areaRates.find((x) => x.id === key);
    if (target && typeof row?.package === "string" && pkgKeys.includes(row.package) && typeof row?.price_per_sqft === "number") {
      target.rates[row.package] = Math.round(row.price_per_sqft);
    }
  }

  const blank = () => ({ cement: "", steel: "", bricks: "", wiring: "", plumbing: "", paint: "" });
  const materialsUsed: CompanyPricingState["materialsUsed"] = {};
  const rawMats = company?.materials_used && typeof company.materials_used === "object" ? (company.materials_used as Record<string, Record<string, unknown>>) : {};
  for (const p of packages) {
    const src = rawMats[p.id] ?? {};
    const s = (v: unknown) => (typeof v === "string" ? v : "");
    materialsUsed[p.id] = { cement: s(src.cement), steel: s(src.steel), bricks: s(src.bricks), wiring: s(src.wiring), plumbing: s(src.plumbing), paint: s(src.paint) };
  }
  if (packages.length === 0) materialsUsed.standard = blank();

  return { packages, rows, packageScope, areaRates, materialsUsed };
}

function computeMaterialSuggestions(dataset: CompanyDatasetCompany[]) {
  const keys = ["cement", "steel", "bricks", "wiring", "plumbing", "paint"] as const;
  const buckets: Record<(typeof keys)[number], Set<string>> = { cement: new Set(), steel: new Set(), bricks: new Set(), wiring: new Set(), plumbing: new Set(), paint: new Set() };
  for (const company of dataset) {
    const perPkg = company.materials_used && typeof company.materials_used === "object" ? (company.materials_used as Record<string, unknown>) : {};
    for (const pkg of Object.values(perPkg)) {
      if (!pkg || typeof pkg !== "object") continue;
      const obj = pkg as Record<string, unknown>;
      for (const k of keys) { if (typeof obj[k] === "string" && (obj[k] as string).trim()) buckets[k].add((obj[k] as string).trim()); }
    }
  }
  const sorted = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b));
  return { cement: sorted(buckets.cement), steel: sorted(buckets.steel), bricks: sorted(buckets.bricks), wiring: sorted(buckets.wiring), plumbing: sorted(buckets.plumbing), paint: sorted(buckets.paint) };
}

const materialSuggestions = computeMaterialSuggestions(companyDataset);
const phaseSuggestions = ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5", "Phase 6", "Block A", "Block B", "Block C", "Block D", "Sector A", "Sector B"];
const scopeOptions = getScopeValueOptions(companyDataset);

// ─── Company Pricing Editor ───────────────────────────────────────────────────

function CompanyPricingEditor({ email, companySlug }: { email: string; companySlug?: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const company = useMemo(() => getCompanyByEmail(email) ?? null, [email]);
  const companyKey = company?.company_id ?? email;
  const defaults = useMemo(() => defaultPricingFromCompany(company), [company]);

  const [pricing, setPricing] = useState<CompanyPricingState>(() => safeLoadPricingState(companyKey, defaults));
  const [activePackage, setActivePackage] = useState<string>(() => pricing.packages[0]?.id ?? "standard");
  const [loading, setLoading] = useState(!!companySlug);
  const [saving, setSaving] = useState(false);
  const [newPackageLabel, setNewPackageLabel] = useState("");
  const [newPlotSize, setNewPlotSize] = useState("");
  const profileRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!companySlug) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.companies.getProfile(companySlug)
      .then((profile) => {
        if (cancelled) return;
        profileRef.current = profile as Record<string, unknown>;
        const ep = (profile as Record<string, unknown>)?._editor_pricing_v3;
        if (ep && typeof ep === "object") { setPricing(normalizePricingState(ep as CompanyPricingState)); }
        else { setPricing(defaultPricingFromCompany(profile as CompanyDatasetCompany)); }
      })
      .catch(() => { if (!cancelled) toast({ variant: "destructive", title: "Load failed", description: "Could not load profile." }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companySlug, email]);

  // Keep activePackage valid
  useEffect(() => {
    if (!pricing.packages.some((p) => p.id === activePackage)) setActivePackage(pricing.packages[0]?.id ?? "standard");
  }, [pricing.packages, activePackage]);

  // Sync package keys across all sub-structures
  useEffect(() => {
    const pkgIds = pricing.packages.map((p) => p.id);
    setPricing((prev) => {
      let changed = false;
      const blank = () => ({ cement: "", steel: "", bricks: "", wiring: "", plumbing: "", paint: "" });
      const nextMat = { ...prev.materialsUsed };
      for (const pkgId of pkgIds) { if (!nextMat[pkgId]) { nextMat[pkgId] = blank(); changed = true; } }
      for (const k of Object.keys(nextMat)) { if (!pkgIds.includes(k)) { delete nextMat[k]; changed = true; } }
      const nextAreas = prev.areaRates.map((row) => {
        let rc = false;
        const nextRates = { ...row.rates };
        for (const pkgId of pkgIds) { if (!(pkgId in nextRates)) { nextRates[pkgId] = null; rc = true; } }
        for (const k of Object.keys(nextRates)) { if (!pkgIds.includes(k)) { delete nextRates[k]; rc = true; } }
        if (!rc) return row;
        changed = true;
        return { ...row, rates: nextRates };
      });
      return changed ? { ...prev, areaRates: nextAreas, materialsUsed: nextMat } : prev;
    });
  }, [pricing.packages]);

  const addPackage = () => {
    const label = newPackageLabel.trim();
    if (!label) return;
    let nextId = "";
    setPricing((prev) => {
      const base = slugifyPackageId(label) || `pkg-${Date.now()}`;
      let id = base; let n = 2;
      while (prev.packages.some((p) => p.id === id)) id = `${base}-${n++}`;
      nextId = id;
      return normalizePricingState({ ...prev, packages: [...prev.packages, { id, label }], rows: prev.rows.map((r) => ({ ...r, costs: { ...r.costs, [id]: { min: null, max: null } } })), packageScope: { ...prev.packageScope, [id]: { design_included: false, fixtures: "", ceiling: "", kitchen: "", bathroom: "" } } });
    });
    if (nextId) setActivePackage(nextId);
    setNewPackageLabel("");
  };

  const deletePackage = (pkgId: string) => {
    setPricing((prev) => {
      if (prev.packages.length <= 1) return prev;
      const nextPkgs = prev.packages.filter((p) => p.id !== pkgId);
      const nextRows = prev.rows.map((r) => { const { [pkgId]: _, ...rest } = r.costs; return { ...r, costs: rest }; });
      const { [pkgId]: _scope, ...restScope } = prev.packageScope;
      return normalizePricingState({ ...prev, packages: nextPkgs, rows: nextRows, packageScope: restScope });
    });
    toast({ title: "Package removed" });
  };

  const updateScope = (pkgId: string, field: keyof PackageScopeFields, value: boolean | string) =>
    setPricing((prev) => ({ ...prev, packageScope: { ...prev.packageScope, [pkgId]: { ...(prev.packageScope[pkgId] ?? {}), [field]: value } } }));

  const addArea = () => {
    const id = `op-${Date.now()}`;
    const rates: Record<string, number | null> = {};
    for (const p of pricing.packages) rates[p.id] = null;
    setPricing((prev) => ({ ...prev, areaRates: [...prev.areaRates, { id, city: "", society: "", phase: "", rates }] }));
  };

  const removeArea = (id: string) => setPricing((prev) => ({ ...prev, areaRates: prev.areaRates.filter((r) => r.id !== id) }));

  const patchArea = (id: string, patch: Partial<AreaRate>) =>
    setPricing((prev) => ({ ...prev, areaRates: prev.areaRates.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const patchAreaRate = (id: string, pkgId: string, next: number | null) =>
    setPricing((prev) => ({ ...prev, areaRates: prev.areaRates.map((r) => r.id !== id ? r : { ...r, rates: { ...r.rates, [pkgId]: next } }) }));

  const updateMaterial = (pkgId: string, field: keyof CompanyPricingState["materialsUsed"][string], value: string) =>
    setPricing((prev) => ({ ...prev, materialsUsed: { ...prev.materialsUsed, [pkgId]: { ...(prev.materialsUsed[pkgId] ?? { cement: "", steel: "", bricks: "", wiring: "", plumbing: "", paint: "" }), [field]: value } } }));

  const updateCell = (rowId: string, pkgId: string, field: keyof CostRange, next: number | null) =>
    setPricing((prev) => ({ ...prev, rows: prev.rows.map((r) => r.id !== rowId ? r : { ...r, costs: { ...r.costs, [pkgId]: { ...r.costs[pkgId], [field]: next } } }) }));

  const addPlotRow = () => {
    const label = newPlotSize.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 40) + `-${Date.now()}`;
    const costs: Record<string, CostRange> = {};
    for (const p of pricing.packages) costs[p.id] = { min: null, max: null };
    setPricing((prev) => ({ ...prev, rows: [...prev.rows, { id, plotSizeLabel: label, removable: true, costs }] }));
    setNewPlotSize("");
  };

  const removeRow = (rowId: string) => setPricing((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== rowId) }));

  const resetRows = () => {
    setPricing((prev) => {
      const baseRows = defaultPricingFromCompany(company).rows;
      return { ...prev, rows: baseRows.map((r) => { const costs: Record<string, CostRange> = {}; for (const p of prev.packages) costs[p.id] = { min: null, max: null }; return { ...r, costs }; }) };
    });
    toast({ title: "Pricing rows reset" });
  };

  const hasInvalidRanges = useMemo(
    () => pricing.rows.some((r) => pricing.packages.some((pkg) => { const { min, max } = r.costs[pkg.id] ?? {}; return min != null && max != null && min > max; })),
    [pricing.rows, pricing.packages],
  );

  const save = async () => {
    if (hasInvalidRanges) { toast({ variant: "destructive", title: "Fix pricing ranges", description: "Some rows have Min > Max." }); return; }
    localStorage.setItem(storageKey(companyKey), JSON.stringify(pricing));

    if (!companySlug) { toast({ title: "Saved locally", description: "Link a company profile to sync to server." }); return; }

    setSaving(true);
    try {
      const pkgIds = pricing.packages.map((p) => p.id);
      const estimatedCostRange: Record<string, Record<string, { min: number | null; max: number | null }>> = {};
      for (const row of pricing.rows) {
        estimatedCostRange[row.id] = {};
        for (const pkgId of pkgIds) estimatedCostRange[row.id][pkgId] = row.costs[pkgId] ?? { min: null, max: null };
      }
      const nested: Record<string, Record<string, Record<string, Record<string, unknown>>>> = {};
      const flat: Record<string, unknown>[] = [];
      for (const row of pricing.areaRates) {
        if (!row.city || !row.society || !row.phase) continue;
        if (!nested[row.city]) nested[row.city] = {};
        if (!nested[row.city][row.society]) nested[row.city][row.society] = {};
        if (!nested[row.city][row.society][row.phase]) nested[row.city][row.society][row.phase] = {};
        for (const pkgId of pkgIds) {
          const rate = row.rates[pkgId] ?? null;
          nested[row.city][row.society][row.phase][pkgId] = rate != null ? `PKR ${rate}/sq ft` : "";
          flat.push({ city: row.city, area: row.society, subarea: row.society, location: row.phase, package: pkgId, price_per_sqft: rate ?? 0, price_raw: rate != null ? `PKR ${rate}/sq ft` : "" });
        }
      }
      const profileData: Record<string, unknown> = { ...(profileRef.current ?? {}), package_scope: pricing.packageScope, materials_used: pricing.materialsUsed, estimated_total_cost_range: estimatedCostRange, operational_areas: nested, flattened_operational_areas: flat, _editor_pricing_v3: pricing };
      await api.companies.updateProfile(companySlug, profileData);
      await api.companies.updatePackages(companySlug, { operational_areas: nested, flattened_operational_areas: flat, package_scope: pricing.packageScope, materials_used: pricing.materialsUsed, estimated_total_cost_range: estimatedCostRange });
      profileRef.current = profileData;
      toast({ title: "Saved", description: "Packages & pricing updated." });
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err instanceof Error ? err.message : "Server error." });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const active = pricing.packages.find((p) => p.id === activePackage) ?? pricing.packages[0];
  const uniqueCities = Array.from(new Set(pricing.areaRates.filter((r) => r.city).map((r) => r.city))).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("pricing.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={resetRows} disabled={saving}><RotateCcw className="h-4 w-4" /> Reset</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="cities">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="cities"><MapPin className="me-1 h-3.5 w-3.5" />Cities / Areas</TabsTrigger>
          <TabsTrigger value="packages"><Package className="me-1 h-3.5 w-3.5" />Packages</TabsTrigger>
          <TabsTrigger value="materials"><Wrench className="me-1 h-3.5 w-3.5" />Materials</TabsTrigger>
          <TabsTrigger value="pricing">₨ Pricing</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Cities / Areas Covered ──────────────────────────────────── */}
        <TabsContent value="cities" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Cities where you operate</p>
                <p className="text-xs text-muted-foreground">Add cities, societies/areas, and phases where your company provides construction services.</p>
              </div>
              <Button type="button" variant="secondary" onClick={addArea}><Plus className="h-4 w-4" /> Add location</Button>
            </div>

            {pricing.areaRates.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No service locations added yet. Click "Add location" to start.</p>
            ) : (
              <div className="mt-4 grid gap-4">
                {pricing.areaRates.map((row, idx) => {
                  const cityKnown = (cityOptions as readonly string[]).includes(row.city);
                  const citySelectValue = row.city ? (cityKnown ? row.city : "__custom__") : "__none__";
                  const societyOpts = cityKnown ? (societiesByCity[row.city] ?? []) : [];
                  const societyKnown = cityKnown && societyOpts.includes(row.society);
                  const societySelectValue = row.society ? (societyKnown ? row.society : "__custom__") : "__none__";
                  return (
                    <div key={row.id} className="rounded-2xl border border-border bg-background/30 p-4">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-foreground">Location {idx + 1}</p>
                        <Button type="button" variant="link" className="h-auto p-0 text-xs text-destructive" onClick={() => removeArea(row.id)}>
                          <X className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">City</Label>
                          <Select value={citySelectValue} onValueChange={(v) => {
                            if (v === "__none__") { patchArea(row.id, { city: "", society: "" }); return; }
                            if (v === "__custom__") { if (cityKnown) patchArea(row.id, { city: "", society: "" }); return; }
                            patchArea(row.id, { city: v, society: societiesByCity[v]?.includes(row.society) ? row.society : "" });
                          }}>
                            <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select city" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Not set</SelectItem>
                              {(cityOptions as readonly string[]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              <SelectItem value="__custom__">Other (type manually)</SelectItem>
                            </SelectContent>
                          </Select>
                          {citySelectValue === "__custom__" && <Input value={row.city} onChange={(e) => patchArea(row.id, { city: e.target.value, society: "" })} className="bg-background/40" placeholder="Enter city" />}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Society / Area</Label>
                          {cityKnown ? (
                            <>
                              <Select value={societySelectValue} onValueChange={(v) => {
                                if (v === "__none__") { patchArea(row.id, { society: "" }); return; }
                                if (v === "__custom__") { if (societyKnown) patchArea(row.id, { society: "" }); return; }
                                patchArea(row.id, { society: v });
                              }}>
                                <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select society" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Not set</SelectItem>
                                  {societyOpts.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                  <SelectItem value="__custom__">Other (type manually)</SelectItem>
                                </SelectContent>
                              </Select>
                              {societySelectValue === "__custom__" && <Input value={row.society} onChange={(e) => patchArea(row.id, { society: e.target.value })} className="bg-background/40" placeholder="Enter society" />}
                            </>
                          ) : (
                            <Input value={row.society} onChange={(e) => patchArea(row.id, { society: e.target.value })} className="bg-background/40" placeholder="Enter society" />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Phase / Block</Label>
                          <Input value={row.phase} onChange={(e) => patchArea(row.id, { phase: e.target.value })} className="bg-background/40" placeholder="e.g., Phase 1 / Block A" list="phase-suggestions-cities" />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <datalist id="phase-suggestions-cities">{phaseSuggestions.map((p) => <option key={p} value={p} />)}</datalist>
              </div>
            )}

            {uniqueCities.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-foreground">Covered cities</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {uniqueCities.map((city) => <Badge key={city} variant="secondary" className="rounded-lg">{city}</Badge>)}
                </div>
              </div>
            )}
          </GlassCard>
        </TabsContent>

        {/* ── Tab 2: Packages ────────────────────────────────────────────────── */}
        <TabsContent value="packages" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Package tiers</p>
                <p className="text-xs text-muted-foreground">Add or remove package tiers (e.g., Standard, Premium, Executive).</p>
              </div>
              <div className="flex items-center gap-2">
                <Input value={newPackageLabel} onChange={(e) => setNewPackageLabel(e.target.value)} placeholder="New package name…" className="bg-background/40 w-48" onKeyDown={(e) => { if (e.key === "Enter") addPackage(); }} />
                <Button type="button" variant="secondary" onClick={addPackage} disabled={!newPackageLabel.trim()}><Plus className="h-4 w-4" /> Add</Button>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package name</TableHead>
                    <TableHead className="hidden sm:table-cell">Key (ID)</TableHead>
                    <TableHead className="w-24 text-end">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricing.packages.map((pkg) => (
                    <TableRow key={pkg.id} className={cn(pkg.id === activePackage && "bg-secondary/40")} onClick={() => setActivePackage(pkg.id)}>
                      <TableCell className="cursor-pointer font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {pkg.label}
                          {pkg.id === activePackage && <Badge variant="secondary" className="rounded-lg text-xs">Active</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{pkg.id}</TableCell>
                      <TableCell className="text-end">
                        <Button type="button" variant="link" className="h-auto p-0 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); deletePackage(pkg.id); }} disabled={pricing.packages.length <= 1}>Delete</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {pricing.packages.length <= 1 && <p className="mt-2 text-xs text-muted-foreground">Keep at least one package tier.</p>}
          </GlassCard>

          {active && (
            <GlassCard interactive={false} className="p-5">
              <p className="text-sm font-semibold text-foreground">Package scope</p>
              <p className="mt-1 text-xs text-muted-foreground">What is included in each package tier. Click a package tab to switch.</p>
              <Tabs value={activePackage} onValueChange={setActivePackage} className="mt-4">
                <TabsList>{pricing.packages.map((p) => <TabsTrigger key={p.id} value={p.id}>{p.label}</TabsTrigger>)}</TabsList>
                {pricing.packages.map((pkg) => {
                  const scope = pricing.packageScope[pkg.id] ?? {};
                  return (
                    <TabsContent key={pkg.id} value={pkg.id} className="mt-4 space-y-4">
                      <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Design included</p>
                          <p className="text-xs text-muted-foreground">Design services bundled in this package.</p>
                        </div>
                        <Switch checked={Boolean(scope.design_included)} onCheckedChange={(v) => updateScope(pkg.id, "design_included", v)} />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(["fixtures", "ceiling", "kitchen", "bathroom"] as const).map((field) => {
                          const val = scope[field] || "__none__";
                          const knownOpts = scopeOptions[field] ?? [];
                          const isCustomVal = val !== "__none__" && val !== "" && !knownOpts.includes(val);
                          return (
                          <div key={field} className="space-y-2">
                            <Label className="text-xs text-muted-foreground capitalize">{field}</Label>
                            {isCustomVal ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={val === "__none__" ? "" : val}
                                  onChange={(e) => updateScope(pkg.id, field, e.target.value)}
                                  placeholder="Type custom value…"
                                  className="bg-background/40 h-9 text-sm flex-1"
                                  autoFocus
                                />
                                <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-xs text-muted-foreground" onClick={() => updateScope(pkg.id, field, "")}>
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                            <Select value={val} onValueChange={(v) => { if (v === "__custom__") { updateScope(pkg.id, field, " "); } else { updateScope(pkg.id, field, v === "__none__" ? "" : v); } }}>
                              <SelectTrigger className="bg-background/40"><SelectValue placeholder={`Select ${field}`} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Not set</SelectItem>
                                {knownOpts.map((opt) => <SelectItem key={opt} value={opt}>{humanizeToken(opt)}</SelectItem>)}
                                <SelectItem value="__custom__" className="text-primary">Custom…</SelectItem>
                              </SelectContent>
                            </Select>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </GlassCard>
          )}
        </TabsContent>

        {/* ── Tab 4: Materials ───────────────────────────────────────────────── */}
        <TabsContent value="materials" className="mt-6">
          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Materials used per package</p>
            <p className="mt-1 text-xs text-muted-foreground">Specify brand and grade for each material, per package tier.</p>
            <Tabs value={activePackage} onValueChange={setActivePackage} className="mt-4">
              <TabsList>{pricing.packages.map((p) => <TabsTrigger key={p.id} value={p.id}>{p.label}</TabsTrigger>)}</TabsList>
              {pricing.packages.map((pkg) => {
                const m = pricing.materialsUsed[pkg.id] ?? { cement: "", steel: "", bricks: "", wiring: "", plumbing: "", paint: "" };
                return (
                  <TabsContent key={pkg.id} value={pkg.id} className="mt-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {(["cement", "steel", "bricks", "wiring", "plumbing", "paint"] as const).map((field) => (
                        <div key={field} className="space-y-2">
                          <Label className="text-xs text-muted-foreground capitalize">{field}</Label>
                          <Input value={m[field]} onChange={(e) => updateMaterial(pkg.id, field, e.target.value)} className="bg-background/40" placeholder={`e.g., ${materialSuggestions[field]?.[0] ?? field}`} list={`mat-${field}`} />
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
            {(["cement", "steel", "bricks", "wiring", "plumbing", "paint"] as const).map((field) => (
              <datalist key={field} id={`mat-${field}`}>{materialSuggestions[field].map((v) => <option key={v} value={v} />)}</datalist>
            ))}
          </GlassCard>
        </TabsContent>

        {/* ── Tab 5: Pricing ─────────────────────────────────────────────────── */}
        <TabsContent value="pricing" className="mt-6 space-y-4">
          {pricing.areaRates.some((r) => r.city || r.society) && (
            <GlassCard interactive={false} className="p-5">
              <p className="text-sm font-semibold text-foreground">Per-location rates (PKR/sq ft)</p>
              <p className="mt-1 text-xs text-muted-foreground">Rate per sq ft for each area and package combination.</p>
              <div className="mt-4 grid gap-4">
                {pricing.areaRates.filter((r) => r.city || r.society).map((row, idx) => (
                  <div key={row.id} className="rounded-2xl border border-border bg-background/30 p-4">
                    <p className="text-sm font-medium text-foreground">{[row.city, row.society, row.phase].filter(Boolean).join(" › ") || `Location ${idx + 1}`}</p>
                    <div className={cn("mt-3 grid gap-3", pricing.packages.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
                      {pricing.packages.map((pkg) => (
                        <div key={pkg.id} className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{pkg.label} (₨/sq ft)</Label>
                          <Input type="number" min={0} step={50} value={row.rates?.[pkg.id] ?? ""} onChange={(e) => patchAreaRate(row.id, pkg.id, parseOptionalNumber(e.target.value))} className="bg-background/40" placeholder="PKR/sq ft" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          <GlassCard interactive={false} className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Estimated total cost range (PKR)</p>
                <p className="text-xs text-muted-foreground">Set Min and Max total cost per plot size × package. Use package tabs to fill each column.</p>
              </div>
              <div className="flex items-center gap-2">
                <Input value={newPlotSize} onChange={(e) => setNewPlotSize(e.target.value)} placeholder="Add plot size…" className="w-44 bg-background/40" onKeyDown={(e) => { if (e.key === "Enter") addPlotRow(); }} />
                <Button type="button" variant="secondary" onClick={addPlotRow} disabled={!newPlotSize.trim()}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <Tabs value={activePackage} onValueChange={setActivePackage} className="mt-4">
              <TabsList>{pricing.packages.map((k) => <TabsTrigger key={k.id} value={k.id}>{k.label}</TabsTrigger>)}</TabsList>
              {pricing.packages.map((pkg) => (
                <TabsContent key={pkg.id} value={pkg.id} className="mt-4">
                  <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-44">Plot size</TableHead>
                          <TableHead className="min-w-[12rem]">Min (PKR)</TableHead>
                          <TableHead className="min-w-[12rem]">Max (PKR)</TableHead>
                          <TableHead className="w-20 text-end">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pricing.rows.map((r) => {
                          const cell = r.costs[pkg.id] ?? { min: null, max: null };
                          const invalid = cell.min != null && cell.max != null && cell.min > cell.max;
                          return (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium text-foreground">{r.plotSizeLabel}</TableCell>
                              <TableCell>
                                <Input type="number" min={0} step={50000} value={cell.min ?? ""} onChange={(e) => updateCell(r.id, pkg.id, "min", parseOptionalNumber(e.target.value))} className={cn("bg-background/40", invalid && "border-destructive/60")} placeholder="Min" />
                              </TableCell>
                              <TableCell>
                                <Input type="number" min={0} step={50000} value={cell.max ?? ""} onChange={(e) => updateCell(r.id, pkg.id, "max", parseOptionalNumber(e.target.value))} className={cn("bg-background/40", invalid && "border-destructive/60")} placeholder="Max" />
                                {invalid && <p className="mt-1 text-xs text-destructive">Min must be ≤ Max.</p>}
                              </TableCell>
                              <TableCell className="text-end">
                                {r.removable ? <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => removeRow(r.id)}>Remove</Button> : <span className="text-xs text-muted-foreground">—</span>}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Client Plan Cards ────────────────────────────────────────────────────────

type Plan = { name: string; price: string; description: string; highlights?: string; features: string[]; tone: "base" | "primary" | "premium"; cta: string };

const plans: Plan[] = [
  { name: "Basic", price: "Free", description: "Explore companies and submit your first request.", features: ["Browse verified companies", "Request management", "Standard support"], tone: "base", cta: "Get started" },
  { name: "Pro", price: "PKR 4,999/mo", description: "For active projects and faster vendor matching.", features: ["Unlimited requests", "Priority matching", "AI assistant access"], tone: "primary", cta: "Choose Pro" },
  { name: "Premium", price: "PKR 12,999/mo", description: "Gold-tier control, visibility, and analytics.", highlights: "Premium", features: ["Premium supplier visibility", "Advanced analytics", "Priority support"], tone: "premium", cta: "Go Premium" },
];

function PlanCard({ plan }: { plan: Plan }) {
  const premium = plan.tone === "premium";
  return (
    <GlassCard className={cn("p-6", premium && "ring-1 ring-premium/30 bg-premium/5")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{plan.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
        </div>
        {plan.highlights && <Badge variant={premium ? "outline" : "secondary"} className={cn("rounded-lg", premium && "border-premium/30 text-premium")}>{plan.highlights}</Badge>}
      </div>
      <div className="mt-5">
        <p className="text-3xl font-bold text-foreground">{plan.price}</p>
        <p className="mt-1 text-xs text-muted-foreground">Billed monthly. Cancel anytime.</p>
      </div>
      <div className="mt-5 space-y-2">
        {plan.features.map((f) => (
          <div key={f} className="flex items-start gap-2 text-sm">
            <div className={cn("mt-0.5 rounded-md p-1", premium ? "bg-premium/10" : "bg-primary/10")}>
              <Check className={cn("h-3.5 w-3.5", premium ? "text-premium" : "text-primary")} />
            </div>
            <span className="text-foreground">{f}</span>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Button className={cn("w-full", premium && "bg-premium text-premium-foreground hover:bg-premium/90")} variant={plan.tone === "base" ? "secondary" : "default"}>{plan.cta}</Button>
      </div>
    </GlassCard>
  );
}

// ─── Page Entry ───────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  if (user?.role === "company") {
    return <CompanyPricingEditor email={user.email} companySlug={user.companyFile} />;
  }

  if (user?.role === "supplier") {
    return (
      <GlassCard interactive={false} className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update material prices from Inventory.</p>
        <div className="mt-4"><Button asChild><Link to="/products">Go to Inventory</Link></Button></div>
      </GlassCard>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pricing</h1>
        <p className="text-sm text-muted-foreground">Three tiers designed for real construction workflows.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">{plans.map((p) => <PlanCard key={p.name} plan={p} />)}</div>
    </div>
  );
}
