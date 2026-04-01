import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Check, Plus, RotateCcw, Save } from "lucide-react";

type Plan = {
  name: string;
  price: string;
  description: string;
  highlights?: string;
  features: string[];
  tone: "base" | "primary" | "premium";
  cta: string;
};

const plans: Plan[] = [
  {
    name: "Basic",
    price: "Free",
    description: "Explore companies and submit your first request.",
    features: ["Browse verified companies", "Request management", "Standard support"],
    tone: "base",
    cta: "Get started",
  },
  {
    name: "Pro",
    price: "PKR 4,999/mo",
    description: "For active projects and faster vendor matching.",
    features: ["Unlimited requests", "Priority matching", "AI assistant access"],
    tone: "primary",
    cta: "Choose Pro",
  },
  {
    name: "Premium",
    price: "PKR 12,999/mo",
    description: "Gold-tier control, visibility, and analytics.",
    highlights: "Premium",
    features: ["Premium supplier visibility", "Advanced analytics", "Priority support"],
    tone: "premium",
    cta: "Go Premium",
  },
];

function PlanCard({ plan }: { plan: Plan }) {
  const premium = plan.tone === "premium";

  return (
    <GlassCard
      className={cn(
        "p-6",
        premium && "ring-1 ring-premium/30 bg-premium/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{plan.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
        </div>
        {plan.highlights ? (
          <Badge
            variant={premium ? "outline" : "secondary"}
            className={cn(
              "rounded-lg",
              premium && "border-premium/30 text-premium"
            )}
          >
            {plan.highlights}
          </Badge>
        ) : null}
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
        <Button
          className={cn(
            "w-full",
            premium && "bg-premium text-premium-foreground hover:bg-premium/90"
          )}
          variant={plan.tone === "base" ? "secondary" : "default"}
        >
          {plan.cta}
        </Button>
      </div>
    </GlassCard>
  );
}

type PackageKey = "standard" | "premium" | "executive";

const packageLabels: Record<PackageKey, string> = {
  standard: "Standard",
  premium: "Premium",
  executive: "Executive",
};

type CostRange = {
  min: number | null;
  max: number | null;
};

type PricingRow = {
  id: string;
  plotSizeLabel: string;
  costs: Record<PackageKey, CostRange>;
  removable?: boolean;
};

function defaultRows(): PricingRow[] {
  const mk = (id: string, label: string): PricingRow => ({
    id,
    plotSizeLabel: label,
    costs: {
      standard: { min: null, max: null },
      premium: { min: null, max: null },
      executive: { min: null, max: null },
    },
  });

  return [
    mk("3-marla", "3 Marla"),
    mk("5-marla", "5 Marla"),
    mk("10-marla", "10 Marla"),
    mk("1-kanal", "1 Kanal (20 Marla)"),
    mk("2-kanal", "2 Kanal (40 Marla)"),
  ];
}

function clampCost(n: number) {
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (Number.isNaN(n)) return null;
  return clampCost(n);
}

function storageKey(email: string) {
  return `scc_company_pricing_v1:${email}`;
}

function normalizeMaybeNumber(value: unknown): number | null {
  if (typeof value === "number") return clampCost(value);
  if (typeof value === "string") return parseOptionalNumber(value);
  return null;
}

function safeLoadCompanyPricing(email: string): PricingRow[] | null {
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;

    const rows: PricingRow[] = parsed
      .map((r, idx) => {
        if (!r || typeof r !== "object") return null;
        const obj = r as any;
        const id = typeof obj.id === "string" ? obj.id : `row-${idx}`;
        const plotSizeLabel = typeof obj.plotSizeLabel === "string" ? obj.plotSizeLabel : `Plot ${idx + 1}`;
        const costsRaw = obj.costs && typeof obj.costs === "object" ? obj.costs : {};

        const normalizePkg = (pkg: PackageKey): CostRange => {
          const pkgRaw = (costsRaw as any)[pkg] && typeof (costsRaw as any)[pkg] === "object" ? (costsRaw as any)[pkg] : {};
          return {
            min: normalizeMaybeNumber(pkgRaw.min),
            max: normalizeMaybeNumber(pkgRaw.max),
          };
        };

        return {
          id,
          plotSizeLabel,
          removable: !!obj.removable,
          costs: {
            standard: normalizePkg("standard"),
            premium: normalizePkg("premium"),
            executive: normalizePkg("executive"),
          },
        } satisfies PricingRow;
      })
      .filter(Boolean) as PricingRow[];

    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

function safeSaveCompanyPricing(email: string, rows: PricingRow[]) {
  localStorage.setItem(storageKey(email), JSON.stringify(rows));
}

function CompanyPricingEditor({ email }: { email: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<PricingRow[]>(() => safeLoadCompanyPricing(email) ?? defaultRows());
  const [newPlotSize, setNewPlotSize] = useState("");
  const [activePackage, setActivePackage] = useState<PackageKey>("standard");

  useEffect(() => {
    // Reload if account changes
    setRows(safeLoadCompanyPricing(email) ?? defaultRows());
  }, [email]);

  const pkgKeys = useMemo(() => Object.keys(packageLabels) as PackageKey[], []);

  const updateCell = (rowId: string, pkg: PackageKey, field: keyof CostRange, next: number | null) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          costs: {
            ...r.costs,
            [pkg]: {
              ...r.costs[pkg],
              [field]: next,
            },
          },
        };
      }),
    );
  };

  const addPlotSize = () => {
    const label = newPlotSize.trim();
    if (!label) return;

    const id = label
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40);

    setRows((prev) => {
      if (prev.some((r) => r.id === id || r.plotSizeLabel.toLowerCase() === label.toLowerCase())) return prev;
      return [
        ...prev,
        {
          id: `${id}-${Date.now()}`,
          plotSizeLabel: label,
          removable: true,
          costs: {
            standard: { min: null, max: null },
            premium: { min: null, max: null },
            executive: { min: null, max: null },
          },
        },
      ];
    });
    setNewPlotSize("");
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const hasInvalidRanges = useMemo(() => {
    return rows.some((r) =>
      (Object.keys(packageLabels) as PackageKey[]).some((pkg) => {
        const { min, max } = r.costs[pkg];
        return min != null && max != null && min > max;
      }),
    );
  }, [rows]);

  const reset = () => {
    setRows(defaultRows());
    toast({ title: "Reset", description: "Reverted to default plot sizes." });
  };

  const save = () => {
    if (hasInvalidRanges) {
      toast({
        variant: "destructive",
        title: "Fix pricing ranges",
        description: "Some rows have Min greater than Max. Please correct them before saving.",
      });
      return;
    }
    safeSaveCompanyPricing(email, rows);
    toast({ title: "Saved", description: "Your pricing changes were saved locally." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Packages & Pricing</h1>
          <p className="text-sm text-muted-foreground">Update your package pricing. Clients will see these ranges when matching.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button type="button" onClick={save}>
            <Save className="h-4 w-4" />
            Save changes
          </Button>
        </div>
      </div>

      <GlassCard interactive={false} className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Estimated Total Cost Range (PKR)</p>
            <p className="text-xs text-muted-foreground">Select a package tab, then set min/max per plot size.</p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Input
              value={newPlotSize}
              onChange={(e) => setNewPlotSize(e.target.value)}
              placeholder="Add plot size (e.g., 12 Marla)"
              className="bg-background/40"
            />
            <Button type="button" variant="secondary" onClick={addPlotSize} disabled={!newPlotSize.trim()}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>

        <Tabs value={activePackage} onValueChange={(v) => setActivePackage(v as PackageKey)} className="mt-4">
          <TabsList>
            {pkgKeys.map((k) => (
              <TabsTrigger key={k} value={k}>
                {packageLabels[k]}
              </TabsTrigger>
            ))}
          </TabsList>

          {pkgKeys.map((pkg) => (
            <TabsContent key={pkg} value={pkg} className="mt-4">
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">Plot size</TableHead>
                      <TableHead className="min-w-[14rem]">Min (PKR)</TableHead>
                      <TableHead className="min-w-[14rem]">Max (PKR)</TableHead>
                      <TableHead className="w-20 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const cell = r.costs[pkg];
                      const invalid = cell.min != null && cell.max != null && cell.min > cell.max;
                      const inputClass = cn(
                        "bg-background/40",
                        invalid && "border-destructive/60 focus-visible:ring-destructive/40",
                      );
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-foreground">{r.plotSizeLabel}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={50000}
                              value={cell.min ?? ""}
                              onChange={(e) => updateCell(r.id, pkg, "min", parseOptionalNumber(e.target.value))}
                              className={inputClass}
                              placeholder="Min"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={50000}
                              value={cell.max ?? ""}
                              onChange={(e) => updateCell(r.id, pkg, "max", parseOptionalNumber(e.target.value))}
                              className={inputClass}
                              placeholder="Max"
                            />
                            {invalid ? (
                              <p className="mt-1 text-xs text-destructive">Min must be ≤ Max.</p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.removable ? (
                              <Button
                                type="button"
                                variant="link"
                                className="h-auto p-0 text-xs"
                                onClick={() => removeRow(r.id)}
                              >
                                Remove
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
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
    </div>
  );
}

export default function PricingPage() {
  const user = useAuthStore((s) => s.user);

  if (user?.role === "company") {
    return <CompanyPricingEditor email={user.email} />;
  }

  if (user?.role === "supplier") {
    return (
      <GlassCard interactive={false} className="p-6">
        <h1 className="text-lg font-semibold text-foreground">Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update material prices from Inventory.</p>
        <div className="mt-4">
          <Button asChild>
            <Link to="/products">Go to Inventory</Link>
          </Button>
        </div>
      </GlassCard>
    );
  }

  // Client (and admin fallback): subscription tiers
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pricing</h1>
        <p className="text-sm text-muted-foreground">Three tiers designed for real construction workflows.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard key={p.name} plan={p} />
        ))}
      </div>
    </div>
  );
}
