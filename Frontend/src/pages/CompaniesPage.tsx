import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

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
import { companyDirectory, getPackageKeys, humanizeToken, type CompanyDirectoryItem } from "@/data/companyData";
import { mockCompanies } from "@/data/mockData";
import { fetchSupplierDirectory, type SupplierDirectoryItem } from "@/data/supplierData";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import {
  Building2,
  Check,
  Filter,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  Star,
} from "lucide-react";

const formatPKR = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);

function previewList(items: string[], max: number) {
  const cleaned = items.filter((x) => x && x !== "—");
  const shown = cleaned.slice(0, max);
  const more = Math.max(0, cleaned.length - shown.length);
  return {
    text: shown.join(" • "),
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

  return (
    <GlassCard interactive={false} className="p-6">
      <h1 className="text-lg font-semibold text-foreground">Companies</h1>
      <p className="mt-1 text-sm text-muted-foreground">This section is available for Client and Admin roles.</p>
    </GlassCard>
  );
}

function ClientCompaniesView() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"companies" | "materials">("companies");
  const [search, setSearch] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const [materialCategories, setMaterialCategories] = useState<string[]>([]);
  const [supplierData, setSupplierData] = useState<SupplierDirectoryItem[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetchSupplierDirectory().then(setSupplierData);
  }, []);

  const locationOptions = useMemo(() => {
    const allCities = companyDirectory.flatMap((c) => (c.cities.length ? c.cities : [c.location]));
    return Array.from(new Set(allCities.filter((x) => x && x !== "—"))).sort();
  }, []);

  const specializationOptions = useMemo(() => {
    return Array.from(new Set(companyDirectory.flatMap((c) => c.specialization))).sort();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return companyDirectory.filter((c) => {
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
      const matchesSpecs =
        specializations.length === 0 ||
        c.specialization.some((s) => specializations.includes(s));

      return matchesQuery && matchesVerified && matchesLocation && matchesSpecs;
    });
  }, [search, onlyVerified, locations, specializations]);

  const materialCategoryOptions = useMemo(() => {
    return Array.from(new Set(supplierData.flatMap((s) => s.categories))).sort();
  }, [supplierData]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return supplierData.filter((s) => {
      const matchesQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.categories.some((c) => c.toLowerCase().includes(q));
      const matchesCategory =
        materialCategories.length === 0 ||
        s.categories.some((c) => materialCategories.includes(c));
      return matchesQuery && matchesCategory;
    });
  }, [supplierData, search, materialCategories]);

  const selectedCompanies = useMemo(
    () => companyDirectory.filter((c) => compareIds.includes(c.id)),
    [compareIds],
  );

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const clearCompare = () => setCompareIds([]);

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
        <p className="text-xs font-semibold tracking-wide text-muted-foreground">LOCATION</p>
        <div className="space-y-2">
          {locationOptions.map((loc) => {
            const checked = locations.includes(loc);
            return (
              <label key={loc} className="flex items-center gap-2 text-sm text-foreground">
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
        <p className="text-xs font-semibold tracking-wide text-muted-foreground">SPECIALIZATION</p>
        <div className="space-y-2">
          {specializationOptions.map((spec) => {
            const checked = specializations.includes(spec);
            return (
              <label key={spec} className="flex items-center gap-2 text-sm text-foreground">
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
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground">CATEGORIES</p>
        <div className="space-y-2">
          {materialCategoryOptions.map((cat) => {
            const checked = materialCategories.includes(cat);
            return (
              <label key={cat} className="flex items-center gap-2 text-sm text-foreground">
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Browse</h1>
          <p className="text-sm text-muted-foreground">Explore construction companies or material suppliers.</p>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v === "materials" ? "materials" : "companies")}
            className="mr-1"
          >
            <TabsList>
              <TabsTrigger value="companies">Construction Companies</TabsTrigger>
              <TabsTrigger value="materials">Materials &amp; Suppliers</TabsTrigger>
            </TabsList>
          </Tabs>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" className="sm:hidden">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent className="bg-background text-foreground">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <GlassCard interactive={false} className="p-4">
                  {tab === "companies" ? Filters : MaterialFilters}
                </GlassCard>
              </div>
            </SheetContent>
          </Sheet>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                className={cn("hidden sm:flex", (tab !== "companies" || compareIds.length === 0) && "opacity-60")}
                variant="secondary"
                disabled={tab !== "companies" || compareIds.length === 0}
              >
                <Building2 className="h-4 w-4" />
                Compare ({compareIds.length})
              </Button>
            </DialogTrigger>
            <CompareDialog companies={selectedCompanies} onClear={clearCompare} />
          </Dialog>
        </div>
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
                  ? "Search by company, city, or specialization..."
                  : "Search by supplier or material type..."
              }
              className="bg-background/40 pl-9"
            />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {tab === "companies" ? filtered.length : filteredSuppliers.length}
              </span>
            </p>
          </div>
        </div>
      </GlassCard>

      <AnimatePresence mode="wait" initial={false}>
        {tab === "companies" ? (
          <motion.div
            key="companies"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="grid gap-6 lg:grid-cols-[18rem_1fr_20rem]"
          >
            {/* Filters (desktop) */}
            <div className="hidden lg:block">
              <GlassCard interactive={false} className="sticky top-24 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Filters</p>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      setOnlyVerified(false);
                      setLocations([]);
                      setSpecializations([]);
                    }}
                  >
                    Reset
                  </Button>
                </div>
                {Filters}
              </GlassCard>
            </div>

            {/* Results */}
            <div className="space-y-4">
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                      <Skeleton className="h-40 w-full" />
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
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((company, idx) => {
                    const compareSelected = compareIds.includes(company.id);
                    const compareDisabled = !compareSelected && compareIds.length >= 3;
                    const pkgKeys = getPackageKeys(company.raw);
                    const citiesPreview = previewList(company.cities.length ? company.cities : [company.location], 2);
                    const societiesPreview = previewList(company.societies, 2);

                    return (
                      <motion.div
                        key={company.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(idx * 0.06, 0.5), duration: 0.35 }}
                      >
                      <GlassCard
                        className="group overflow-hidden p-0"
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/companies/${company.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/companies/${company.id}`);
                          }
                        }}
                      >
                        <div className="relative h-40 overflow-hidden">
                          <img
                            src={company.image}
                            alt={company.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          />
                          <div className="absolute left-3 top-3">
                            {company.verified ? <StatusBadge status="verified" /> : null}
                          </div>
                          <div className="absolute right-3 top-3">
                            <MatchScoreRing score={company.matchScore} size={48} />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/60 to-transparent" />
                        </div>

                        <div className="space-y-3 p-4">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{company.name}</p>
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{company.location}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {company.specialization.slice(0, 3).map((s) => (
                              <Badge key={s} variant="secondary" className="rounded-lg">
                                {s}
                              </Badge>
                            ))}
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Packages: <span className="text-foreground">{pkgKeys.map(humanizeToken).join(" • ")}</span>
                          </p>

                          <p className="text-xs text-muted-foreground">
                            Cities: <span className="text-foreground">{citiesPreview.text || "—"}</span>
                            {citiesPreview.more ? <span className="text-muted-foreground"> (+{citiesPreview.more})</span> : null}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            Societies: <span className="text-foreground">{societiesPreview.text || "—"}</span>
                            {societiesPreview.more ? <span className="text-muted-foreground"> (+{societiesPreview.more})</span> : null}
                          </p>

                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                              <span className="font-semibold text-foreground">{company.rating}</span>
                              <span>({company.reviews})</span>
                            </div>
                            <span className="text-muted-foreground">{company.priceRange}</span>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              className="flex-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Request quote
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className={cn("flex-1", compareSelected && "border border-primary/40")}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCompare(company.id);
                              }}
                              disabled={compareDisabled}
                            >
                              {compareSelected ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                              Compare
                            </Button>
                          </div>

                          {compareDisabled ? (
                            <p className="text-xs text-muted-foreground">Max 3 companies for comparison.</p>
                          ) : null}
                        </div>
                      </GlassCard>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {!loading && filtered.length === 0 ? (
                <GlassCard interactive={false} className="p-8 text-center">
                  <p className="text-sm font-semibold text-foreground">No companies match your filters.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try broadening location or specialization.</p>
                </GlassCard>
              ) : null}
            </div>

            {/* Compare panel (desktop) */}
            <div className="hidden lg:block">
              <GlassCard interactive={false} className="sticky top-24 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Compare</p>
                  <Button variant="link" className="h-auto p-0 text-xs" onClick={clearCompare} disabled={compareIds.length === 0}>
                    Clear
                  </Button>
                </div>

                {compareIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Select up to 3 companies to compare.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedCompanies.map((c) => (
                      <div
                        key={c.id}
                        className="cursor-pointer rounded-2xl border border-border bg-background/30 p-3"
                        onClick={() => navigate(`/companies/${c.id}`)}
                      >
                        <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{c.location}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Match</span>
                          <span className="text-xs font-semibold text-foreground">{c.matchScore}%</span>
                        </div>
                      </div>
                    ))}

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="secondary" className="w-full">
                          Compare selected ({compareIds.length})
                        </Button>
                      </DialogTrigger>
                      <CompareDialog companies={selectedCompanies} onClear={clearCompare} />
                    </Dialog>
                  </div>
                )}
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
            className="grid gap-6 lg:grid-cols-[18rem_1fr]"
          >
            {/* Filters (desktop) */}
            <div className="hidden lg:block">
              <GlassCard interactive={false} className="sticky top-24 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Filters</p>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      setMaterialCategories([]);
                    }}
                  >
                    Reset
                  </Button>
                </div>
                {MaterialFilters}
              </GlassCard>
            </div>

            {/* Results */}
            <div className="space-y-4">
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                      <Skeleton className="h-40 w-full" />
                      <div className="space-y-3 p-4">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <div className="flex gap-2">
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                        <Skeleton className="h-9 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredSuppliers.map((s) => (
                    <GlassCard
                      key={s.id}
                      className="group overflow-hidden p-0"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/suppliers/${s.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/suppliers/${s.id}`);
                        }
                      }}
                    >
                      <div className="relative flex h-40 items-end overflow-hidden bg-secondary">
                        <div className="absolute inset-0 opacity-80 gradient-bg" />
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/60 to-transparent" />

                        <div className="relative flex w-full items-start justify-between gap-3 px-4 pb-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-primary-foreground">{s.name}</p>
                            <div className="mt-1 flex items-center gap-1 text-xs text-primary-foreground/80">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{s.city || "—"}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant="secondary" className="rounded-lg bg-background/20 text-primary-foreground">
                              <Package className="h-3.5 w-3.5" />
                              {s.materialCount}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {s.categories.slice(0, 3).map((c) => (
                            <Badge key={c} variant="secondary" className="rounded-lg">
                              {c}
                            </Badge>
                          ))}
                          {s.categories.length > 3 ? (
                            <Badge variant="outline" className="rounded-lg">
                              +{s.categories.length - 3}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                            <span className="font-semibold text-foreground">{s.rating}</span>
                            <span>({s.reviews})</span>
                          </div>
                          <span className="text-muted-foreground">
                            {s.minPrice == null || s.maxPrice == null
                              ? "Pricing —"
                              : s.minPrice === s.maxPrice
                                ? formatPKR(s.minPrice)
                                : `${formatPKR(s.minPrice)} - ${formatPKR(s.maxPrice)}`}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <Button type="button" className="flex-1" onClick={(e) => e.stopPropagation()}>
                            Request quote
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/suppliers/${s.id}`);
                            }}
                          >
                            View profile
                          </Button>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}

              {!loading && filteredSuppliers.length === 0 ? (
                <GlassCard interactive={false} className="p-8 text-center">
                  <p className="text-sm font-semibold text-foreground">No suppliers match your search.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try searching by supplier name or category.</p>
                </GlassCard>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compare bar (mobile) */}
      {tab === "companies" && compareIds.length > 0 ? (
        <div className="fixed inset-x-0 bottom-4 z-40 px-4 lg:hidden">
          <GlassCard interactive={false} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="font-semibold">Compare</span>
              <span className="text-muted-foreground">({compareIds.length}/3)</span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={clearCompare}>
                <Minus className="h-4 w-4" />
                Clear
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    Compare
                  </Button>
                </DialogTrigger>
                <CompareDialog companies={selectedCompanies} onClear={clearCompare} />
              </Dialog>
            </div>
          </GlassCard>
        </div>
      ) : null}
    </div>
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
                if (!p.text) return "—";
                return p.more ? `${p.text} (+${p.more})` : p.text;
              })}
            />
            <CompareRow
              label="Societies"
              values={companies.map((c) => {
                const p = previewList(c.societies, 3);
                if (!p.text) return "—";
                return p.more ? `${p.text} (+${p.more})` : p.text;
              })}
            />
            <CompareRow label="Established" values={companies.map((c) => (c.yearEstablished ? `${c.yearEstablished}` : "—"))} />
            <CompareRow label="Completed" values={companies.map((c) => (c.completedProjects != null ? `${c.completedProjects}` : "—"))} />
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

function AdminCompaniesView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Companies</h1>
        <p className="text-sm text-muted-foreground">Review and monitor construction partners.</p>
      </div>

      <GlassCard interactive={false} className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success" /> Verified
          <span className="h-2 w-2 rounded-full bg-warning" /> Unverified
        </div>
      </GlassCard>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Specialization</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockCompanies.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.location}</TableCell>
                <TableCell className="text-muted-foreground">{c.specialization.join(", ")}</TableCell>
                <TableCell className="text-foreground">{c.rating}</TableCell>
                <TableCell>{c.verified ? <StatusBadge status="verified" /> : <StatusBadge status="pending" />}</TableCell>
                <TableCell className="text-right">
                  <Button variant={c.verified ? "secondary" : "default"}>
                    {c.verified ? "View" : "Verify"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
