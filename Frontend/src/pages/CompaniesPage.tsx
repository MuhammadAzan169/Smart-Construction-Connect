import { useEffect, useMemo, useState } from "react";

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
import { mockCompanies } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import {
  Building2,
  Check,
  Filter,
  MapPin,
  Minus,
  Plus,
  Search,
  Star,
} from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, []);

  const locationOptions = useMemo(() => {
    return Array.from(new Set(mockCompanies.map((c) => c.location))).sort();
  }, []);

  const specializationOptions = useMemo(() => {
    return Array.from(new Set(mockCompanies.flatMap((c) => c.specialization))).sort();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return mockCompanies.filter((c) => {
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.specialization.some((s) => s.toLowerCase().includes(q));

      const matchesVerified = !onlyVerified || c.verified;
      const matchesLocation = locations.length === 0 || locations.includes(c.location);
      const matchesSpecs =
        specializations.length === 0 ||
        c.specialization.some((s) => specializations.includes(s));

      return matchesQuery && matchesVerified && matchesLocation && matchesSpecs;
    });
  }, [search, onlyVerified, locations, specializations]);

  const selectedCompanies = useMemo(
    () => mockCompanies.filter((c) => compareIds.includes(c.id)),
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Browse companies</h1>
          <p className="text-sm text-muted-foreground">Industrial-grade partners, verified and comparable.</p>
        </div>

        <div className="flex items-center gap-2">
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
                  {Filters}
                </GlassCard>
              </div>
            </SheetContent>
          </Sheet>

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
              placeholder="Search by company, city, or specialization..."
              className="bg-background/40 pl-9"
            />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filtered.length}</span>
            </p>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr_20rem]">
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
              {filtered.map((company) => {
                const compareSelected = compareIds.includes(company.id);
                const compareDisabled = !compareSelected && compareIds.length >= 3;

                return (
                  <GlassCard key={company.id} className="group overflow-hidden p-0">
                    <div className="relative h-40 overflow-hidden">
                      <img
                        src={company.image}
                        alt={company.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
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

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                          <span className="font-semibold text-foreground">{company.rating}</span>
                          <span>({company.reviews})</span>
                        </div>
                        <span className="text-muted-foreground">{company.priceRange}</span>
                      </div>

                      <div className="flex gap-2">
                        <Button className="flex-1">Request quote</Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className={cn("flex-1", compareSelected && "border border-primary/40")}
                          onClick={() => toggleCompare(company.id)}
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
                  <div key={c.id} className="rounded-2xl border border-border bg-background/30 p-3">
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
      </div>

      {/* Compare bar (mobile) */}
      {compareIds.length > 0 ? (
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
  companies: typeof mockCompanies;
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
            <CompareRow label="Established" values={companies.map((c) => `${c.yearEstablished}`)} />
            <CompareRow label="Completed" values={companies.map((c) => `${c.completedProjects}`)} />
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
