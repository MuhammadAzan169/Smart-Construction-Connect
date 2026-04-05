import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";

import { GlassCard } from "@/components/shared/GlassCard";
import { MatchScoreRing } from "@/components/shared/MatchScoreRing";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchCompanyDirectory, getPackageKeys, humanizeToken, type CompanyDirectoryItem } from "@/data/companyData";
import { fetchSupplierDirectory, type SupplierDirectoryItem } from "@/data/supplierData";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import {
  ArrowDownUp,
  Building2,
  Check,
  ChevronDown,
  Filter,
  MapPin,
  MessageSquare,
  Minus,
  Package,
  Plus,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

const formatPKR = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);

function previewList(items: string[], max: number) {
  const cleaned = items.filter((x) => x && x !== " - ");
  const shown = cleaned.slice(0, max);
  const more = Math.max(0, cleaned.length - shown.length);
  return {
    text: shown.join(" * "),
    more,
  };
}

export default function CompaniesPage() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  if (user.role === "admin") {
    return <AdminCompaniesView />;
  }

  if (user.role === "client") {
    return <ClientCompaniesView />;
  }

  if (user.role === "company") {
    return <ClientCompaniesView defaultTab="materials" hideTabs />;
  }

  return (
    <GlassCard interactive={false} className="p-6">
      <h1 className="text-lg font-semibold text-foreground">Companies</h1>
      <p className="mt-1 text-sm text-muted-foreground">This section is available for Client and Admin roles.</p>
    </GlassCard>
  );
}

