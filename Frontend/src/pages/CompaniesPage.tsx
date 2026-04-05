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
    return Array.from(new Set(allCities.filter((x) => x && x !== "—"))).sort();
  }, [companyData]);

  const specializationOptions = useMemo(() => {
    return Array.from(new Set(companyData.flatMap((c) => c.specialization))).sort();
  }, [companyData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return companyData.filter((c) => {
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
  }, [search, onlyVerified, locations, specializations, companyData]);

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
      const matchesVerified = !onlyVerifiedSupplier || s.verified;
      return matchesQuery && matchesCategory && matchesVerified;
    });
  }, [supplierData, search, materialCategories, onlyVerifiedSupplier]);

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
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">Verified only</Label>
          <Checkbox checked={onlyVerifiedSupplier} onCheckedChange={(v) => setOnlyVerifiedSupplier(v === true)} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Show only verified material suppliers.</p>
      </div>

      <Separator />

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
          <p className="text-sm text-muted-foreground">
            {hideTabs && tab === "materials" ? "Browse material suppliers and vendors." : hideTabs && tab === "companies" ? "Browse construction companies." : "Explore construction companies or material suppliers."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!hideTabs && (
            <Tabs value={tab} onValueChange={(v) => setTab(v === "materials" ? "materials" : "companies")}
              className="mr-1"
            >
              <TabsList>
                <TabsTrigger value="companies">Construction Companies</TabsTrigger>
                <TabsTrigger value="materials">Materials &amp; Suppliers</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

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

          {tab === "companies" ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  className={cn("hidden sm:flex", compareIds.length === 0 && "opacity-60")}
                  variant="secondary"
                  disabled={compareIds.length === 0}
                >
                  <Building2 className="h-4 w-4" />
                  Compare ({compareIds.length})
                </Button>
              </DialogTrigger>
              <CompareDialog companies={selectedCompanies} onClear={clearCompare} />
            </Dialog>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  className={cn("hidden sm:flex", compareSupplierIds.length === 0 && "opacity-60")}
                  variant="secondary"
                  disabled={compareSupplierIds.length === 0}
                >
                  <Package className="h-4 w-4" />
                  Compare ({compareSupplierIds.length})
                </Button>
              </DialogTrigger>
              <SupplierCompareDialog suppliers={selectedSuppliers} onClear={clearSupplierCompare} />
            </Dialog>
          )}
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
              <GlassCard interactive={false} className="sticky top-24 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Filters</p>
                    {(onlyVerified || locations.length > 0 || specializations.length > 0) && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {(onlyVerified ? 1 : 0) + locations.length + specializations.length}
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

            {/* Results */}
            <div className="space-y-4 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scroll-styled pr-1">
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
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
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                  {filtered.map((company, idx) => {
                    const compareSelected = compareIds.includes(company.id);
                    const compareDisabled = !compareSelected && compareIds.length >= 3;
                    const pkgKeys = getPackageKeys(company.raw);
                    const citiesAll = company.cities.length ? company.cities : [company.location];

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
                        {/* Image banner with overlaid name/location */}
                        <div className="relative h-44 overflow-hidden">
                          <img
                            src={company.image}
                            alt={company.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          />
                          {/* Top-left: verified badge */}
                          <div className="absolute left-3 top-3">
                            {company.verified ? <StatusBadge status="verified" /> : null}
                          </div>
                          {/* Top-right: match score */}
                          <div className="absolute right-3 top-3">
                            <MatchScoreRing score={company.matchScore} size={44} />
                          </div>
                          {/* Bottom gradient + name overlay */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-3 pt-8">
                            <p className="truncate text-sm font-bold text-white leading-tight">{company.name}</p>
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-white/70">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{company.location}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 p-3.5">
                          {/* Rating + price */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs">
                              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                              <span className="font-semibold text-foreground">{company.rating}</span>
                              <span className="text-muted-foreground">({company.reviews} reviews)</span>
                            </div>
                            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">{company.priceRange}</span>
                          </div>

                          {/* Stat pills */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col items-center rounded-xl border border-border bg-background/30 py-2">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Established</span>
                              <span className="mt-0.5 text-sm font-bold text-foreground">{company.yearEstablished ?? "—"}</span>
                            </div>
                            <div className="flex flex-col items-center rounded-xl border border-border bg-background/30 py-2">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Projects</span>
                              <span className="mt-0.5 text-sm font-bold text-foreground">{company.completedProjects ?? "—"}</span>
                            </div>
                          </div>

                          {/* Specializations */}
                          <div className="flex flex-wrap gap-1">
                            {company.specialization.slice(0, 2).map((s) => (
                              <Badge key={s} variant="secondary" className="rounded-lg text-[11px] px-2 py-0">
                                {s}
                              </Badge>
                            ))}
                            {company.specialization.length > 2 && (
                              <Badge variant="outline" className="rounded-lg text-[11px] px-2 py-0">+{company.specialization.length - 2} more</Badge>
                            )}
                          </div>

                          {/* Cities chips */}
                          <div className="flex flex-wrap items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {citiesAll.slice(0, 2).map((city) => (
                              <span key={city} className="rounded-md bg-secondary/70 px-2 py-0.5 text-[11px] text-foreground">{city}</span>
                            ))}
                            {citiesAll.length > 2 && (
                              <span className="text-[11px] text-muted-foreground">+{citiesAll.length - 2}</span>
                            )}
                          </div>

                          {/* Packages row */}
                          {pkgKeys.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {pkgKeys.slice(0, 3).map((k) => (
                                <span key={k} className="rounded-md border border-border bg-background/20 px-2 py-0.5 text-[11px] text-muted-foreground">{humanizeToken(k)}</span>
                              ))}
                              {pkgKeys.length > 3 && (
                                <span className="text-[11px] text-muted-foreground">+{pkgKeys.length - 3}</span>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <Button
                              type="button"
                              size="sm"
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                const contactEmail = company.raw.contact?.email || "";
                                if (!contactEmail) return;
                                api.messages
                                  .startConversation(contactEmail, company.name, "Hi, I'm interested in your construction services.")
                                  .then(() => navigate("/messages"));
                              }}
                            >
                              <MessageSquare className="mr-1 h-3.5 w-3.5" />
                              Message
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className={cn("w-full", compareSelected && "border border-primary/40")}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCompare(company.id);
                              }}
                              disabled={compareDisabled}
                            >
                              {compareSelected ? <Check className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
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
                            <p className="text-xs text-muted-foreground">Select up to 3 companies from the list to compare side by side.</p>
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
                                  <span className="text-xs text-muted-foreground">• {c.priceRange}</span>
                                </div>
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
            className="grid gap-6 lg:grid-cols-[18rem_1fr_20rem]"
          >
            {/* Filters (desktop) */}
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
                    {(materialCategories.length > 0 || onlyVerifiedSupplier) && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                        {materialCategories.length + (onlyVerifiedSupplier ? 1 : 0)}
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

            {/* Results */}
            <div className="space-y-4 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scroll-styled pr-1">
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
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
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                  {filteredSuppliers.map((s, idx) => {
                    const supplierCompareSelected = compareSupplierIds.includes(s.id);
                    const supplierCompareDisabled = !supplierCompareSelected && compareSupplierIds.length >= 3;
                    return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.06, 0.5), duration: 0.35 }}
                    >
                    <GlassCard
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
                      {/* Image banner with overlaid name/location */}
                      <div className="relative h-44 overflow-hidden">
                        {(s.dpUrl || s.logo) ? (
                          <img
                            src={s.dpUrl || s.logo}
                            alt={s.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          />
                        ) : (
                          <div className="h-full w-full bg-secondary opacity-80 gradient-bg transition-transform duration-500 group-hover:scale-[1.05]" />
                        )}
                        {/* Top-left: verified badge */}
                        <div className="absolute left-3 top-3">
                          {s.verified ? <StatusBadge status="verified" /> : null}
                        </div>
                        {/* Top-right: material count badge */}
                        <div className="absolute right-3 top-3">
                          <Badge variant="secondary" className="rounded-lg bg-background/30 backdrop-blur-sm text-white font-semibold">
                            <Package className="h-3.5 w-3.5 mr-1" />
                            {s.materialCount}
                          </Badge>
                        </div>
                        {/* Bottom gradient + name overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 pb-3 pt-8">
                          <p className="truncate text-sm font-bold text-white leading-tight">{s.name}</p>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-white/70">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{s.city || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 p-3.5">
                        {/* Rating + price range */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-xs">
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                            <span className="font-semibold text-foreground">{s.rating}</span>
                            <span className="text-muted-foreground">({s.reviews} reviews)</span>
                          </div>
                          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                            {s.minPrice == null || s.maxPrice == null
                              ? "Pricing —"
                              : s.minPrice === s.maxPrice
                                ? formatPKR(s.minPrice)
                                : `${formatPKR(s.minPrice)} - ${formatPKR(s.maxPrice)}`}
                          </span>
                        </div>

                        {/* Stat pills */}
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
                          {s.categories.slice(0, 2).map((c) => (
                            <Badge key={c} variant="secondary" className="rounded-lg text-[11px] px-2 py-0">
                              {c}
                            </Badge>
                          ))}
                          {s.categories.length > 2 ? (
                            <Badge variant="outline" className="rounded-lg text-[11px] px-2 py-0">
                              +{s.categories.length - 2} more
                            </Badge>
                          ) : null}
                        </div>

                        {/* Cities served chips */}
                        {s.citiesServed.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {s.citiesServed.slice(0, 2).map((city) => (
                              <span key={city} className="rounded-md bg-secondary/70 px-2 py-0.5 text-[11px] text-foreground">{city}</span>
                            ))}
                            {s.citiesServed.length > 2 && (
                              <span className="text-[11px] text-muted-foreground">+{s.citiesServed.length - 2}</span>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <Button type="button" size="sm" className="w-full" onClick={(e) => {
                            e.stopPropagation();
                            const contactEmail = s.contact?.email || "";
                            if (!contactEmail) return;
                            api.messages
                              .startConversation(contactEmail, s.name, "Hi, I'm interested in your materials/products.")
                              .then(() => navigate("/messages"));
                          }}>
                            <MessageSquare className="mr-1 h-3.5 w-3.5" />
                            Message
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className={cn("w-full", supplierCompareSelected && "border border-primary/40")}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSupplierCompare(s.id);
                            }}
                            disabled={supplierCompareDisabled}
                          >
                            {supplierCompareSelected ? <Check className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
                            Compare
                          </Button>
                        </div>

                        {supplierCompareDisabled ? (
                          <p className="text-xs text-muted-foreground">Max 3 suppliers for comparison.</p>
                        ) : null}
                      </div>
                    </GlassCard>
                    </motion.div>
                    );
                  })}
                </div>
              )}

              {!loading && filteredSuppliers.length === 0 ? (
                <GlassCard interactive={false} className="p-8 text-center">
                  <p className="text-sm font-semibold text-foreground">No suppliers match your search.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try searching by supplier name or category.</p>
                </GlassCard>
              ) : null}
            </div>

            {/* Supplier compare panel (desktop) */}
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
                            <p className="text-xs text-muted-foreground">Select up to 3 suppliers from the list to compare side by side.</p>
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
                                  <span className="text-xs text-muted-foreground">• {s.categories[0] ?? "—"}</span>
                                </div>
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

      {/* Compare bar (mobile) – companies */}
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

      {/* Compare bar (mobile) – suppliers */}
      {tab === "materials" && compareSupplierIds.length > 0 ? (
        <div className="fixed inset-x-0 bottom-4 z-40 px-4 lg:hidden">
          <GlassCard interactive={false} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-semibold">Compare</span>
              <span className="text-muted-foreground">({compareSupplierIds.length}/3)</span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={clearSupplierCompare}>
                <Minus className="h-4 w-4" />
                Clear
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    Compare
                  </Button>
                </DialogTrigger>
                <SupplierCompareDialog suppliers={selectedSuppliers} onClear={clearSupplierCompare} />
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
            <CompareRow label="City" values={suppliers.map((s) => s.city || "—")} />
            <CompareRow label="Area" values={suppliers.map((s) => s.area || "—")} />
            <CompareRow label="Cities Served" values={suppliers.map((s) => s.citiesServed.slice(0, 3).join(", ") || "—")} />
            <CompareRow label="Materials" values={suppliers.map((s) => `${s.materialCount} items`)} />
            <CompareRow
              label="Categories"
              values={suppliers.map((s) => {
                const shown = s.categories.slice(0, 3).join(", ");
                const more = s.categories.length - 3;
                return more > 0 ? `${shown} (+${more})` : shown || "—";
              })}
            />
            <CompareRow
              label="Price Range"
              values={suppliers.map((s) =>
                s.minPrice == null || s.maxPrice == null
                  ? "—"
                  : s.minPrice === s.maxPrice
                    ? formatPKR(s.minPrice)
                    : `${formatPKR(s.minPrice)} – ${formatPKR(s.maxPrice)}`
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

  // ── Companies ──
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

  // ── Suppliers ──
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
                  ? "Search by company name, city, or specialization…"
                  : "Search by supplier, city, or material category…"
              }
              className="bg-background/40 pl-9"
            />
          </div>
          <p className="shrink-0 text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {(page - 1) * ADMIN_PAGE_SIZE + 1}–
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
                      <TableCell className="text-muted-foreground">{cityText || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{specText || "—"}</TableCell>
                      <TableCell className="text-foreground">{c.rating > 0 ? c.rating : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{c.priceRange || "—"}</TableCell>
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
            <div className="p-10 text-center text-muted-foreground">Loading suppliers…</div>
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
                        ? "—"
                        : s.minPrice === s.maxPrice
                          ? formatPKR(s.minPrice)
                          : `${formatPKR(s.minPrice)} – ${formatPKR(s.maxPrice)}`;
                    return (
                      <TableRow key={s.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/suppliers/${s.id}`)}>
                        <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.city || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{catText || "—"}</TableCell>
                        <TableCell className="text-foreground">{s.materialCount}</TableCell>
                        <TableCell className="text-foreground">{s.rating > 0 ? s.rating : "—"}</TableCell>
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
