import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  companyDataset,
  getCompanyByEmail,
  getPackageKeys,
  getPaymentTermOptions,
  getScopeValueOptions,
  humanizeToken,
  type CompanyDatasetCompany,
} from "@/data/companyData";
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

type PackageScopeFields = {
  design_included?: boolean;
  fixtures?: string;
  ceiling?: string;
  kitchen?: string;
  bathroom?: string;
};

type PackageDef = {
  id: string;
  label: string;
};

type CostRange = {
  min: number | null;
  max: number | null;
};

type PricingRow = {
  id: string;
  plotSizeLabel: string;
  costs: Record<string, CostRange>;
  removable?: boolean;
};

function defaultRows(packageIds: string[]): PricingRow[] {
  const mk = (id: string, label: string): PricingRow => {
    const costs: Record<string, CostRange> = {};
    for (const pkgId of packageIds) {
      costs[pkgId] = { min: null, max: null };
    }

    return {
      id,
      plotSizeLabel: label,
      costs,
    };
  };

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

function storageKeyV1(email: string) {
  return `scc_company_pricing_v1:${email}`;
}

function storageKeyV2(companyKey: string) {
  return `scc_company_pricing_v2:${companyKey}`;
}

function settingsStorageKey(companyKey: string) {
  return `scc_company_settings_v1:${companyKey}`;
}

function normalizeMaybeNumber(value: unknown): number | null {
  if (typeof value === "number") return clampCost(value);
  if (typeof value === "string") return parseOptionalNumber(value);
  return null;
}

function safeLoadCompanyPricingV1(email: string): PricingRow[] | null {
  try {
    const raw = localStorage.getItem(storageKeyV1(email));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;

    const rows: PricingRow[] = parsed
      .map((r, idx) => {
        if (!r || typeof r !== "object") return null;
        const obj = r as Record<string, unknown>;
        const id = typeof obj.id === "string" ? obj.id : `row-${idx}`;
        const plotSizeLabel = typeof obj.plotSizeLabel === "string" ? obj.plotSizeLabel : `Plot ${idx + 1}`;
        const costsRaw = obj.costs && typeof obj.costs === "object" ? (obj.costs as Record<string, unknown>) : {};

        const normalizePkg = (pkg: string): CostRange => {
          const pkgCandidate = costsRaw[pkg];
          const pkgRaw = pkgCandidate && typeof pkgCandidate === "object" ? (pkgCandidate as Record<string, unknown>) : {};
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

type CompanyPricingState = {
  packages: PackageDef[];
  rows: PricingRow[];
  packageScope: Record<string, PackageScopeFields>;
};

function slugifyPackageId(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30);
}

function normalizePricingState(state: CompanyPricingState, fallbackActive?: string): CompanyPricingState {
  const packages = state.packages.filter((p) => p && typeof p.id === "string" && typeof p.label === "string");
  const uniqueIds = new Set<string>();
  const deduped: PackageDef[] = [];
  for (const p of packages) {
    if (uniqueIds.has(p.id)) continue;
    uniqueIds.add(p.id);
    deduped.push(p);
  }

  const packageIds = deduped.map((p) => p.id);
  const rows: PricingRow[] = (state.rows ?? []).map((r, idx) => {
    const id = typeof r?.id === "string" ? r.id : `row-${idx}`;
    const plotSizeLabel = typeof r?.plotSizeLabel === "string" ? r.plotSizeLabel : `Plot ${idx + 1}`;
    const costsRaw: Record<string, unknown> = r?.costs && typeof r.costs === "object" ? (r.costs as unknown as Record<string, unknown>) : {};
    const costs: Record<string, CostRange> = {};
    for (const pkgId of packageIds) {
      const cellCandidate = costsRaw[pkgId];
      const cell = cellCandidate && typeof cellCandidate === "object" ? (cellCandidate as Record<string, unknown>) : {};
      costs[pkgId] = {
        min: normalizeMaybeNumber(cell.min),
        max: normalizeMaybeNumber(cell.max),
      };
    }

    const removableValue = (r as unknown as Record<string, unknown>).removable;
    return {
      id,
      plotSizeLabel,
      removable: typeof removableValue === "boolean" ? removableValue : Boolean(removableValue),
      costs,
    };
  });

  const packageScopeRaw: Record<string, unknown> =
    state.packageScope && typeof state.packageScope === "object" ? (state.packageScope as unknown as Record<string, unknown>) : {};
  const packageScope: Record<string, PackageScopeFields> = {};
  for (const pkgId of packageIds) {
    const vCandidate = packageScopeRaw[pkgId];
    const v = vCandidate && typeof vCandidate === "object" ? (vCandidate as Record<string, unknown>) : {};
    packageScope[pkgId] = {
      design_included: typeof v.design_included === "boolean" ? v.design_included : undefined,
      fixtures: typeof v.fixtures === "string" ? v.fixtures : "",
      ceiling: typeof v.ceiling === "string" ? v.ceiling : "",
      kitchen: typeof v.kitchen === "string" ? v.kitchen : "",
      bathroom: typeof v.bathroom === "string" ? v.bathroom : "",
    };
  }

  if (deduped.length === 0) {
    const base = fallbackActive ? [{ id: fallbackActive, label: humanizeToken(fallbackActive) }] : [{ id: "standard", label: "Standard" }];
    return normalizePricingState({ packages: base, rows: rows.length ? rows : defaultRows(base.map((p) => p.id)), packageScope }, base[0].id);
  }

  return {
    packages: deduped,
    rows: rows.length ? rows : defaultRows(packageIds),
    packageScope,
  };
}

function safeLoadCompanyPricingState(companyKey: string, email: string, defaults: CompanyPricingState): CompanyPricingState {
  try {
    const raw = localStorage.getItem(storageKeyV2(companyKey));
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        const packagesRaw = obj.packages;
        const rowsRaw = obj.rows;
        const packageScopeRaw = obj.packageScope;
        return normalizePricingState(
          {
            packages: Array.isArray(packagesRaw) ? (packagesRaw as unknown as PackageDef[]) : defaults.packages,
            rows: Array.isArray(rowsRaw) ? (rowsRaw as unknown as PricingRow[]) : defaults.rows,
            packageScope:
              packageScopeRaw && typeof packageScopeRaw === "object"
                ? (packageScopeRaw as unknown as Record<string, PackageScopeFields>)
                : defaults.packageScope,
          },
          defaults.packages[0]?.id,
        );
      }
    }

    // Migrate legacy v1 rows if present.
    const legacy = safeLoadCompanyPricingV1(email);
    if (legacy) {
      const packages: PackageDef[] = [
        { id: "standard", label: "Standard" },
        { id: "premium", label: "Premium" },
        { id: "executive", label: "Executive" },
      ];

      const migrated: CompanyPricingState = {
        packages,
        rows: legacy,
        packageScope: defaults.packageScope,
      };

      const normalized = normalizePricingState(migrated, "standard");
      localStorage.setItem(storageKeyV2(companyKey), JSON.stringify(normalized));
      return normalized;
    }

    return defaults;
  } catch {
    return defaults;
  }
}

function safeSaveCompanyPricingState(companyKey: string, state: CompanyPricingState) {
  localStorage.setItem(storageKeyV2(companyKey), JSON.stringify(state));
}

type CompanySettings = {
  company_name: string;
  description: string;
  contact: {
    phone: string;
    email: string;
    website: string;
  };
  legal_info: {
    registered: boolean;
    secp_registered: boolean;
    ntn: string;
    year_established: number | null;
  };
  payment_terms: {
    advance_percentage: number | null;
    installments: string;
    price_type: string;
    variation_clause: boolean;
  };
  profile_settings: {
    public_profile: boolean;
    show_contact: boolean;
  };
};

function safeLoadCompanySettings(companyKey: string, defaults: CompanySettings): CompanySettings {
  try {
    const raw = localStorage.getItem(settingsStorageKey(companyKey));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaults;
    const obj = parsed as Record<string, unknown>;

    const str = (v: unknown, fb: string) => (typeof v === "string" ? v : fb);
    const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);
    const numOrNull = (v: unknown, fb: number | null) => {
      if (v == null) return fb;
      if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
      if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? Math.round(n) : fb;
      }
      return fb;
    };

    const contact = obj.contact && typeof obj.contact === "object" ? (obj.contact as Record<string, unknown>) : {};
    const legalInfo = obj.legal_info && typeof obj.legal_info === "object" ? (obj.legal_info as Record<string, unknown>) : {};
    const paymentTerms = obj.payment_terms && typeof obj.payment_terms === "object" ? (obj.payment_terms as Record<string, unknown>) : {};
    const profileSettings =
      obj.profile_settings && typeof obj.profile_settings === "object" ? (obj.profile_settings as Record<string, unknown>) : {};

    return {
      company_name: str(obj.company_name, defaults.company_name),
      description: str(obj.description, defaults.description),
      contact: {
        phone: str(contact.phone, defaults.contact.phone),
        email: str(contact.email, defaults.contact.email),
        website: str(contact.website, defaults.contact.website),
      },
      legal_info: {
        registered: bool(legalInfo.registered, defaults.legal_info.registered),
        secp_registered: bool(legalInfo.secp_registered, defaults.legal_info.secp_registered),
        ntn: str(legalInfo.ntn, defaults.legal_info.ntn),
        year_established: numOrNull(legalInfo.year_established, defaults.legal_info.year_established),
      },
      payment_terms: {
        advance_percentage: numOrNull(paymentTerms.advance_percentage, defaults.payment_terms.advance_percentage),
        installments: str(paymentTerms.installments, defaults.payment_terms.installments),
        price_type: str(paymentTerms.price_type, defaults.payment_terms.price_type),
        variation_clause: bool(paymentTerms.variation_clause, defaults.payment_terms.variation_clause),
      },
      profile_settings: {
        public_profile: bool(profileSettings.public_profile, defaults.profile_settings.public_profile),
        show_contact: bool(profileSettings.show_contact, defaults.profile_settings.show_contact),
      },
    };
  } catch {
    return defaults;
  }
}

function safeSaveCompanySettings(companyKey: string, settings: CompanySettings) {
  localStorage.setItem(settingsStorageKey(companyKey), JSON.stringify(settings));
}

function parsePkrRangeString(raw: string | undefined): CostRange {
  if (!raw || typeof raw !== "string") return { min: null, max: null };
  const s = raw.toLowerCase().replace(/,/g, " ").replace(/pkr\/?sq\s*ft/g, " ").trim();
  const plus = s.includes("+");
  const parts = s.split(/\bto\b|-|–/g).map((x) => x.trim()).filter(Boolean);

  const parseOne = (token: string): number | null => {
    const m = token.match(/(\d+(?:\.\d+)?)(\s*(m|million|k|thousand))?/);
    if (!m) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return null;
    const unit = (m[3] ?? "").toLowerCase();
    if (unit === "m" || unit === "million") return Math.round(n * 1_000_000);
    if (unit === "k" || unit === "thousand") return Math.round(n * 1_000);
    // Heuristic: values like 3.4 without unit likely mean millions in this dataset.
    if (n > 0 && n < 1000 && token.includes("m")) return Math.round(n * 1_000_000);
    return Math.round(n);
  };

  if (parts.length === 0) return { min: null, max: null };
  if (parts.length === 1) {
    const one = parseOne(parts[0]);
    return plus ? { min: one, max: null } : { min: one, max: one };
  }
  const a = parseOne(parts[0]);
  const b = parseOne(parts[1]);
  return { min: a, max: b };
}

function defaultPackagesFromCompany(company: CompanyDatasetCompany | null): PackageDef[] {
  const keys = company ? getPackageKeys(company) : ["standard", "premium", "executive"];
  const labelOf = (k: string) => {
    if (k === "standard") return "Standard";
    if (k === "premium") return "Premium";
    if (k === "executive") return "Executive";
    return humanizeToken(k);
  };
  return keys.map((k) => ({ id: k, label: labelOf(k) }));
}

function defaultScopeFromCompany(company: CompanyDatasetCompany | null, packages: PackageDef[]): Record<string, PackageScopeFields> {
  const base: Record<string, PackageScopeFields> = company?.package_scope ?? {};
  const out: Record<string, PackageScopeFields> = {};
  for (const p of packages) {
    const src = base[p.id] ?? ({} as PackageScopeFields);
    out[p.id] = {
      design_included: typeof src.design_included === "boolean" ? src.design_included : false,
      fixtures: typeof src.fixtures === "string" ? src.fixtures : "",
      ceiling: typeof src.ceiling === "string" ? src.ceiling : "",
      kitchen: typeof src.kitchen === "string" ? src.kitchen : "",
      bathroom: typeof src.bathroom === "string" ? src.bathroom : "",
    };
  }
  return out;
}

function labelFromPlotKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function defaultRowsFromCompany(company: CompanyDatasetCompany | null, packageIds: string[]): PricingRow[] {
  const ranges = company?.estimated_total_cost_range;
  if (!ranges || typeof ranges !== "object") return defaultRows(packageIds);

  const keys = Object.keys(ranges);
  if (!keys.length) return defaultRows(packageIds);

  return keys.map((plotKey) => {
    const row: PricingRow = {
      id: plotKey,
      plotSizeLabel: labelFromPlotKey(plotKey),
      removable: false,
      costs: {},
    };

    const perPkg = ranges[plotKey] ?? {};
    for (const pkgId of packageIds) {
      row.costs[pkgId] = parsePkrRangeString(perPkg[pkgId]);
    }
    return row;
  });
}

function defaultCompanySettings(company: CompanyDatasetCompany | null, email: string): CompanySettings {
  return {
    company_name: company?.company_name ?? "",
    description: "",
    contact: {
      phone: company?.contact?.phone ?? "",
      email: company?.contact?.email ?? email,
      website: company?.contact?.website ?? "",
    },
    legal_info: {
      registered: Boolean(company?.legal_info?.registered),
      secp_registered: Boolean(company?.legal_info?.secp_registered),
      ntn: company?.legal_info?.ntn ?? "",
      year_established: typeof company?.legal_info?.year_established === "number" ? company!.legal_info!.year_established! : null,
    },
    payment_terms: {
      advance_percentage: typeof company?.payment_terms?.advance_percentage === "number" ? company!.payment_terms!.advance_percentage! : null,
      installments: company?.payment_terms?.installments ?? "",
      price_type: company?.payment_terms?.price_type ?? "",
      variation_clause: Boolean(company?.payment_terms?.variation_clause),
    },
    profile_settings: {
      public_profile: true,
      show_contact: true,
    },
  };
}

const scopeOptions = getScopeValueOptions(companyDataset);
const paymentOptions = getPaymentTermOptions(companyDataset);

function CompanyPricingEditor({ email }: { email: string }) {
  const { toast } = useToast();
  const company = useMemo(() => getCompanyByEmail(email) ?? null, [email]);
  const companyKey = company?.company_id ?? email;

  const packagesDefault = useMemo(() => defaultPackagesFromCompany(company), [company]);
  const packageIdsDefault = useMemo(() => packagesDefault.map((p) => p.id), [packagesDefault]);
  const defaults = useMemo<CompanyPricingState>(() => {
    const packageScope = defaultScopeFromCompany(company, packagesDefault);
    const rows = defaultRowsFromCompany(company, packageIdsDefault);
    return normalizePricingState({ packages: packagesDefault, rows, packageScope }, packagesDefault[0]?.id);
  }, [company, packagesDefault, packageIdsDefault]);

  const [pricing, setPricing] = useState<CompanyPricingState>(() => safeLoadCompanyPricingState(companyKey, email, defaults));
  const [settings, setSettings] = useState<CompanySettings>(() => safeLoadCompanySettings(companyKey, defaultCompanySettings(company, email)));
  const [newPlotSize, setNewPlotSize] = useState("");
  const [activePackage, setActivePackage] = useState<string>(() => pricing.packages[0]?.id ?? "standard");
  const [newPackageLabel, setNewPackageLabel] = useState("");
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [editingPackageLabel, setEditingPackageLabel] = useState("");

  useEffect(() => {
    // Reload if account changes
    const nextDefaults = normalizePricingState(
      {
        packages: defaultPackagesFromCompany(company),
        rows: defaultRowsFromCompany(company, defaultPackagesFromCompany(company).map((p) => p.id)),
        packageScope: defaultScopeFromCompany(company, defaultPackagesFromCompany(company)),
      },
      "standard",
    );
    setPricing(safeLoadCompanyPricingState(companyKey, email, nextDefaults));
    setSettings(safeLoadCompanySettings(companyKey, defaultCompanySettings(company, email)));
  }, [companyKey, email, company]);

  useEffect(() => {
    // Keep active package valid.
    if (!pricing.packages.some((p) => p.id === activePackage)) {
      setActivePackage(pricing.packages[0]?.id ?? "standard");
    }
  }, [pricing.packages, activePackage]);

  const updateCell = (rowId: string, pkgId: string, field: keyof CostRange, next: number | null) => {
    setPricing((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          costs: {
            ...r.costs,
            [pkgId]: {
              ...r.costs[pkgId],
              [field]: next,
            },
          },
        };
      }),
    }));
  };

  const addPlotSize = () => {
    const label = newPlotSize.trim();
    if (!label) return;

    const id = label
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 40);

    setPricing((prev) => {
      if (prev.rows.some((r) => r.id === id || r.plotSizeLabel.toLowerCase() === label.toLowerCase())) return prev;
      const costs: Record<string, CostRange> = {};
      for (const p of prev.packages) {
        costs[p.id] = { min: null, max: null };
      }
      return {
        ...prev,
        rows: [
          ...prev.rows,
          {
            id: `${id}-${Date.now()}`,
            plotSizeLabel: label,
            removable: true,
            costs,
          },
        ],
      };
    });
    setNewPlotSize("");
  };

  const removeRow = (rowId: string) => {
    setPricing((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== rowId) }));
  };

  const hasInvalidRanges = useMemo(() => {
    return pricing.rows.some((r) =>
      pricing.packages.some((pkg) => {
        const { min, max } = r.costs[pkg.id] ?? { min: null, max: null };
        return min != null && max != null && min > max;
      }),
    );
  }, [pricing.rows, pricing.packages]);

  const addPackage = () => {
    const label = newPackageLabel.trim();
    if (!label) return;

    let nextActiveId = "";
    setPricing((prev) => {
      const base = slugifyPackageId(label) || `pkg-${Date.now()}`;
      let id = base;
      let n = 2;
      while (prev.packages.some((p) => p.id === id)) {
        id = `${base}-${n++}`;
      }

      nextActiveId = id;

      const nextPackages = [...prev.packages, { id, label }];
      const nextRows = prev.rows.map((r) => ({
        ...r,
        costs: {
          ...r.costs,
          [id]: { min: null, max: null },
        },
      }));

      return normalizePricingState(
        {
          packages: nextPackages,
          rows: nextRows,
          packageScope: {
            ...prev.packageScope,
            [id]: {
              design_included: false,
              fixtures: "",
              ceiling: "",
              kitchen: "",
              bathroom: "",
            },
          },
        },
        id,
      );
    });

    if (nextActiveId) setActivePackage(nextActiveId);
    setNewPackageLabel("");
  };

  const deletePackage = (pkgId: string) => {
    setPricing((prev) => {
      const nextPackages = prev.packages.filter((p) => p.id !== pkgId);
      if (nextPackages.length === 0) return prev;
      const nextRows = prev.rows.map((r) => {
        const { [pkgId]: _removed, ...rest } = r.costs;
        return { ...r, costs: rest };
      });
      const { [pkgId]: _scopeRemoved, ...restScope } = prev.packageScope;
      return normalizePricingState({ packages: nextPackages, rows: nextRows, packageScope: restScope }, nextPackages[0]?.id);
    });

    toast({ title: "Package removed", description: "The package tier was deleted." });
  };

  const startEditPackage = (pkg: PackageDef) => {
    setEditingPackageId(pkg.id);
    setEditingPackageLabel(pkg.label);
  };

  const cancelEditPackage = () => {
    setEditingPackageId(null);
    setEditingPackageLabel("");
  };

  const savePackageLabel = (pkgId: string) => {
    const nextLabel = editingPackageLabel.trim();
    if (!nextLabel) return;
    setPricing((prev) => ({
      ...prev,
      packages: prev.packages.map((p) => (p.id === pkgId ? { ...p, label: nextLabel } : p)),
    }));
    cancelEditPackage();
  };

  const updateScope = (pkgId: string, field: keyof PackageScopeFields, value: boolean | string) => {
    setPricing((prev) => ({
      ...prev,
      packageScope: {
        ...prev.packageScope,
        [pkgId]: {
          ...(prev.packageScope[pkgId] ?? {}),
          [field]: value,
        },
      },
    }));
  };

  const reset = () => {
    setPricing((prev) => ({
      ...prev,
      rows: defaultRowsFromCompany(company, prev.packages.map((p) => p.id)),
    }));
    toast({ title: "Reset", description: "Reverted pricing rows to defaults." });
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

    safeSaveCompanyPricingState(companyKey, pricing);
    safeSaveCompanySettings(companyKey, settings);
    toast({ title: "Saved", description: "Your packages, pricing, and settings were saved locally." });
  };

  const active = pricing.packages.find((p) => p.id === activePackage) ?? pricing.packages[0];
  const activeScope = (active && pricing.packageScope[active.id]) || {};

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

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard interactive={false} className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Package tiers</p>
              <p className="text-xs text-muted-foreground">Add, rename, or remove packages you offer.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Input
                value={newPackageLabel}
                onChange={(e) => setNewPackageLabel(e.target.value)}
                placeholder="Add package (e.g., Ultra)"
                className="bg-background/40"
              />
              <Button type="button" variant="secondary" onClick={addPackage} disabled={!newPackageLabel.trim()}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Package</TableHead>
                  <TableHead className="hidden sm:table-cell">Key</TableHead>
                  <TableHead className="w-24 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricing.packages.map((pkg) => {
                  const isActive = pkg.id === activePackage;
                  const isEditing = editingPackageId === pkg.id;
                  return (
                    <TableRow
                      key={pkg.id}
                      className={cn(isActive && "bg-secondary/40")}
                      onClick={() => setActivePackage(pkg.id)}
                    >
                      <TableCell className="font-medium text-foreground">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editingPackageLabel}
                              onChange={(e) => setEditingPackageLabel(e.target.value)}
                              className="h-9 bg-background/40"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                savePackageLabel(pkg.id);
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-xs text-muted-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditPackage();
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{pkg.label}</span>
                            {isActive ? <Badge variant="secondary" className="rounded-lg">Active</Badge> : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{pkg.id}</TableCell>
                      <TableCell className="text-right">
                        {isEditing ? null : (
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditPackage(pkg);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-xs text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePackage(pkg.id);
                              }}
                              disabled={pricing.packages.length <= 1}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {pricing.packages.length <= 1 ? (
            <p className="mt-2 text-xs text-muted-foreground">Keep at least one package tier available.</p>
          ) : null}
        </GlassCard>

        <GlassCard interactive={false} className="p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Package scope</p>
            <p className="text-xs text-muted-foreground">Configure what’s included in the selected package.</p>
          </div>

          {active ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Design included</p>
                  <p className="text-xs text-muted-foreground">Show if design services are part of this package.</p>
                </div>
                <Switch
                  checked={Boolean(activeScope.design_included)}
                  onCheckedChange={(v) => updateScope(active.id, "design_included", v)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Fixtures</Label>
                  <Select
                    value={activeScope.fixtures || "__none__"}
                    onValueChange={(v) => updateScope(active.id, "fixtures", v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="bg-background/40">
                      <SelectValue placeholder="Select fixtures" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {scopeOptions.fixtures.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {humanizeToken(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Ceiling</Label>
                  <Select
                    value={activeScope.ceiling || "__none__"}
                    onValueChange={(v) => updateScope(active.id, "ceiling", v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="bg-background/40">
                      <SelectValue placeholder="Select ceiling" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {scopeOptions.ceiling.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {humanizeToken(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Kitchen</Label>
                  <Select
                    value={activeScope.kitchen || "__none__"}
                    onValueChange={(v) => updateScope(active.id, "kitchen", v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="bg-background/40">
                      <SelectValue placeholder="Select kitchen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {scopeOptions.kitchen.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {humanizeToken(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Bathroom</Label>
                  <Select
                    value={activeScope.bathroom || "__none__"}
                    onValueChange={(v) => updateScope(active.id, "bathroom", v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="bg-background/40">
                      <SelectValue placeholder="Select bathroom" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {scopeOptions.bathroom.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {humanizeToken(opt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No package selected.</p>
          )}
        </GlassCard>
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

        <Tabs value={activePackage} onValueChange={(v) => setActivePackage(v)} className="mt-4">
          <TabsList>
            {pricing.packages.map((k) => (
              <TabsTrigger key={k.id} value={k.id}>
                {k.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {pricing.packages.map((pkg) => (
            <TabsContent key={pkg.id} value={pkg.id} className="mt-4">
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
                    {pricing.rows.map((r) => {
                      const cell = r.costs[pkg.id] ?? { min: null, max: null };
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
                              onChange={(e) => updateCell(r.id, pkg.id, "min", parseOptionalNumber(e.target.value))}
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
                              onChange={(e) => updateCell(r.id, pkg.id, "max", parseOptionalNumber(e.target.value))}
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

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your company profile and configurable options.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard interactive={false} className="p-4">
            <p className="text-sm font-semibold text-foreground">Basic company information</p>
            <p className="mt-1 text-xs text-muted-foreground">Update how your company appears to clients.</p>

            <div className="mt-4 grid gap-4">
              <div className="space-y-2">
                <Label>Company name</Label>
                <Input
                  value={settings.company_name}
                  onChange={(e) => setSettings((prev) => ({ ...prev, company_name: e.target.value }))}
                  className="bg-background/40"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={settings.description}
                  onChange={(e) => setSettings((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Short company summary (clients will see this)."
                  className="bg-background/40"
                />
                <p className="text-xs text-muted-foreground">Free text is allowed for description only.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Year established</Label>
                  <Input
                    type="number"
                    value={settings.legal_info.year_established ?? ""}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        legal_info: {
                          ...prev.legal_info,
                          year_established: e.target.value.trim() ? Number(e.target.value) : null,
                        },
                      }))
                    }
                    className="bg-background/40"
                    placeholder="e.g., 2018"
                  />
                </div>
                <div className="space-y-2">
                  <Label>NTN</Label>
                  <Input
                    value={settings.legal_info.ntn}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, legal_info: { ...prev.legal_info, ntn: e.target.value } }))
                    }
                    className="bg-background/40"
                    placeholder="e.g., 1001013-1"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Registered</p>
                    <p className="text-xs text-muted-foreground">Indicates legal registration.</p>
                  </div>
                  <Switch
                    checked={settings.legal_info.registered}
                    onCheckedChange={(v) =>
                      setSettings((prev) => ({ ...prev, legal_info: { ...prev.legal_info, registered: v } }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">SECP registered</p>
                    <p className="text-xs text-muted-foreground">Used for trust & verification.</p>
                  </div>
                  <Switch
                    checked={settings.legal_info.secp_registered}
                    onCheckedChange={(v) =>
                      setSettings((prev) => ({ ...prev, legal_info: { ...prev.legal_info, secp_registered: v } }))
                    }
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-4">
            <p className="text-sm font-semibold text-foreground">Profile settings</p>
            <p className="mt-1 text-xs text-muted-foreground">Control visibility and how clients contact you.</p>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={settings.contact.phone}
                    onChange={(e) => setSettings((prev) => ({ ...prev, contact: { ...prev.contact, phone: e.target.value } }))}
                    className="bg-background/40"
                    placeholder="+92-3xx-xxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={settings.contact.email}
                    onChange={(e) => setSettings((prev) => ({ ...prev, contact: { ...prev.contact, email: e.target.value } }))}
                    className="bg-background/40"
                    placeholder="info@company.pk"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={settings.contact.website}
                  onChange={(e) => setSettings((prev) => ({ ...prev, contact: { ...prev.contact, website: e.target.value } }))}
                  className="bg-background/40"
                  placeholder="https://example.com"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Public profile</p>
                    <p className="text-xs text-muted-foreground">Show your company in Browse.</p>
                  </div>
                  <Switch
                    checked={settings.profile_settings.public_profile}
                    onCheckedChange={(v) =>
                      setSettings((prev) => ({ ...prev, profile_settings: { ...prev.profile_settings, public_profile: v } }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Show contact</p>
                    <p className="text-xs text-muted-foreground">Display phone/email to clients.</p>
                  </div>
                  <Switch
                    checked={settings.profile_settings.show_contact}
                    onCheckedChange={(v) =>
                      setSettings((prev) => ({ ...prev, profile_settings: { ...prev.profile_settings, show_contact: v } }))
                    }
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/30 p-3">
                <p className="text-sm font-medium text-foreground">Payment terms</p>
                <p className="mt-1 text-xs text-muted-foreground">Keep terms structured for consistent matching.</p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Advance %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={settings.payment_terms.advance_percentage ?? ""}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          payment_terms: {
                            ...prev.payment_terms,
                            advance_percentage: e.target.value.trim() ? Number(e.target.value) : null,
                          },
                        }))
                      }
                      className="bg-background/40"
                      placeholder="e.g., 30"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Installments</Label>
                    <Select
                      value={settings.payment_terms.installments || "__none__"}
                      onValueChange={(v) =>
                        setSettings((prev) => ({
                          ...prev,
                          payment_terms: { ...prev.payment_terms, installments: v === "__none__" ? "" : v },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-background/40">
                        <SelectValue placeholder="Select installments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not set</SelectItem>
                        {paymentOptions.installments.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {humanizeToken(opt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Price type</Label>
                    <Select
                      value={settings.payment_terms.price_type || "__none__"}
                      onValueChange={(v) =>
                        setSettings((prev) => ({
                          ...prev,
                          payment_terms: { ...prev.payment_terms, price_type: v === "__none__" ? "" : v },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-background/40">
                        <SelectValue placeholder="Select price type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not set</SelectItem>
                        {paymentOptions.priceTypes.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {humanizeToken(opt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-border bg-background/40 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Variation clause</p>
                      <p className="text-xs text-muted-foreground">Allow price variation by market.</p>
                    </div>
                    <Switch
                      checked={settings.payment_terms.variation_clause}
                      onCheckedChange={(v) =>
                        setSettings((prev) => ({
                          ...prev,
                          payment_terms: { ...prev.payment_terms, variation_clause: v },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {company ? (
          <p className="text-xs text-muted-foreground">
            Loaded base company profile from dataset: <span className="font-semibold text-foreground">{company.company_name}</span>.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            No matching company found in the dataset for <span className="font-semibold text-foreground">{email}</span>. Settings will be saved locally.
          </p>
        )}
      </div>
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