function ClientCompaniesView({ defaultTab, hideTabs }: { defaultTab?: "companies" | "materials"; hideTabs?: boolean } = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const paramTab = searchParams.get("tab");
  const [tab, setTabRaw] = useState<"companies" | "materials">(
    paramTab === "materials" ? "materials" : paramTab === "companies" ? "companies" : (defaultTab ?? "companies")
  );
  const setTab = (t: "companies" | "materials") => {
    setTabRaw(t);
    setSearchParams({ tab: t }, { replace: true });
  };
  const [search, setSearch] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareSupplierIds, setCompareSupplierIds] = useState<string[]>([]);
  const [sortCompanies, setSortCompanies] = useState<"match" | "rating" | "price_asc" | "price_desc" | "projects">("match");
  const [sortSuppliers, setSortSuppliers] = useState<"rating" | "price_asc" | "price_desc" | "materials">("rating");

  const [materialCategories, setMaterialCategories] = useState<string[]>([]);
  const [onlyVerifiedSupplier, setOnlyVerifiedSupplier] = useState(false);
  const [supplierData, setSupplierData] = useState<SupplierDirectoryItem[]>([]);
  const [companyData, setCompanyData] = useState<CompanyDirectoryItem[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [compareOpen, setCompareOpen] = useState(true);

  useEffect(() => {
    fetchCompanyDirectory().then((data) => {
      setCompanyData(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchSupplierDirectory().then(setSupplierData);
  }, []);

  const locationOptions = useMemo(() => {
    const allCities = companyData.flatMap((c) => (c.cities.length ? c.cities : [c.location]));
    return Array.from(new Set(allCities.filter((x) => x && x !== " - "))).sort();
  }, [companyData]);

  const specializationOptions = useMemo(() => {
    return Array.from(new Set(companyData.flatMap((c) => c.specialization))).sort();
  }, [companyData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = companyData.filter((c) => {
      const cities = c.cities.length ? c.cities : [c.location];
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        cities.some((x) => x.toLowerCase().includes(q)) ||
        c.areas.some((x) => x.toLowerCase().includes(q)) ||
        c.societies.some((x) => x.toLowerCase().includes(q)) ||
        c.specialization.some((s) => s.toLowerCase().includes(q));
      const matchesVerified = !onlyVerified || c.verified;
      const matchesLocation = locations.length === 0 || locations.some((loc) => cities.includes(loc));
      const matchesSpecs = specializations.length === 0 || c.specialization.some((s) => specializations.includes(s));
      return matchesQuery && matchesVerified && matchesLocation && matchesSpecs;
    });

    return [...base].sort((a, b) => {
      if (sortCompanies === "rating") return b.rating - a.rating;
      if (sortCompanies === "projects") return (b.completedProjects ?? 0) - (a.completedProjects ?? 0);
      if (sortCompanies === "price_asc" || sortCompanies === "price_desc") {
        const aMin = a.raw.flattened_operational_areas?.map(x => x.price_per_sqft).filter(Boolean)[0] ?? 0;
        const bMin = b.raw.flattened_operational_areas?.map(x => x.price_per_sqft).filter(Boolean)[0] ?? 0;
        return sortCompanies === "price_asc" ? aMin - bMin : bMin - aMin;
      }
      return b.matchScore - a.matchScore;
    });
  }, [search, onlyVerified, locations, specializations, companyData, sortCompanies]);

  const materialCategoryOptions = useMemo(() => {
    return Array.from(new Set(supplierData.flatMap((s) => s.categories))).sort();
  }, [supplierData]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = supplierData.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.categories.some((c) => c.toLowerCase().includes(q));
      const matchesCategory =
        materialCategories.length === 0 ||
        s.categories.some((c) => materialCategories.includes(c));
      const matchesVerified = !onlyVerifiedSupplier || s.verified;
      return matchesQuery && matchesCategory && matchesVerified;
    });

    return [...base].sort((a, b) => {
      if (sortSuppliers === "price_asc") return (a.minPrice ?? 0) - (b.minPrice ?? 0);
      if (sortSuppliers === "price_desc") return (b.maxPrice ?? 0) - (a.maxPrice ?? 0);
      if (sortSuppliers === "materials") return b.materialCount - a.materialCount;
      return b.rating - a.rating;
    });
  }, [supplierData, search, materialCategories, onlyVerifiedSupplier, sortSuppliers]);

  const selectedCompanies = useMemo(
    () => companyData.filter((c) => compareIds.includes(c.id)),
    [compareIds, companyData],
  );

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const clearCompare = () => setCompareIds([]);

  const selectedSuppliers = useMemo(
    () => supplierData.filter((s) => compareSupplierIds.includes(s.id)),
    [compareSupplierIds, supplierData],
  );

  const toggleSupplierCompare = (id: string) => {
    setCompareSupplierIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const clearSupplierCompare = () => setCompareSupplierIds([]);

  const activeFilterCount = (onlyVerified ? 1 : 0) + locations.length + specializations.length;
  const activeMaterialFilterCount = (onlyVerifiedSupplier ? 1 : 0) + materialCategories.length;

  const Filters = (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">Verified only</Label>
          <Checkbox checked={onlyVerified} onCheckedChange={(v) => setOnlyVerified(v === true)} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Show only vetted construction partners.</p>
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Location</p>
        <div className="space-y-2 max-h-52 overflow-y-auto scroll-styled pr-1">
          {locationOptions.map((loc) => {
            const checked = locations.includes(loc);
            return (
              <label key={loc} className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    setLocations((prev) => (v === true ? [...prev, loc] : prev.filter((x) => x !== loc)))
                  }
                />
                <span className="truncate">{loc}</span>
              </label>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Specialization</p>
        <div className="space-y-2 max-h-52 overflow-y-auto scroll-styled pr-1">
          {specializationOptions.map((spec) => {
            const checked = specializations.includes(spec);
            return (
              <label key={spec} className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    setSpecializations((prev) => (v === true ? [...prev, spec] : prev.filter((x) => x !== spec)))
                  }
                />
                <span className="truncate">{spec}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );

  const MaterialFilters = (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">Verified only</Label>
          <Checkbox checked={onlyVerifiedSupplier} onCheckedChange={(v) => setOnlyVerifiedSupplier(v === true)} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Show only verified material suppliers.</p>
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Categories</p>
        <div className="space-y-2 max-h-64 overflow-y-auto scroll-styled pr-1">
          {materialCategoryOptions.map((cat) => {
            const checked = materialCategories.includes(cat);
            return (
              <label key={cat} className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) =>
                    setMaterialCategories((prev) => (v === true ? [...prev, cat] : prev.filter((x) => x !== cat)))
                  }
                />
                <span className="truncate">{cat}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* â”€â”€ Page header â”€â”€ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Browse</h1>
          <p className="text-sm text-muted-foreground">
            {hideTabs && tab === "materials"
              ? "Browse material suppliers and vendors."
              : hideTabs && tab === "companies"
              ? "Browse construction companies."
              : "Find construction companies or material suppliers."}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!hideTabs && (
            <Tabs value={tab} onValueChange={(v) => setTab(v === "materials" ? "materials" : "companies")}>
              <TabsList>
                <TabsTrigger value="companies">
                  <Building2 className="mr-1.5 h-3.5 w-3.5" />
                  Construction
                </TabsTrigger>
                <TabsTrigger value="materials">
                  <Package className="mr-1.5 h-3.5 w-3.5" />
                  Materials
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Mobile filters sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm" className="lg:hidden gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Filters
                {(tab === "companies" ? activeFilterCount : activeMaterialFilterCount) > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {tab === "companies" ? activeFilterCount : activeMaterialFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="bg-background text-foreground">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6 overflow-y-auto">
                {tab === "companies" ? Filters : MaterialFilters}
              </div>
            </SheetContent>
          </Sheet>

          {/* Compare button */}
          {tab === "companies" ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  className={cn("hidden sm:flex gap-1.5", compareIds.length === 0 && "opacity-60")}
                  variant="secondary"
                  size="sm"
                  disabled={compareIds.length === 0}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Compare ({compareIds.length})
                </Button>
              </DialogTrigger>
              <CompareDialog companies={selectedCompanies} onClear={clearCompare} />
            </Dialog>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  className={cn("hidden sm:flex gap-1.5", compareSupplierIds.length === 0 && "opacity-60")}
                  variant="secondary"
                  size="sm"
                  disabled={compareSupplierIds.length === 0}
                >
                  <Package className="h-3.5 w-3.5" />
                  Compare ({compareSupplierIds.length})
                </Button>
              </DialogTrigger>
              <SupplierCompareDialog suppliers={selectedSuppliers} onClear={clearSupplierCompare} />
            </Dialog>
          )}
        </div>
      </div>

      {/* â”€â”€ Search + sort bar â”€â”€ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "companies"
                ? "Search by company, city, area, or specialization..."
                : "Search by supplier, city, or material type..."
            }
            className="bg-background/60 pl-9 backdrop-blur-sm"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {tab === "companies" ? (
              <Select value={sortCompanies} onValueChange={(v) => setSortCompanies(v as typeof sortCompanies)}>
                <SelectTrigger className="h-9 w-44 bg-background/60 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match"><span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" />Best Match</span></SelectItem>
                  <SelectItem value="rating"><span className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5" />Top Rated</span></SelectItem>
                  <SelectItem value="price_asc"><span className="flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5" />Price: Low - High</span></SelectItem>
                  <SelectItem value="price_desc"><span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Price: High - Low</span></SelectItem>
                  <SelectItem value="projects"><span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />Most Projects</span></SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select value={sortSuppliers} onValueChange={(v) => setSortSuppliers(v as typeof sortSuppliers)}>
                <SelectTrigger className="h-9 w-44 bg-background/60 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating"><span className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5" />Top Rated</span></SelectItem>
                  <SelectItem value="price_asc"><span className="flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5" />Price: Low - High</span></SelectItem>
                  <SelectItem value="price_desc"><span className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Price: High - Low</span></SelectItem>
                  <SelectItem value="materials"><span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />Most Materials</span></SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <p className="hidden sm:block text-sm text-muted-foreground shrink-0">
            <span className="font-semibold text-foreground">
              {tab === "companies" ? filtered.length : filteredSuppliers.length}
            </span>{" "}results
          </p>
        </div>
      </div>

      {/* â”€â”€ Active filter chips â”€â”€ */}
      {(tab === "companies" ? (locations.length > 0 || specializations.length > 0 || onlyVerified) : (materialCategories.length > 0 || onlyVerifiedSupplier)) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Active filters:</span>
          {tab === "companies" ? (
            <>
              {onlyVerified && (
                <button
                  type="button"
                  onClick={() => setOnlyVerified(false)}
                  className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  Verified only Ã—
                </button>
              )}
              {locations.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocations((prev) => prev.filter((x) => x !== l))}
                  className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                >
                  <MapPin className="h-2.5 w-2.5" />{l} Ã—
                </button>
              ))}
              {specializations.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpecializations((prev) => prev.filter((x) => x !== s))}
                  className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                >
                  {s} Ã—
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setOnlyVerified(false); setLocations([]); setSpecializations([]); }}
                className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
              >
                Clear all
              </button>
            </>
          ) : (
            <>
              {onlyVerifiedSupplier && (
                <button
                  type="button"
                  onClick={() => setOnlyVerifiedSupplier(false)}
                  className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  Verified only Ã—
                </button>
              )}
              {materialCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setMaterialCategories((prev) => prev.filter((x) => x !== c))}
                  className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                >
                  {c} Ã—
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setMaterialCategories([]); setOnlyVerifiedSupplier(false); }}
                className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {tab === "companies" ? (
          <motion.div
            key="companies"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="grid gap-6 lg:grid-cols-[17rem_1fr_19rem]"
          >
            {/* â”€â”€ Desktop filters â”€â”€ */}
            <div className="hidden lg:block">
              <GlassCard interactive={false} className="sticky top-24 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Filters</p>
                    {activeFilterCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {activeFilterCount}
                      </span>
                    )}
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", filtersOpen && "rotate-180")} />
                </button>

                <AnimatePresence initial={false}>
                  {filtersOpen && (
                    <motion.div
                      key="filter-body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="max-h-[calc(100vh-14rem)] overflow-y-auto scroll-styled px-5 pb-5">
                        <div className="mb-3 flex justify-end">
                          <Button
                            variant="link"
                            className="h-auto p-0 text-xs"
                            onClick={() => { setOnlyVerified(false); setLocations([]); setSpecializations([]); }}
                          >
                            Reset all
                          </Button>
                        </div>
                        {Filters}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </div>

            {/* â”€â”€ Company cards â”€â”€ */}
            <div className="space-y-4 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scroll-styled pr-1">
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                      <Skeleton className="h-44 w-full" />
                      <div className="space-y-3 p-4">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <div className="flex gap-2">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-20" />
                        </div>
                        <Skeleton className="h-9 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <GlassCard interactive={false} className="p-8 text-center">
                  <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-foreground">No companies match your filters.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try broadening location or specialization.</p>
                </GlassCard>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filtered.map((company, idx) => {
                    const compareSelected = compareIds.includes(company.id);
                    const compareDisabled = !compareSelected && compareIds.length >= 3;
                    return (
                      <motion.div
                        key={company.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.05, 0.4), duration: 0.3 }}
                      >
                        <CompanyCard
                          company={company}
                          compareSelected={compareSelected}
                          compareDisabled={compareDisabled}
                          onNavigate={() => navigate(`/companies/${company.id}`)}
                          onMessage={() => {
                            const email = company.raw.contact?.email || "";
                            if (!email) return;
                            api.messages.startConversation(email, company.name, "Hi, I'm interested in your construction services.").then(() => navigate("/messages"));
                          }}
                          onToggleCompare={() => toggleCompare(company.id)}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* â”€â”€ Compare panel (desktop) â”€â”€ */}
            <div className="hidden lg:block">
              <GlassCard interactive={false} className="sticky top-24 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCompareOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Compare</p>
                    {compareIds.length > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {compareIds.length}
                      </span>
                    )}
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", compareOpen && "rotate-180")} />
                </button>

                <AnimatePresence initial={false}>
                  {compareOpen && (
                    <motion.div
                      key="compare-body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5">
                        {compareIds.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border bg-background/20 px-4 py-6 text-center">
                            <Building2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                            <p className="text-xs text-muted-foreground">Select up to 3 companies to compare side by side.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {selectedCompanies.map((c) => (
                              <div
                                key={c.id}
                                className="group cursor-pointer rounded-2xl border border-border bg-background/30 p-3 transition-colors hover:border-primary/30 hover:bg-background/50"
                                onClick={() => navigate(`/companies/${c.id}`)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{c.location}</p>
                                  </div>
                                  <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{c.matchScore}%</span>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <Star className="h-3 w-3 fill-warning text-warning" />
                                  <span className="text-xs text-foreground">{c.rating}</span>
                                  <span className="text-xs text-muted-foreground">* {c.priceRange}</span>
                                </div>
                                <button
                                  type="button"
                                  className="mt-1.5 text-[10px] text-destructive/70 hover:text-destructive transition-colors"
                                  onClick={(e) => { e.stopPropagation(); toggleCompare(c.id); }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}

                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="default" size="sm" className="flex-1">
                                    Compare ({compareIds.length})
                                  </Button>
                                </DialogTrigger>
                                <CompareDialog companies={selectedCompanies} onClear={clearCompare} />
                              </Dialog>
                              <Button variant="secondary" size="sm" onClick={clearCompare} className="px-3">
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="materials"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="grid gap-6 lg:grid-cols-[17rem_1fr_19rem]"
          >
            {/* â”€â”€ Desktop material filters â”€â”€ */}
            <div className="hidden lg:block">
              <GlassCard interactive={false} className="sticky top-24 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Filters</p>
                    {activeMaterialFilterCount > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {activeMaterialFilterCount}
                      </span>
                    )}
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", filtersOpen && "rotate-180")} />
                </button>

                <AnimatePresence initial={false}>
                  {filtersOpen && (
                    <motion.div
                      key="mat-filter-body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="max-h-[calc(100vh-14rem)] overflow-y-auto scroll-styled px-5 pb-5">
                        <div className="mb-3 flex justify-end">
                          <Button
                            variant="link"
                            className="h-auto p-0 text-xs"
                            onClick={() => { setMaterialCategories([]); setOnlyVerifiedSupplier(false); }}
                          >
                            Reset all
                          </Button>
                        </div>
                        {MaterialFilters}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </div>

            {/* â”€â”€ Supplier cards â”€â”€ */}
            <div className="space-y-4 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scroll-styled pr-1">
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                      <Skeleton className="h-44 w-full" />
                      <div className="space-y-3 p-4">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <div className="flex gap-2">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-20" />
                        </div>
                        <Skeleton className="h-9 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <GlassCard interactive={false} className="p-8 text-center">
                  <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-foreground">No suppliers match your search.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try searching by supplier name or category.</p>
                </GlassCard>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredSuppliers.map((s, idx) => {
                    const supplierCompareSelected = compareSupplierIds.includes(s.id);
                    const supplierCompareDisabled = !supplierCompareSelected && compareSupplierIds.length >= 3;
                    return (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.05, 0.4), duration: 0.3 }}
                      >
                        <SupplierCard
                          supplier={s}
                          compareSelected={supplierCompareSelected}
                          compareDisabled={supplierCompareDisabled}
                          onNavigate={() => navigate(`/suppliers/${s.id}`)}
                          onMessage={() => {
                            const email = s.contact?.email || "";
                            if (!email) return;
                            api.messages.startConversation(email, s.name, "Hi, I'm interested in your materials/products.").then(() => navigate("/messages"));
                          }}
                          onToggleCompare={() => toggleSupplierCompare(s.id)}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* â”€â”€ Supplier compare panel (desktop) â”€â”€ */}
            <div className="hidden lg:block">
              <GlassCard interactive={false} className="sticky top-24 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCompareOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Compare</p>
                    {compareSupplierIds.length > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {compareSupplierIds.length}
                      </span>
                    )}
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", compareOpen && "rotate-180")} />
                </button>

                <AnimatePresence initial={false}>
                  {compareOpen && (
                    <motion.div
                      key="supplier-compare-body"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5">
                        {compareSupplierIds.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border bg-background/20 px-4 py-6 text-center">
                            <Package className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                            <p className="text-xs text-muted-foreground">Select up to 3 suppliers to compare side by side.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {selectedSuppliers.map((s) => (
                              <div
                                key={s.id}
                                className="group cursor-pointer rounded-2xl border border-border bg-background/30 p-3 transition-colors hover:border-primary/30 hover:bg-background/50"
                                onClick={() => navigate(`/suppliers/${s.id}`)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{s.city}</p>
                                  </div>
                                  <span className="shrink-0 rounded-lg bg-secondary px-2 py-0.5 text-xs font-bold text-foreground">{s.materialCount} items</span>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <Star className="h-3 w-3 fill-warning text-warning" />
                                  <span className="text-xs text-foreground">{s.rating}</span>
                                  <span className="text-xs text-muted-foreground">* {s.categories[0] ?? " - "}</span>
                                </div>
                                <button
                                  type="button"
                                  className="mt-1.5 text-[10px] text-destructive/70 hover:text-destructive transition-colors"
                                  onClick={(e) => { e.stopPropagation(); toggleSupplierCompare(s.id); }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}

                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="default" size="sm" className="flex-1">
                                    Compare ({compareSupplierIds.length})
                                  </Button>
                                </DialogTrigger>
                                <SupplierCompareDialog suppliers={selectedSuppliers} onClear={clearSupplierCompare} />
                              </Dialog>
                              <Button variant="secondary" size="sm" onClick={clearSupplierCompare} className="px-3">
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Mobile compare bars â”€â”€ */}
      {tab === "companies" && compareIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 px-4 lg:hidden">
          <GlassCard interactive={false} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="font-semibold">Compare</span>
              <span className="text-muted-foreground">({compareIds.length}/3)</span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={clearCompare}>Clear</Button>
              <Dialog>
                <DialogTrigger asChild><Button size="sm">Compare</Button></DialogTrigger>
                <CompareDialog companies={selectedCompanies} onClear={clearCompare} />
              </Dialog>
            </div>
          </GlassCard>
        </div>
      )}

      {tab === "materials" && compareSupplierIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 px-4 lg:hidden">
          <GlassCard interactive={false} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-semibold">Compare</span>
              <span className="text-muted-foreground">({compareSupplierIds.length}/3)</span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={clearSupplierCompare}>Clear</Button>
              <Dialog>
                <DialogTrigger asChild><Button size="sm">Compare</Button></DialogTrigger>
                <SupplierCompareDialog suppliers={selectedSuppliers} onClear={clearSupplierCompare} />
              </Dialog>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  CompanyCard  -  with city price picker                               */
/* ================================================================== */

const formatPKRShort = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
};

function CompanyCard({
  company,
  compareSelected,
  compareDisabled,
  onNavigate,
  onMessage,
  onToggleCompare,
}: {
  company: CompanyDirectoryItem;
  compareSelected: boolean;
  compareDisabled: boolean;
  onNavigate: () => void;
  onMessage: () => void;
  onToggleCompare: () => void;
}) {
  const pkgKeys = getPackageKeys(company.raw);
  const citiesAll = company.cities.length ? company.cities : [company.location];

  // City-based price picker state
  const [selectedCity, setSelectedCity] = useState(citiesAll[0] ?? "");

  // Compute per-city, per-package price ranges
  const cityPrices = useMemo(() => {
    const areas = company.raw.flattened_operational_areas ?? [];
    const map: Record<string, Record<string, number[]>> = {};
    for (const a of areas) {
      if (!a.city || !a.price_per_sqft) continue;
      if (!map[a.city]) map[a.city] = {};
      const pkg = a.package || "standard";
      if (!map[a.city][pkg]) map[a.city][pkg] = [];
      map[a.city][pkg].push(a.price_per_sqft);
    }
    return map;
  }, [company.raw]);

  const cityPriceRow = cityPrices[selectedCity] ?? {};
  const allPricesInCity = Object.values(cityPriceRow).flat();
  const cityMin = allPricesInCity.length ? Math.min(...allPricesInCity) : null;
  const cityMax = allPricesInCity.length ? Math.max(...allPricesInCity) : null;

  return (
    <GlassCard
      className="group flex flex-col overflow-hidden p-0 h-full"
      role="button"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate(); } }}
    >
      {/* Banner image */}
      <div className="relative h-40 shrink-0 overflow-hidden">
        <img
          src={company.image}
          alt={company.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
        />
        {/* Verified badge */}
        <div className="absolute left-3 top-3">
          {company.verified ? <StatusBadge status="verified" /> : null}
        </div>
        {/* Match score */}
        <div className="absolute right-3 top-3">
          <MatchScoreRing score={company.matchScore} size={42} />
        </div>
        {/* Name + primary city overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 pb-2.5 pt-8">
          <p className="truncate text-sm font-bold text-white leading-tight">{company.name}</p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-white/70">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{company.location}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3.5 flex-1">
        {/* Rating + year/projects row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
            <span className="font-semibold text-foreground">{company.rating}</span>
            <span className="text-muted-foreground">({company.reviews})</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {company.yearEstablished && <span>Est. {company.yearEstablished}</span>}
            {company.completedProjects != null && <span>Â·</span>}
            {company.completedProjects != null && <span>{company.completedProjects} projects</span>}
          </div>
        </div>

        {/* â”€â”€ City price picker â”€â”€ */}
        <div
          className="rounded-xl border border-border bg-background/50 p-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2 gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Price / sq ft</p>
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="h-6 w-28 text-[10px] px-2 border-0 bg-secondary/60 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {citiesAll.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {cityMin != null ? (
            <div className="space-y-1.5">
              {/* Overall range for selected city */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Range</span>
                <span className="text-xs font-bold text-foreground">
                  PKR {formatPKRShort(cityMin)}  -  {formatPKRShort(cityMax!)}
                  <span className="font-normal text-muted-foreground"> /sq ft</span>
                </span>
              </div>
              {/* Per-package breakdown */}
              {pkgKeys.length > 0 && (
                <div className="grid grid-cols-3 gap-1 mt-1.5">
                  {pkgKeys.slice(0, 3).map((pkg) => {
                    const vals = cityPriceRow[pkg] ?? [];
                    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                    return (
                      <div key={pkg} className="flex flex-col items-center rounded-lg bg-secondary/50 py-1.5 px-1 gap-0.5">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
                          {humanizeToken(pkg).slice(0, 6)}
                        </span>
                        <span className="text-[11px] font-bold text-foreground leading-none">
                          {avg != null ? `${formatPKRShort(avg)}k`.replace("kk", "k") : " - "}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-1">No pricing data for {selectedCity}</p>
          )}
        </div>

        {/* Specializations */}
        <div className="flex flex-wrap gap-1">
          {company.specialization.slice(0, 2).map((s) => (
            <Badge key={s} variant="secondary" className="rounded-lg text-[10px] px-2 py-0">
              {s}
            </Badge>
          ))}
          {company.specialization.length > 2 && (
            <Badge variant="outline" className="rounded-lg text-[10px] px-2 py-0">
              +{company.specialization.length - 2}
            </Badge>
          )}
        </div>

        {/* All cities chips */}
        <div className="flex flex-wrap items-center gap-1">
          <MapPin className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
          {citiesAll.slice(0, 3).map((city) => (
            <span
              key={city}
              className={cn(
                "rounded-md px-2 py-0.5 text-[10px] cursor-pointer transition-colors",
                city === selectedCity
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-secondary/70 text-foreground hover:bg-secondary"
              )}
              onClick={(e) => { e.stopPropagation(); setSelectedCity(city); }}
            >
              {city}
            </span>
          ))}
          {citiesAll.length > 3 && (
            <Popover>
              <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                <span className="cursor-pointer rounded-md bg-secondary/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary transition-colors">
                  +{citiesAll.length - 3} more
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" onClick={(e) => e.stopPropagation()}>
                <p className="mb-2 text-xs font-semibold text-foreground">All service cities</p>
                <div className="flex flex-wrap gap-1.5">
                  {citiesAll.map((city) => (
                    <button
                      key={city}
                      type="button"
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs transition-colors",
                        city === selectedCity
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground hover:bg-primary/20"
                      )}
                      onClick={() => setSelectedCity(city)}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className="w-full text-xs"
            onClick={(e) => { e.stopPropagation(); onMessage(); }}
          >
            <MessageSquare className="mr-1 h-3 w-3" />
            Message
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={cn("w-full text-xs", compareSelected && "border border-primary/40 bg-primary/10 text-primary")}
            onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
            disabled={compareDisabled}
          >
            {compareSelected ? <Check className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}
            {compareSelected ? "Added" : "Compare"}
          </Button>
        </div>
        {compareDisabled && (
          <p className="text-[10px] text-muted-foreground text-center -mt-1">Max 3 companies for comparison.</p>
        )}
      </div>
    </GlassCard>
  );
}

/* ================================================================== */
/*  SupplierCard  -  with detailed price & delivery info                 */
/* ================================================================== */

function SupplierCard({
  supplier,
  compareSelected,
  compareDisabled,
  onNavigate,
  onMessage,
  onToggleCompare,
}: {
  supplier: SupplierDirectoryItem;
  compareSelected: boolean;
  compareDisabled: boolean;
  onNavigate: () => void;
  onMessage: () => void;
  onToggleCompare: () => void;
}) {
  const s = supplier;
  const priceLabel =
    s.minPrice == null || s.maxPrice == null
      ? "Contact for price"
      : s.minPrice === s.maxPrice
      ? formatPKR(s.minPrice)
      : `${formatPKR(s.minPrice)}  -  ${formatPKR(s.maxPrice)}`;

  return (
    <GlassCard
      className="group flex flex-col overflow-hidden p-0 h-full"
      role="button"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate(); } }}
    >
      {/* Banner */}
      <div className="relative h-40 shrink-0 overflow-hidden">
        {(s.dpUrl || s.logo) ? (
          <img
            src={s.dpUrl || s.logo}
            alt={s.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-emerald-900/40 to-teal-900/30 transition-transform duration-500 group-hover:scale-[1.05]" />
        )}
        {/* Verified */}
        <div className="absolute left-3 top-3">
          {s.verified ? <StatusBadge status="verified" /> : null}
        </div>
        {/* Material count */}
        <div className="absolute right-3 top-3">
          <span className="flex items-center gap-1 rounded-lg bg-background/30 backdrop-blur-sm px-2 py-1 text-[11px] font-semibold text-white">
            <Package className="h-3 w-3" />
            {s.materialCount} items
          </span>
        </div>
        {/* Name overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 pb-2.5 pt-8">
          <p className="truncate text-sm font-bold text-white leading-tight">{s.name}</p>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-white/70">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{s.city || " - "}{s.area ? `, ${s.area}` : ""}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3.5 flex-1">
        {/* Rating row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
            <span className="font-semibold text-foreground">{s.rating}</span>
            <span className="text-muted-foreground">({s.reviews} reviews)</span>
          </div>
          <span className="text-muted-foreground">{s.categories.length} categor{s.categories.length === 1 ? "y" : "ies"}</span>
        </div>

        {/* Price highlight */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-0.5">Price Range</p>
          <p className="text-sm font-bold text-foreground">{priceLabel}</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center rounded-xl border border-border bg-background/30 py-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Materials</span>
            <span className="mt-0.5 text-sm font-bold text-foreground">{s.materialCount}</span>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-border bg-background/30 py-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Categories</span>
            <span className="mt-0.5 text-sm font-bold text-foreground">{s.categories.length}</span>
          </div>
        </div>

        {/* Category badges */}
        <div className="flex flex-wrap gap-1">
          {s.categories.slice(0, 3).map((c) => (
            <Badge key={c} variant="secondary" className="rounded-lg text-[10px] px-2 py-0">{c}</Badge>
          ))}
          {s.categories.length > 3 && (
            <Badge variant="outline" className="rounded-lg text-[10px] px-2 py-0">+{s.categories.length - 3}</Badge>
          )}
        </div>

        {/* Cities served */}
        {s.citiesServed.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <MapPin className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
            {s.citiesServed.slice(0, 3).map((city) => (
              <span key={city} className="rounded-md bg-secondary/70 px-2 py-0.5 text-[10px] text-foreground">{city}</span>
            ))}
            {s.citiesServed.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{s.citiesServed.length - 3} more</span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            className="w-full text-xs"
            onClick={(e) => { e.stopPropagation(); onMessage(); }}
          >
            <MessageSquare className="mr-1 h-3 w-3" />
            Message
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={cn("w-full text-xs", compareSelected && "border border-primary/40 bg-primary/10 text-primary")}
            onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
            disabled={compareDisabled}
          >
            {compareSelected ? <Check className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}
            {compareSelected ? "Added" : "Compare"}
          </Button>
        </div>
        {compareDisabled && (
          <p className="text-[10px] text-muted-foreground text-center -mt-1">Max 3 suppliers for comparison.</p>
        )}
      </div>
    </GlassCard>
  );
}

function CompareDialog({
  companies,
  onClear,
}: {
  companies: CompanyDirectoryItem[];
  onClear: () => void;
}) {
  return (
    <DialogContent className="max-w-5xl bg-background text-foreground">
      <DialogHeader>
        <DialogTitle>Company comparison</DialogTitle>
      </DialogHeader>

      <div className="rounded-2xl border border-border bg-card p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Metric</TableHead>
              {companies.map((c) => (
                <TableHead key={c.id} className="min-w-[12rem]">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.location}</p>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <CompareRow label="Verified" values={companies.map((c) => (c.verified ? "Yes" : "No"))} />
            <CompareRow label="Match" values={companies.map((c) => `${c.matchScore}%`)} />
            <CompareRow label="Rating" values={companies.map((c) => `${c.rating} (${c.reviews})`)} />
            <CompareRow label="Price" values={companies.map((c) => c.priceRange)} />
            <CompareRow
              label="Cities"
              values={companies.map((c) => {
                const p = previewList(c.cities.length ? c.cities : [c.location], 3);
                if (!p.text) return " - ";
                return p.more ? `${p.text} (+${p.more})` : p.text;
              })}
            />
            <CompareRow
              label="Societies"
              values={companies.map((c) => {
                const p = previewList(c.societies, 3);
                if (!p.text) return " - ";
                return p.more ? `${p.text} (+${p.more})` : p.text;
              })}
            />
            <CompareRow label="Established" values={companies.map((c) => (c.yearEstablished ? `${c.yearEstablished}` : " - "))} />
            <CompareRow label="Completed" values={companies.map((c) => (c.completedProjects != null ? `${c.completedProjects}` : " - "))} />
            <CompareRow label="Specialization" values={companies.map((c) => c.specialization.join(", "))} />
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClear}>
          Clear selection
        </Button>
        <Button>Request quotes</Button>
      </div>
    </DialogContent>
  );
}

function CompareRow({ label, values }: { label: string; values: string[] }) {
  return (
    <TableRow>
      <TableCell className="text-sm font-medium text-muted-foreground">{label}</TableCell>
      {values.map((v, i) => (
        <TableCell key={i} className="text-sm text-foreground">
          {v}
        </TableCell>
      ))}
    </TableRow>
  );
}

function SupplierCompareDialog({
  suppliers,
  onClear,
}: {
  suppliers: SupplierDirectoryItem[];
  onClear: () => void;
}) {
  return (
    <DialogContent className="max-w-5xl bg-background text-foreground">
      <DialogHeader>
        <DialogTitle>Supplier comparison</DialogTitle>
      </DialogHeader>

      <div className="rounded-2xl border border-border bg-card p-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Metric</TableHead>
              {suppliers.map((s) => (
                <TableHead key={s.id} className="min-w-[12rem]">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.city}</p>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <CompareRow label="Rating" values={suppliers.map((s) => `${s.rating} (${s.reviews} reviews)`)} />
            <CompareRow label="City" values={suppliers.map((s) => s.city || " - ")} />
            <CompareRow label="Area" values={suppliers.map((s) => s.area || " - ")} />
            <CompareRow label="Cities Served" values={suppliers.map((s) => s.citiesServed.slice(0, 3).join(", ") || " - ")} />
            <CompareRow label="Materials" values={suppliers.map((s) => `${s.materialCount} items`)} />
            <CompareRow
              label="Categories"
              values={suppliers.map((s) => {
                const shown = s.categories.slice(0, 3).join(", ");
                const more = s.categories.length - 3;
                return more > 0 ? `${shown} (+${more})` : shown || " - ";
              })}
            />
            <CompareRow
              label="Price Range"
              values={suppliers.map((s) =>
                s.minPrice == null || s.maxPrice == null
                  ? " - "
                  : s.minPrice === s.maxPrice
                    ? formatPKR(s.minPrice)
                    : `${formatPKR(s.minPrice)}  -  ${formatPKR(s.maxPrice)}`
              )}
            />
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClear}>
          Clear selection
        </Button>
        <Button>Request quotes</Button>
      </div>
    </DialogContent>
  );
}

const ADMIN_PAGE_SIZE = 25;

function AdminCompaniesView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get("tab");
  const [tab, setTabRaw] = useState<"companies" | "materials">(
    paramTab === "materials" ? "materials" : "companies",
  );
  const setTab = (t: "companies" | "materials") => {
    setTabRaw(t);
    setSearchParams({ tab: t }, { replace: true });
  };

  // Sync tab when URL param changes (e.g. sidebar link)
  useEffect(() => {
    if (paramTab === "materials" && tab !== "materials") setTabRaw("materials");
    else if (paramTab !== "materials" && tab !== "companies") setTabRaw("companies");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramTab]);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Suppliers state
  const [supplierData, setSupplierData] = useState<SupplierDirectoryItem[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [adminCompanyData, setAdminCompanyData] = useState<CompanyDirectoryItem[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  useEffect(() => {
    fetchCompanyDirectory()
      .then(setAdminCompanyData)
      .catch(() => {})
      .finally(() => setCompaniesLoading(false));
    fetchSupplierDirectory()
      .then(setSupplierData)
      .catch(() => {})
      .finally(() => setSuppliersLoading(false));
  }, []);

  // Reset to page 1 when search or tab changes
  useEffect(() => { setPage(1); }, [search, tab]);

  // â”€â”€ Companies â”€â”€
  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return adminCompanyData;
    return adminCompanyData.filter((c) => {
      const cities = c.cities.length ? c.cities : [c.location];
      return (
        c.name.toLowerCase().includes(q) ||
        cities.some((x) => x.toLowerCase().includes(q)) ||
        c.specialization.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [search, adminCompanyData]);

  const totalCompanyPages = Math.max(1, Math.ceil(filteredCompanies.length / ADMIN_PAGE_SIZE));
  const pagedCompanies = filteredCompanies.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  // â”€â”€ Suppliers â”€â”€
  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return supplierData;
    return supplierData.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.categories.some((c) => c.toLowerCase().includes(q)),
    );
  }, [search, supplierData]);

  const totalSupplierPages = Math.max(1, Math.ceil(filteredSuppliers.length / ADMIN_PAGE_SIZE));
  const pagedSuppliers = filteredSuppliers.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

  const currentTotal = tab === "companies" ? filteredCompanies.length : filteredSuppliers.length;
  const currentPages = tab === "companies" ? totalCompanyPages : totalSupplierPages;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {tab === "companies" ? "Companies" : "Materials & Suppliers"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tab === "companies"
              ? `${filteredCompanies.length} construction companies in the dataset.`
              : `${filteredSuppliers.length} material suppliers registered.`}
          </p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "companies" | "materials")}>
          <TabsList>
            <TabsTrigger value="companies">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              Construction Companies
            </TabsTrigger>
            <TabsTrigger value="materials">
              <Package className="mr-1.5 h-3.5 w-3.5" />
              Materials &amp; Suppliers
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search */}
      <GlassCard interactive={false} className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "companies"
                  ? "Search by company name, city, or specialization..."
                  : "Search by supplier, city, or material category..."
              }
              className="bg-background/40 pl-9"
            />
          </div>
          <p className="shrink-0 text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {(page - 1) * ADMIN_PAGE_SIZE + 1} - 
              {Math.min(page * ADMIN_PAGE_SIZE, currentTotal)}
            </span>{" "}
            of <span className="font-semibold text-foreground">{currentTotal}</span>
          </p>
        </div>
      </GlassCard>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" /> Verified
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-warning" /> Unverified / Pending
        </span>
      </div>

      {/* Table */}
      {tab === "companies" ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Cities</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Price Range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No companies match your search.
                  </TableCell>
                </TableRow>
              ) : (
                pagedCompanies.map((c) => {
                  const cities = c.cities.length ? c.cities : [c.location];
                  const cityText = cities.slice(0, 2).join(", ") + (cities.length > 2 ? ` +${cities.length - 2}` : "");
                  const specText = c.specialization.slice(0, 2).join(", ") + (c.specialization.length > 2 ? ` +${c.specialization.length - 2}` : "");
                  return (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/companies/${c.id}`)}>
                      <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{cityText || " - "}</TableCell>
                      <TableCell className="text-muted-foreground">{specText || " - "}</TableCell>
                      <TableCell className="text-foreground">{c.rating > 0 ? c.rating : " - "}</TableCell>
                      <TableCell className="text-muted-foreground">{c.priceRange || " - "}</TableCell>
                      <TableCell>
                        {c.verified ? <StatusBadge status="verified" /> : <StatusBadge status="pending" />}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/companies/${c.id}`)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {suppliersLoading ? (
            <div className="p-10 text-center text-muted-foreground">Loading suppliers...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Materials</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Price Range</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No suppliers match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedSuppliers.map((s) => {
                    const catText = s.categories.slice(0, 2).join(", ") + (s.categories.length > 2 ? ` +${s.categories.length - 2}` : "");
                    const priceText =
                      s.minPrice == null || s.maxPrice == null
                        ? " - "
                        : s.minPrice === s.maxPrice
                          ? formatPKR(s.minPrice)
                          : `${formatPKR(s.minPrice)}  -  ${formatPKR(s.maxPrice)}`;
                    return (
                      <TableRow key={s.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/suppliers/${s.id}`)}>
                        <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.city || " - "}</TableCell>
                        <TableCell className="text-muted-foreground">{catText || " - "}</TableCell>
                        <TableCell className="text-foreground">{s.materialCount}</TableCell>
                        <TableCell className="text-foreground">{s.rating > 0 ? s.rating : " - "}</TableCell>
                        <TableCell className="text-muted-foreground">{priceText}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="secondary" onClick={() => navigate(`/suppliers/${s.id}`)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Pagination */}
      {currentPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {currentPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= currentPages} onClick={() => setPage((p) => Math.min(currentPages, p + 1))}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}