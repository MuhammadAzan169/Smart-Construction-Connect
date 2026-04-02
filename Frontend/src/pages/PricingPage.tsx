import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cities as cityOptions, societiesByCity } from "@/data/locationOptions";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Check, Loader2, Plus, RotateCcw, Save, X } from "lucide-react";
import { api } from "@/lib/api";

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

function parseOptionalFloat(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
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

  operational_area_rates: {
    id: string;
    city: string;
    society: string;
    phase: string;
    rates: Record<string, number | null>;
  }[];
  construction_capability: {
    plot_sizes: string[];
    max_floors: number | null;
    basement_supported: boolean;
    house_types: string[];
  };
  services_offered: {
    construction_services: string[];
    design_services: string[];
    approval_support: string[];
    extra_services: string[];
  };
  materials_used: Record<
    string,
    {
      cement: string;
      steel: string;
      bricks: string;
      wiring: string;
      plumbing: string;
      paint: string;
    }
  >;
  timeline_estimates: Record<
    string,
    {
      single_storey: { min: number | null; typical: number | null; max: number | null };
      double_storey: { min: number | null; typical: number | null; max: number | null };
    }
  >;
  timeline_notes: string;
  reliability_score: number | null;
  experience_track: {
    total_projects_completed: string;
    houses_completed: string;
    ongoing_projects: string;
    specializations: string[];
  };
  quality_control: {
    site_engineer_assigned: boolean;
    material_verification: boolean;
    weekly_reporting: boolean;
  };
  after_handover_support: {
    defect_liability_period_months: number | null;
    maintenance_support: boolean;
    support_response_time_days: number | null;
  };
  legal_contract: {
    written_contract_provided: boolean;
    boq_provided: boolean;
    penalty_for_delay: boolean;
    warranty_duration_years: number | null;
  };
  ideal_customer_profile: {
    best_for: string[];
    not_ideal_for: string[];
    accept_terms: boolean;
  };
};

function normalizeSettingsFromRaw(obj: Record<string, unknown>, defaults: CompanySettings): CompanySettings {
    const str = (v: unknown, fb: string) => (typeof v === "string" ? v : fb);
    const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);
    const strArr = (v: unknown, fb: string[]) =>
      Array.isArray(v)
        ? (v
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 50))
        : fb;
    const numOrNull = (v: unknown, fb: number | null) => {
      if (v == null) return fb;
      if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
      if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? Math.round(n) : fb;
      }
      return fb;
    };
    const floatOrNull = (v: unknown, fb: number | null) => {
      if (v == null) return fb;
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? n : fb;
      }
      return fb;
    };

    const contact = obj.contact && typeof obj.contact === "object" ? (obj.contact as Record<string, unknown>) : {};
    const legalInfo = obj.legal_info && typeof obj.legal_info === "object" ? (obj.legal_info as Record<string, unknown>) : {};
    const paymentTerms = obj.payment_terms && typeof obj.payment_terms === "object" ? (obj.payment_terms as Record<string, unknown>) : {};
    const profileSettings =
      obj.profile_settings && typeof obj.profile_settings === "object" ? (obj.profile_settings as Record<string, unknown>) : {};

    const opRatesRaw = Array.isArray(obj.operational_area_rates) ? (obj.operational_area_rates as unknown[]) : null;
    const operational_area_rates = opRatesRaw
      ? opRatesRaw
          .map((row, idx) => {
            if (!row || typeof row !== "object") return null;
            const r = row as Record<string, unknown>;
            const ratesRaw = r.rates && typeof r.rates === "object" ? (r.rates as Record<string, unknown>) : {};
            const rates: Record<string, number | null> = {};
            for (const [k, v] of Object.entries(ratesRaw)) {
              rates[k] = numOrNull(v, null);
            }
            return {
              id: typeof r.id === "string" ? r.id : `op-${idx}`,
              city: str(r.city, ""),
              society: str(r.society, ""),
              phase: str(r.phase, ""),
              rates,
            };
          })
          .filter((x): x is CompanySettings["operational_area_rates"][number] => Boolean(x))
      : defaults.operational_area_rates;

    const capabilityRaw = obj.construction_capability && typeof obj.construction_capability === "object" ? (obj.construction_capability as Record<string, unknown>) : {};
    const servicesRaw = obj.services_offered && typeof obj.services_offered === "object" ? (obj.services_offered as Record<string, unknown>) : {};

    const materialsUsedRaw = obj.materials_used && typeof obj.materials_used === "object" ? (obj.materials_used as Record<string, unknown>) : null;
    const materials_used: CompanySettings["materials_used"] = materialsUsedRaw
      ? Object.fromEntries(
          Object.entries(materialsUsedRaw)
            .map(([pkgId, v]) => {
              const m = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
              return [
                pkgId,
                {
                  cement: str(m.cement, ""),
                  steel: str(m.steel, ""),
                  bricks: str(m.bricks, ""),
                  wiring: str(m.wiring, ""),
                  plumbing: str(m.plumbing, ""),
                  paint: str(m.paint, ""),
                },
              ] as const;
            })
            .slice(0, 50),
        )
      : defaults.materials_used;

    const timelineRaw = obj.timeline_estimates && typeof obj.timeline_estimates === "object" ? (obj.timeline_estimates as Record<string, unknown>) : null;
    const timeline_estimates: CompanySettings["timeline_estimates"] = timelineRaw
      ? Object.fromEntries(
          Object.entries(timelineRaw).map(([plotId, v]) => {
            const t = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
            const single = t.single_storey && typeof t.single_storey === "object" ? (t.single_storey as Record<string, unknown>) : {};
            const dbl = t.double_storey && typeof t.double_storey === "object" ? (t.double_storey as Record<string, unknown>) : {};
            const mk = (src: Record<string, unknown>) => ({
              min: floatOrNull(src.min, null),
              typical: floatOrNull(src.typical, null),
              max: floatOrNull(src.max, null),
            });
            return [plotId, { single_storey: mk(single), double_storey: mk(dbl) }] as const;
          }),
        )
      : defaults.timeline_estimates;

    const experienceRaw = obj.experience_track && typeof obj.experience_track === "object" ? (obj.experience_track as Record<string, unknown>) : {};
    const qcRaw = obj.quality_control && typeof obj.quality_control === "object" ? (obj.quality_control as Record<string, unknown>) : {};
    const afterRaw = obj.after_handover_support && typeof obj.after_handover_support === "object" ? (obj.after_handover_support as Record<string, unknown>) : {};
    const contractRaw = obj.legal_contract && typeof obj.legal_contract === "object" ? (obj.legal_contract as Record<string, unknown>) : {};
    const idealRaw = obj.ideal_customer_profile && typeof obj.ideal_customer_profile === "object" ? (obj.ideal_customer_profile as Record<string, unknown>) : {};

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

      operational_area_rates,
      construction_capability: {
        plot_sizes: strArr(capabilityRaw.plot_sizes, defaults.construction_capability.plot_sizes),
        max_floors: numOrNull(capabilityRaw.max_floors, defaults.construction_capability.max_floors),
        basement_supported: bool(capabilityRaw.basement_supported, defaults.construction_capability.basement_supported),
        house_types: strArr(capabilityRaw.house_types, defaults.construction_capability.house_types),
      },
      services_offered: {
        construction_services: strArr(servicesRaw.construction_services, defaults.services_offered.construction_services),
        design_services: strArr(servicesRaw.design_services, defaults.services_offered.design_services),
        approval_support: strArr(servicesRaw.approval_support, defaults.services_offered.approval_support),
        extra_services: strArr(servicesRaw.extra_services, defaults.services_offered.extra_services),
      },
      materials_used,
      timeline_estimates,
      timeline_notes: str(obj.timeline_notes, defaults.timeline_notes),
      reliability_score: floatOrNull(obj.reliability_score, defaults.reliability_score),
      experience_track: {
        total_projects_completed: str(experienceRaw.total_projects_completed, defaults.experience_track.total_projects_completed),
        houses_completed: str(experienceRaw.houses_completed, defaults.experience_track.houses_completed),
        ongoing_projects: str(experienceRaw.ongoing_projects, defaults.experience_track.ongoing_projects),
        specializations: strArr(experienceRaw.specializations, defaults.experience_track.specializations),
      },
      quality_control: {
        site_engineer_assigned: bool(qcRaw.site_engineer_assigned, defaults.quality_control.site_engineer_assigned),
        material_verification: bool(qcRaw.material_verification, defaults.quality_control.material_verification),
        weekly_reporting: bool(qcRaw.weekly_reporting, defaults.quality_control.weekly_reporting),
      },
      after_handover_support: {
        defect_liability_period_months: numOrNull(
          afterRaw.defect_liability_period_months,
          defaults.after_handover_support.defect_liability_period_months,
        ),
        maintenance_support: bool(afterRaw.maintenance_support, defaults.after_handover_support.maintenance_support),
        support_response_time_days: numOrNull(afterRaw.support_response_time_days, defaults.after_handover_support.support_response_time_days),
      },
      legal_contract: {
        written_contract_provided: bool(contractRaw.written_contract_provided, defaults.legal_contract.written_contract_provided),
        boq_provided: bool(contractRaw.boq_provided, defaults.legal_contract.boq_provided),
        penalty_for_delay: bool(contractRaw.penalty_for_delay, defaults.legal_contract.penalty_for_delay),
        warranty_duration_years: numOrNull(contractRaw.warranty_duration_years, defaults.legal_contract.warranty_duration_years),
      },
      ideal_customer_profile: {
        best_for: strArr(idealRaw.best_for, defaults.ideal_customer_profile.best_for),
        not_ideal_for: strArr(idealRaw.not_ideal_for, defaults.ideal_customer_profile.not_ideal_for),
        accept_terms: bool(idealRaw.accept_terms, defaults.ideal_customer_profile.accept_terms),
      },
    };
}

function safeLoadCompanySettings(companyKey: string, defaults: CompanySettings): CompanySettings {
  try {
    const raw = localStorage.getItem(settingsStorageKey(companyKey));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaults;
    return normalizeSettingsFromRaw(parsed as Record<string, unknown>, defaults);
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
      const cell = perPkg[pkgId];
      if (cell && typeof cell === "object" && !Array.isArray(cell)) {
        const cellObj = cell as Record<string, unknown>;
        row.costs[pkgId] = {
          min: normalizeMaybeNumber(cellObj.min),
          max: normalizeMaybeNumber(cellObj.max),
        };
      } else {
        row.costs[pkgId] = parsePkrRangeString(cell);
      }
    }
    return row;
  });
}

function defaultCompanySettings(
  company: CompanyDatasetCompany | null,
  email: string,
  packages: PackageDef[],
  plotRows: PricingRow[],
): CompanySettings {
  const blankMaterials = () => ({ cement: "", steel: "", bricks: "", wiring: "", plumbing: "", paint: "" });

  const materials_used: CompanySettings["materials_used"] = {};
  const baseMaterials =
    company?.materials_used && typeof company.materials_used === "object" ? (company.materials_used as unknown as Record<string, Record<string, unknown>>) : {};
  for (const p of packages) {
    const src = baseMaterials[p.id] && typeof baseMaterials[p.id] === "object" ? baseMaterials[p.id] : {};
    materials_used[p.id] = {
      cement: typeof src.cement === "string" ? src.cement : "",
      steel: typeof src.steel === "string" ? src.steel : "",
      bricks: typeof src.bricks === "string" ? src.bricks : "",
      wiring: typeof src.wiring === "string" ? src.wiring : "",
      plumbing: typeof src.plumbing === "string" ? src.plumbing : "",
      paint: typeof src.paint === "string" ? src.paint : "",
    };
  }
  if (packages.length === 0) {
    materials_used.standard = blankMaterials();
  }

  const timeline_estimates: CompanySettings["timeline_estimates"] = {};
  for (const r of plotRows) {
    timeline_estimates[r.id] = {
      single_storey: { min: null, typical: null, max: null },
      double_storey: { min: null, typical: null, max: null },
    };
  }

  const operational_area_rates: CompanySettings["operational_area_rates"] = [];
  const packageIds = packages.map((p) => p.id);
  const seen = new Set<string>();
  for (const row of company?.flattened_operational_areas ?? []) {
    const city = typeof row?.city === "string" ? row.city : "";
    const society = (typeof row?.subarea === "string" && row.subarea) || (typeof row?.area === "string" ? row.area : "");
    const phase = typeof row?.location === "string" ? row.location : "";
    const key = `${city}||${society}||${phase}`;
    if (!city || !society || !phase) continue;

    let target = operational_area_rates.find((x) => x.id === key);
    if (!target) {
      if (seen.has(key)) continue;
      seen.add(key);
      const rates: Record<string, number | null> = {};
      for (const pkgId of packageIds) rates[pkgId] = null;
      target = {
        id: key,
        city,
        society,
        phase,
        rates,
      };
      operational_area_rates.push(target);
    }

    if (typeof row?.package === "string" && packageIds.includes(row.package) && typeof row?.price_per_sqft === "number") {
      target.rates[row.package] = Math.round(row.price_per_sqft);
    }
  }

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

    operational_area_rates,
    construction_capability: {
      plot_sizes: [],
      max_floors: null,
      basement_supported: false,
      house_types: [],
    },
    services_offered: {
      construction_services: [],
      design_services: [],
      approval_support: [],
      extra_services: [],
    },
    materials_used,
    timeline_estimates,
    timeline_notes: "",
    reliability_score: typeof company?.ai_scores?.timeline_reliability === "number" ? company.ai_scores.timeline_reliability : null,
    experience_track: {
      total_projects_completed: "",
      houses_completed: "",
      ongoing_projects: "",
      specializations: Array.isArray(company?.experience?.specializations)
        ? company!.experience!.specializations!.filter((x): x is string => typeof x === "string").slice(0, 20)
        : [],
    },
    quality_control: {
      site_engineer_assigned: false,
      material_verification: false,
      weekly_reporting: false,
    },
    after_handover_support: {
      defect_liability_period_months: null,
      maintenance_support: false,
      support_response_time_days: null,
    },
    legal_contract: {
      written_contract_provided: false,
      boq_provided: false,
      penalty_for_delay: false,
      warranty_duration_years: null,
    },
    ideal_customer_profile: {
      best_for: [],
      not_ideal_for: [],
      accept_terms: false,
    },
  };
}

const scopeOptions = getScopeValueOptions(companyDataset);
const paymentOptions = getPaymentTermOptions(companyDataset);

const plotSizesMarla = ["1 Marla", "3 Marla", "5 Marla", "7 Marla", "10 Marla", "12 Marla", "15 Marla", "20 Marla"];
const plotSizesKanal = [
  "1 Kanal (20 Marla)",
  "2 Kanal (40 Marla)",
  "3 Kanal (60 Marla)",
  "4 Kanal (80 Marla)",
  "5 Kanal (100 Marla)",
  "6 Kanal (120 Marla)",
  "7 Kanal (140 Marla)",
  "8 Kanal (160 Marla)",
];
const maxFloorsOptions = [
  { value: "1", label: "1 Floor (Ground)" },
  { value: "2", label: "2 Floors (G+1)" },
  { value: "3", label: "3 Floors (G+2)" },
  { value: "4", label: "4 Floors (G+3)" },
  { value: "5", label: "5+ Floors (G+4 or more)" },
];
const houseTypeOptions = ["Residential", "Small Commercial", "Commercial Plaza", "Apartments"];
const constructionServiceOptions = ["Turnkey", "Grey Structure"];
const designServiceOptions = ["Architectural", "Structural", "Interior"];
const approvalSupportOptions = ["KDA", "DHA", "LDA", "CDA", "Bahria Town"];
const extraServiceOptions = ["Landscaping", "Smart Home", "Solar", "Interior Fit-outs"];
const specializationOptions = ["Economy Housing", "Small Plots", "Luxury Homes", "Commercial"];
const bestForOptions = ["First Time Builders", "Low Budget Projects", "Fast Track Projects", "Investors"];
const notIdealForOptions = ["Luxury Homes", "Large Commercial", "High-rise Buildings", "Urgent Projects"];
const phaseSuggestions = [
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Phase 4",
  "Phase 5",
  "Phase 6",
  "Phase 7",
  "Phase 8",
  "Phase 9",
  "Block A",
  "Block B",
  "Block C",
  "Block D",
  "Block E",
  "Block F",
  "Block G",
  "Block H",
  "Sector A",
  "Sector B",
  "Sector C",
  "Sector D",
];

function computeMaterialSuggestions(dataset: CompanyDatasetCompany[]) {
  const keys = ["cement", "steel", "bricks", "wiring", "plumbing", "paint"] as const;
  const buckets: Record<(typeof keys)[number], Set<string>> = {
    cement: new Set<string>(),
    steel: new Set<string>(),
    bricks: new Set<string>(),
    wiring: new Set<string>(),
    plumbing: new Set<string>(),
    paint: new Set<string>(),
  };

  for (const company of dataset) {
    const perPkg = company.materials_used && typeof company.materials_used === "object" ? (company.materials_used as Record<string, unknown>) : {};
    for (const pkg of Object.values(perPkg)) {
      if (!pkg || typeof pkg !== "object") continue;
      const obj = pkg as Record<string, unknown>;
      for (const k of keys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim()) buckets[k].add(v.trim());
      }
    }
  }

  const toSorted = (set: Set<string>) => Array.from(set).sort((a, b) => a.localeCompare(b));
  return {
    cement: toSorted(buckets.cement),
    steel: toSorted(buckets.steel),
    bricks: toSorted(buckets.bricks),
    wiring: toSorted(buckets.wiring),
    plumbing: toSorted(buckets.plumbing),
    paint: toSorted(buckets.paint),
  };
}

const materialSuggestions = computeMaterialSuggestions(companyDataset);

function buildEstimatedCostRange(
  rows: PricingRow[],
  packageIds: string[],
): Record<string, Record<string, { min: number | null; max: number | null }>> {
  const result: Record<string, Record<string, { min: number | null; max: number | null }>> = {};
  for (const row of rows) {
    const perPkg: Record<string, { min: number | null; max: number | null }> = {};
    for (const pkgId of packageIds) {
      perPkg[pkgId] = row.costs[pkgId] ?? { min: null, max: null };
    }
    result[row.id] = perPkg;
  }
  return result;
}

function buildFlattenedOperationalAreas(
  rates: CompanySettings["operational_area_rates"],
  packageIds: string[],
) {
  const nested: Record<string, Record<string, Record<string, Record<string, unknown>>>> = {};
  const flat: Record<string, unknown>[] = [];

  for (const row of rates) {
    if (!row.city || !row.society || !row.phase) continue;
    if (!nested[row.city]) nested[row.city] = {};
    if (!nested[row.city][row.society]) nested[row.city][row.society] = {};
    if (!nested[row.city][row.society][row.phase]) nested[row.city][row.society][row.phase] = {};

    for (const pkgId of packageIds) {
      const rate = row.rates[pkgId] ?? null;
      nested[row.city][row.society][row.phase][pkgId] = rate != null ? `PKR ${rate}/sq ft` : "";
      flat.push({
        city: row.city,
        area: row.society,
        subarea: row.society,
        location: row.phase,
        package: pkgId,
        price_per_sqft: rate ?? 0,
        price_raw: rate != null ? `PKR ${rate}/sq ft` : "",
      });
    }
  }

  return { operational_areas: nested, flattened_operational_areas: flat };
}

function CompanyPricingEditor({ email, companySlug }: { email: string; companySlug?: string }) {
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

  const settingsDefaults = useMemo(
    () => defaultCompanySettings(company, email, packagesDefault, defaults.rows),
    [company, email, packagesDefault, defaults.rows],
  );

  const [pricing, setPricing] = useState<CompanyPricingState>(defaults);
  const [settings, setSettings] = useState<CompanySettings>(settingsDefaults);
  const [loading, setLoading] = useState(!!companySlug);
  const [saving, setSaving] = useState(false);
  const profileRef = useRef<Record<string, unknown> | null>(null);
  const [newPlotSize, setNewPlotSize] = useState("");
  const [activePackage, setActivePackage] = useState<string>(() => defaults.packages[0]?.id ?? "standard");
  const [newPackageLabel, setNewPackageLabel] = useState("");
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [editingPackageLabel, setEditingPackageLabel] = useState("");

  useEffect(() => {
    // Load from API if slug is available, otherwise fall back to defaults.
    if (!companySlug) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    api.companies
      .getProfile(companySlug)
      .then((profile) => {
        if (cancelled) return;
        profileRef.current = profile && typeof profile === "object" ? (profile as Record<string, unknown>) : {};

        const apiCompany = profile as CompanyDatasetCompany;

        // Check for round-trip editor state saved previously.
        const editorPricing = (profile as Record<string, unknown>)?._editor_pricing;
        const editorSettings = (profile as Record<string, unknown>)?._editor_settings;

        if (editorPricing && typeof editorPricing === "object" && !Array.isArray(editorPricing)) {
          const ep = editorPricing as Record<string, unknown>;
          const pkgsRaw = ep.packages;
          const rowsRaw = ep.rows;
          const scopeRaw = ep.packageScope;
          const pState = normalizePricingState(
            {
              packages: Array.isArray(pkgsRaw) ? (pkgsRaw as unknown as PackageDef[]) : defaults.packages,
              rows: Array.isArray(rowsRaw) ? (rowsRaw as unknown as PricingRow[]) : defaults.rows,
              packageScope:
                scopeRaw && typeof scopeRaw === "object"
                  ? (scopeRaw as unknown as Record<string, PackageScopeFields>)
                  : defaults.packageScope,
            },
            defaults.packages[0]?.id,
          );
          setPricing(pState);
        } else {
          // First load – derive from raw company data.
          const pkgs = defaultPackagesFromCompany(apiCompany);
          const pkgIds = pkgs.map((p) => p.id);
          const scope = defaultScopeFromCompany(apiCompany, pkgs);
          const rows = defaultRowsFromCompany(apiCompany, pkgIds);
          setPricing(normalizePricingState({ packages: pkgs, rows, packageScope: scope }, pkgs[0]?.id));
        }

        if (editorSettings && typeof editorSettings === "object" && !Array.isArray(editorSettings)) {
          setSettings(normalizeSettingsFromRaw(editorSettings as Record<string, unknown>, settingsDefaults));
        } else {
          // First load – derive from raw company data.
          const pkgs = defaultPackagesFromCompany(apiCompany);
          const pkgIds = pkgs.map((p) => p.id);
          const rows = defaultRowsFromCompany(apiCompany, pkgIds);
          const pState = normalizePricingState(
            { packages: pkgs, rows, packageScope: defaultScopeFromCompany(apiCompany, pkgs) },
            pkgs[0]?.id,
          );
          setSettings(defaultCompanySettings(apiCompany, email, pkgs, pState.rows));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load company profile:", err);
        toast({
          variant: "destructive",
          title: "Load failed",
          description: "Could not load profile from server. Using defaults.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companySlug, email]);

  useEffect(() => {
    // Keep active package valid.
    if (!pricing.packages.some((p) => p.id === activePackage)) {
      setActivePackage(pricing.packages[0]?.id ?? "standard");
    }
  }, [pricing.packages, activePackage]);

  useEffect(() => {
    const packageIds = pricing.packages.map((p) => p.id);
    const plotIds = pricing.rows.map((r) => r.id);
    const blankMaterials = () => ({ cement: "", steel: "", bricks: "", wiring: "", plumbing: "", paint: "" });

    setSettings((prev) => {
      let changed = false;

      const nextOperational = prev.operational_area_rates.map((row) => {
        const baseRates = row?.rates && typeof row.rates === "object" ? row.rates : {};
        let ratesChanged = false;
        const nextRates: Record<string, number | null> = { ...baseRates };
        for (const pkgId of packageIds) {
          if (!(pkgId in nextRates)) {
            nextRates[pkgId] = null;
            ratesChanged = true;
          }
        }
        for (const k of Object.keys(nextRates)) {
          if (!packageIds.includes(k)) {
            delete nextRates[k];
            ratesChanged = true;
          }
        }
        if (!ratesChanged) return row;
        changed = true;
        return { ...row, rates: nextRates };
      });

      const nextMaterials: CompanySettings["materials_used"] = { ...prev.materials_used };
      for (const pkgId of packageIds) {
        if (!nextMaterials[pkgId]) {
          nextMaterials[pkgId] = blankMaterials();
          changed = true;
        }
      }
      for (const k of Object.keys(nextMaterials)) {
        if (!packageIds.includes(k)) {
          delete nextMaterials[k];
          changed = true;
        }
      }

      const nextTimeline: CompanySettings["timeline_estimates"] = { ...prev.timeline_estimates };
      for (const plotId of plotIds) {
        if (!nextTimeline[plotId]) {
          nextTimeline[plotId] = {
            single_storey: { min: null, typical: null, max: null },
            double_storey: { min: null, typical: null, max: null },
          };
          changed = true;
        }
      }
      for (const k of Object.keys(nextTimeline)) {
        if (!plotIds.includes(k)) {
          delete nextTimeline[k];
          changed = true;
        }
      }

      if (!changed) return prev;
      return {
        ...prev,
        operational_area_rates: nextOperational,
        materials_used: nextMaterials,
        timeline_estimates: nextTimeline,
      };
    });
  }, [pricing.packages, pricing.rows]);

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

  const toggleInList = (list: string[], value: string, on: boolean) => {
    const cleaned = value.trim();
    if (!cleaned) return list;
    if (on) return Array.from(new Set([...list, cleaned]));
    return list.filter((x) => x !== cleaned);
  };

  const addOperationalArea = () => {
    const id = `op-${Date.now()}`;
    const rates: Record<string, number | null> = {};
    for (const p of pricing.packages) rates[p.id] = null;
    setSettings((prev) => ({
      ...prev,
      operational_area_rates: [...prev.operational_area_rates, { id, city: "", society: "", phase: "", rates }],
    }));
  };

  const removeOperationalArea = (id: string) => {
    setSettings((prev) => ({ ...prev, operational_area_rates: prev.operational_area_rates.filter((r) => r.id !== id) }));
  };

  const patchOperationalArea = (id: string, patch: Partial<CompanySettings["operational_area_rates"][number]>) => {
    setSettings((prev) => ({
      ...prev,
      operational_area_rates: prev.operational_area_rates.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const patchOperationalRate = (id: string, pkgId: string, next: number | null) => {
    setSettings((prev) => ({
      ...prev,
      operational_area_rates: prev.operational_area_rates.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          rates: {
            ...(r.rates ?? {}),
            [pkgId]: next,
          },
        };
      }),
    }));
  };

  const updateMaterial = (
    pkgId: string,
    field: keyof CompanySettings["materials_used"][string],
    value: string,
  ) => {
    setSettings((prev) => ({
      ...prev,
      materials_used: {
        ...prev.materials_used,
        [pkgId]: {
          ...(prev.materials_used[pkgId] ?? { cement: "", steel: "", bricks: "", wiring: "", plumbing: "", paint: "" }),
          [field]: value,
        },
      },
    }));
  };

  const updateTimeline = (
    plotId: string,
    storey: "single_storey" | "double_storey",
    key: "min" | "typical" | "max",
    value: number | null,
  ) => {
    setSettings((prev) => ({
      ...prev,
      timeline_estimates: {
        ...prev.timeline_estimates,
        [plotId]: {
          ...(prev.timeline_estimates[plotId] ?? {
            single_storey: { min: null, typical: null, max: null },
            double_storey: { min: null, typical: null, max: null },
          }),
          [storey]: {
            ...((prev.timeline_estimates[plotId] ?? {})[storey] ?? { min: null, typical: null, max: null }),
            [key]: value,
          },
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

  const save = async () => {
    if (hasInvalidRanges) {
      toast({
        variant: "destructive",
        title: "Fix pricing ranges",
        description: "Some rows have Min greater than Max. Please correct them before saving.",
      });
      return;
    }

    if (!companySlug) {
      toast({ variant: "destructive", title: "Error", description: "No company profile linked to your account." });
      return;
    }

    setSaving(true);
    try {
      const packageIds = pricing.packages.map((p) => p.id);
      const { operational_areas, flattened_operational_areas } = buildFlattenedOperationalAreas(
        settings.operational_area_rates,
        packageIds,
      );

      // Build the full profile object preserving any existing fields.
      const profileData: Record<string, unknown> = {
        ...(profileRef.current ?? {}),
        company_name: settings.company_name,
        description: settings.description,
        contact: settings.contact,
        legal_info: settings.legal_info,
        payment_terms: settings.payment_terms,
        profile_settings: settings.profile_settings,
        construction_capability: settings.construction_capability,
        services_offered: settings.services_offered,
        materials_used: settings.materials_used,
        timeline_estimates: settings.timeline_estimates,
        timeline_notes: settings.timeline_notes,
        reliability_score: settings.reliability_score,
        experience_track: settings.experience_track,
        quality_control: settings.quality_control,
        after_handover_support: settings.after_handover_support,
        legal_contract: settings.legal_contract,
        ideal_customer_profile: settings.ideal_customer_profile,
        operational_areas,
        flattened_operational_areas,
        package_scope: pricing.packageScope,
        estimated_total_cost_range: buildEstimatedCostRange(pricing.rows, packageIds),
        // Round-trip editor state for faithful reload.
        _editor_pricing: pricing,
        _editor_settings: settings,
      };

      await api.companies.updateProfile(companySlug, profileData);

      await api.companies.updatePackages(companySlug, {
        operational_areas,
        flattened_operational_areas,
        package_scope: pricing.packageScope,
        materials_used: settings.materials_used,
        estimated_total_cost_range: buildEstimatedCostRange(pricing.rows, packageIds),
      });

      profileRef.current = profileData;
      toast({ title: "Saved", description: "Your packages, pricing, and settings were saved." });
    } catch (err) {
      console.error("Failed to save company profile:", err);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: err instanceof Error ? err.message : "Could not save profile to server.",
      });
    } finally {
      setSaving(false);
    }
  };

  const active = pricing.packages.find((p) => p.id === activePackage) ?? pricing.packages[0];
  const activeScope = (active && pricing.packageScope[active.id]) || {};

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Packages & Pricing</h1>
          <p className="text-sm text-muted-foreground">Update your package pricing. Clients will see these ranges when matching.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={reset} disabled={saving}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save changes"}
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

          <GlassCard interactive={false} className="p-4 lg:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Operational areas & rates (PKR/sq ft)</p>
                <p className="text-xs text-muted-foreground">Add cities, societies, phases/blocks, and per-package rates.</p>
              </div>
              <Button type="button" variant="secondary" onClick={addOperationalArea}>
                <Plus className="h-4 w-4" />
                Add location
              </Button>
            </div>

            {settings.operational_area_rates.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No operational areas added yet.</p>
            ) : (
              <div className="mt-4 grid gap-4">
                {settings.operational_area_rates.map((row, idx) => {
                  const cityKnown = (cityOptions as readonly string[]).includes(row.city);
                  const citySelectValue = row.city ? (cityKnown ? row.city : "__custom__") : "__none__";
                  const societyOptions = cityKnown ? societiesByCity[row.city] ?? [] : [];
                  const societyKnown = cityKnown && societyOptions.includes(row.society);
                  const societySelectValue = row.society ? (societyKnown ? row.society : "__custom__") : "__none__";

                  return (
                    <div key={row.id} className="rounded-2xl border border-border bg-background/30 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">Location {idx + 1}</p>
                          <p className="text-xs text-muted-foreground">Use “Other” if the option is not listed.</p>
                        </div>
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-xs text-destructive"
                          onClick={() => removeOperationalArea(row.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">City</Label>
                          <Select
                            value={citySelectValue}
                            onValueChange={(v) => {
                              if (v === "__none__") {
                                patchOperationalArea(row.id, { city: "", society: "" });
                                return;
                              }
                              if (v === "__custom__") {
                                if (cityKnown) patchOperationalArea(row.id, { city: "", society: "" });
                                return;
                              }
                              const nextSocietyOptions = societiesByCity[v] ?? [];
                              const nextSociety = nextSocietyOptions.includes(row.society) ? row.society : "";
                              patchOperationalArea(row.id, { city: v, society: nextSociety });
                            }}
                          >
                            <SelectTrigger className="bg-background/40">
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Not set</SelectItem>
                              {(cityOptions as readonly string[]).map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                              <SelectItem value="__custom__">Other (type manually)</SelectItem>
                            </SelectContent>
                          </Select>
                          {citySelectValue === "__custom__" ? (
                            <Input
                              value={row.city}
                              onChange={(e) => patchOperationalArea(row.id, { city: e.target.value, society: "" })}
                              className="bg-background/40"
                              placeholder="Enter city"
                            />
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Society / Area</Label>
                          {cityKnown ? (
                            <>
                              <Select
                                value={societySelectValue}
                                onValueChange={(v) => {
                                  if (v === "__none__") {
                                    patchOperationalArea(row.id, { society: "" });
                                    return;
                                  }
                                  if (v === "__custom__") {
                                    if (societyKnown) patchOperationalArea(row.id, { society: "" });
                                    return;
                                  }
                                  patchOperationalArea(row.id, { society: v });
                                }}
                              >
                                <SelectTrigger className="bg-background/40">
                                  <SelectValue placeholder="Select society" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Not set</SelectItem>
                                  {societyOptions.map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {s}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="__custom__">Other (type manually)</SelectItem>
                                </SelectContent>
                              </Select>
                              {societySelectValue === "__custom__" ? (
                                <Input
                                  value={row.society}
                                  onChange={(e) => patchOperationalArea(row.id, { society: e.target.value })}
                                  className="bg-background/40"
                                  placeholder="Enter society"
                                />
                              ) : null}
                            </>
                          ) : (
                            <Input
                              value={row.society}
                              onChange={(e) => patchOperationalArea(row.id, { society: e.target.value })}
                              className="bg-background/40"
                              placeholder="Enter society"
                            />
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Phase / Block</Label>
                          <Input
                            value={row.phase}
                            onChange={(e) => patchOperationalArea(row.id, { phase: e.target.value })}
                            className="bg-background/40"
                            placeholder="e.g., Phase 1 / Block A"
                            list="phase-suggestions"
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs font-semibold text-foreground">Rates by package</p>
                        <div className={cn("mt-3 grid gap-3", pricing.packages.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
                          {pricing.packages.map((pkg) => (
                            <div key={pkg.id} className="space-y-2">
                              <Label className="text-xs text-muted-foreground">{pkg.label}</Label>
                              <Input
                                type="number"
                                min={0}
                                step={50}
                                value={row.rates?.[pkg.id] ?? ""}
                                onChange={(e) => patchOperationalRate(row.id, pkg.id, parseOptionalNumber(e.target.value))}
                                className="bg-background/40"
                                placeholder="PKR/sq ft"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <datalist id="phase-suggestions">
              {phaseSuggestions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </GlassCard>

          <GlassCard interactive={false} className="p-4">
            <p className="text-sm font-semibold text-foreground">Construction capability</p>
            <p className="mt-1 text-xs text-muted-foreground">Plot sizes, max floors, basement support, and house types.</p>

            <div className="mt-4 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Available plot sizes</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {plotSizesMarla.map((opt) => {
                    const checked = settings.construction_capability.plot_sizes.includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const on = Boolean(v);
                            setSettings((prev) => ({
                              ...prev,
                              construction_capability: {
                                ...prev.construction_capability,
                                plot_sizes: toggleInList(prev.construction_capability.plot_sizes, opt, on),
                              },
                            }));
                          }}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {plotSizesKanal.map((opt) => {
                    const checked = settings.construction_capability.plot_sizes.includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const on = Boolean(v);
                            setSettings((prev) => ({
                              ...prev,
                              construction_capability: {
                                ...prev.construction_capability,
                                plot_sizes: toggleInList(prev.construction_capability.plot_sizes, opt, on),
                              },
                            }));
                          }}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Maximum floors supported</Label>
                  <Select
                    value={settings.construction_capability.max_floors != null ? String(settings.construction_capability.max_floors) : "__none__"}
                    onValueChange={(v) =>
                      setSettings((prev) => ({
                        ...prev,
                        construction_capability: {
                          ...prev.construction_capability,
                          max_floors: v === "__none__" ? null : Number(v),
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="bg-background/40">
                      <SelectValue placeholder="Select max floors" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {maxFloorsOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Basement supported</p>
                    <p className="text-xs text-muted-foreground">Check if you can construct basements.</p>
                  </div>
                  <Switch
                    checked={settings.construction_capability.basement_supported}
                    onCheckedChange={(v) =>
                      setSettings((prev) => ({
                        ...prev,
                        construction_capability: { ...prev.construction_capability, basement_supported: v },
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">House types</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {houseTypeOptions.map((opt) => {
                    const checked = settings.construction_capability.house_types.includes(opt);
                    return (
                      <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const on = Boolean(v);
                            setSettings((prev) => ({
                              ...prev,
                              construction_capability: {
                                ...prev.construction_capability,
                                house_types: toggleInList(prev.construction_capability.house_types, opt, on),
                              },
                            }));
                          }}
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/30 p-3">
                <p className="text-sm font-medium text-foreground">Services offered</p>
                <p className="mt-1 text-xs text-muted-foreground">Select everything you provide.</p>

                <div className="mt-3 grid gap-4">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Construction services</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {constructionServiceOptions.map((opt) => {
                        const checked = settings.services_offered.construction_services.includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const on = Boolean(v);
                                setSettings((prev) => ({
                                  ...prev,
                                  services_offered: {
                                    ...prev.services_offered,
                                    construction_services: toggleInList(prev.services_offered.construction_services, opt, on),
                                  },
                                }));
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-foreground">Design services</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {designServiceOptions.map((opt) => {
                        const checked = settings.services_offered.design_services.includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const on = Boolean(v);
                                setSettings((prev) => ({
                                  ...prev,
                                  services_offered: {
                                    ...prev.services_offered,
                                    design_services: toggleInList(prev.services_offered.design_services, opt, on),
                                  },
                                }));
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-foreground">Approval support</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {approvalSupportOptions.map((opt) => {
                        const checked = settings.services_offered.approval_support.includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const on = Boolean(v);
                                setSettings((prev) => ({
                                  ...prev,
                                  services_offered: {
                                    ...prev.services_offered,
                                    approval_support: toggleInList(prev.services_offered.approval_support, opt, on),
                                  },
                                }));
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-foreground">Extra services</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {extraServiceOptions.map((opt) => {
                        const checked = settings.services_offered.extra_services.includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const on = Boolean(v);
                                setSettings((prev) => ({
                                  ...prev,
                                  services_offered: {
                                    ...prev.services_offered,
                                    extra_services: toggleInList(prev.services_offered.extra_services, opt, on),
                                  },
                                }));
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-4">
            <p className="text-sm font-semibold text-foreground">Materials used (by package)</p>
            <p className="mt-1 text-xs text-muted-foreground">Enter brands/grades for each package tier (leave blank if not set).</p>

            <Tabs value={activePackage} onValueChange={(v) => setActivePackage(v)} className="mt-4">
              <TabsList>
                {pricing.packages.map((p) => (
                  <TabsTrigger key={p.id} value={p.id}>
                    {p.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {pricing.packages.map((pkg) => {
                const m = settings.materials_used[pkg.id] ?? { cement: "", steel: "", bricks: "", wiring: "", plumbing: "", paint: "" };
                return (
                  <TabsContent key={pkg.id} value={pkg.id} className="mt-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Cement</Label>
                        <Input
                          value={m.cement}
                          onChange={(e) => updateMaterial(pkg.id, "cement", e.target.value)}
                          className="bg-background/40"
                          placeholder="e.g., Bestway"
                          list="material-cement"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Steel</Label>
                        <Input
                          value={m.steel}
                          onChange={(e) => updateMaterial(pkg.id, "steel", e.target.value)}
                          className="bg-background/40"
                          placeholder="e.g., 60 Grade"
                          list="material-steel"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Bricks</Label>
                        <Input
                          value={m.bricks}
                          onChange={(e) => updateMaterial(pkg.id, "bricks", e.target.value)}
                          className="bg-background/40"
                          placeholder="e.g., A+ Bricks"
                          list="material-bricks"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Wiring</Label>
                        <Input
                          value={m.wiring}
                          onChange={(e) => updateMaterial(pkg.id, "wiring", e.target.value)}
                          className="bg-background/40"
                          placeholder="e.g., Pak Cable"
                          list="material-wiring"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Plumbing</Label>
                        <Input
                          value={m.plumbing}
                          onChange={(e) => updateMaterial(pkg.id, "plumbing", e.target.value)}
                          className="bg-background/40"
                          placeholder="e.g., Ashir"
                          list="material-plumbing"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Paint</Label>
                        <Input
                          value={m.paint}
                          onChange={(e) => updateMaterial(pkg.id, "paint", e.target.value)}
                          className="bg-background/40"
                          placeholder="e.g., Berger"
                          list="material-paint"
                        />
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>

            <datalist id="material-cement">
              {materialSuggestions.cement.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <datalist id="material-steel">
              {materialSuggestions.steel.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <datalist id="material-bricks">
              {materialSuggestions.bricks.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <datalist id="material-wiring">
              {materialSuggestions.wiring.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <datalist id="material-plumbing">
              {materialSuggestions.plumbing.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <datalist id="material-paint">
              {materialSuggestions.paint.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </GlassCard>

          <GlassCard interactive={false} className="p-4 lg:col-span-2">
            <p className="text-sm font-semibold text-foreground">Timeline estimates</p>
            <p className="mt-1 text-xs text-muted-foreground">Provide min/typical/max months for each plot size.</p>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Plot size</TableHead>
                    <TableHead className="min-w-[12rem]">Single (Min / Typical / Max)</TableHead>
                    <TableHead className="min-w-[12rem]">Double (Min / Typical / Max)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricing.rows.map((r) => {
                    const t = settings.timeline_estimates[r.id] ?? {
                      single_storey: { min: null, typical: null, max: null },
                      double_storey: { min: null, typical: null, max: null },
                    };
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-foreground">{r.plotSizeLabel}</TableCell>
                        <TableCell>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={t.single_storey.min ?? ""}
                              onChange={(e) => updateTimeline(r.id, "single_storey", "min", parseOptionalFloat(e.target.value))}
                              className="bg-background/40"
                              placeholder="Min"
                            />
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={t.single_storey.typical ?? ""}
                              onChange={(e) => updateTimeline(r.id, "single_storey", "typical", parseOptionalFloat(e.target.value))}
                              className="bg-background/40"
                              placeholder="Typical"
                            />
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={t.single_storey.max ?? ""}
                              onChange={(e) => updateTimeline(r.id, "single_storey", "max", parseOptionalFloat(e.target.value))}
                              className="bg-background/40"
                              placeholder="Max"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={t.double_storey.min ?? ""}
                              onChange={(e) => updateTimeline(r.id, "double_storey", "min", parseOptionalFloat(e.target.value))}
                              className="bg-background/40"
                              placeholder="Min"
                            />
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={t.double_storey.typical ?? ""}
                              onChange={(e) => updateTimeline(r.id, "double_storey", "typical", parseOptionalFloat(e.target.value))}
                              className="bg-background/40"
                              placeholder="Typical"
                            />
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={t.double_storey.max ?? ""}
                              onChange={(e) => updateTimeline(r.id, "double_storey", "max", parseOptionalFloat(e.target.value))}
                              className="bg-background/40"
                              placeholder="Max"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Timeline notes</Label>
                <Textarea
                  value={settings.timeline_notes}
                  onChange={(e) => setSettings((prev) => ({ ...prev, timeline_notes: e.target.value }))}
                  className="bg-background/40"
                  placeholder="Any additional notes about timelines..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Reliability score (0 to 1)</Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={settings.reliability_score ?? ""}
                  onChange={(e) => {
                    const n = parseOptionalFloat(e.target.value);
                    const clamped = n == null ? null : Math.max(0, Math.min(1, n));
                    setSettings((prev) => ({ ...prev, reliability_score: clamped }));
                  }}
                  className="bg-background/40"
                  placeholder="e.g., 0.7"
                />
                <p className="text-xs text-muted-foreground">Use 0 (low) to 1 (high).</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-4 lg:col-span-2">
            <p className="text-sm font-semibold text-foreground">Experience, quality, and policies</p>
            <p className="mt-1 text-xs text-muted-foreground">Track record, QC practices, after-handover, contract details, and ideal customers.</p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/30 p-3">
                <p className="text-sm font-medium text-foreground">Experience & track record</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Total projects completed</Label>
                    <Select
                      value={settings.experience_track.total_projects_completed || "__none__"}
                      onValueChange={(v) =>
                        setSettings((prev) => ({
                          ...prev,
                          experience_track: { ...prev.experience_track, total_projects_completed: v === "__none__" ? "" : v },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-background/40">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not set</SelectItem>
                        <SelectItem value="0-5">0-5 Projects</SelectItem>
                        <SelectItem value="6-20">6-20 Projects</SelectItem>
                        <SelectItem value="21-50">21-50 Projects</SelectItem>
                        <SelectItem value="51-100">51-100 Projects</SelectItem>
                        <SelectItem value="100+">100+ Projects</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Houses completed</Label>
                    <Select
                      value={settings.experience_track.houses_completed || "__none__"}
                      onValueChange={(v) =>
                        setSettings((prev) => ({
                          ...prev,
                          experience_track: { ...prev.experience_track, houses_completed: v === "__none__" ? "" : v },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-background/40">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not set</SelectItem>
                        <SelectItem value="0-10">0-10 Houses</SelectItem>
                        <SelectItem value="11-30">11-30 Houses</SelectItem>
                        <SelectItem value="31-100">31-100 Houses</SelectItem>
                        <SelectItem value="101-500">101-500 Houses</SelectItem>
                        <SelectItem value="500+">500+ Houses</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <Label className="text-xs text-muted-foreground">Ongoing projects</Label>
                  <Select
                    value={settings.experience_track.ongoing_projects || "__none__"}
                    onValueChange={(v) =>
                      setSettings((prev) => ({
                        ...prev,
                        experience_track: { ...prev.experience_track, ongoing_projects: v === "__none__" ? "" : v },
                      }))
                    }
                  >
                    <SelectTrigger className="bg-background/40">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="1-3">1-3</SelectItem>
                      <SelectItem value="4-10">4-10</SelectItem>
                      <SelectItem value="11-20">11-20</SelectItem>
                      <SelectItem value="20+">20+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-semibold text-foreground">Specializations</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {specializationOptions.map((opt) => {
                      const checked = settings.experience_track.specializations.includes(opt);
                      return (
                        <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const on = Boolean(v);
                              setSettings((prev) => ({
                                ...prev,
                                experience_track: {
                                  ...prev.experience_track,
                                  specializations: toggleInList(prev.experience_track.specializations, opt, on),
                                },
                              }));
                            }}
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/30 p-3">
                <p className="text-sm font-medium text-foreground">Quality control</p>
                <div className="mt-3 grid gap-3">
                  <div className="flex items-center justify-between rounded-2xl border border-border bg-background/40 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Site engineer assigned</p>
                      <p className="text-xs text-muted-foreground">Dedicated site engineer on projects.</p>
                    </div>
                    <Switch
                      checked={settings.quality_control.site_engineer_assigned}
                      onCheckedChange={(v) =>
                        setSettings((prev) => ({ ...prev, quality_control: { ...prev.quality_control, site_engineer_assigned: v } }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-border bg-background/40 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Material verification</p>
                      <p className="text-xs text-muted-foreground">Verify materials on delivery.</p>
                    </div>
                    <Switch
                      checked={settings.quality_control.material_verification}
                      onCheckedChange={(v) =>
                        setSettings((prev) => ({ ...prev, quality_control: { ...prev.quality_control, material_verification: v } }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-border bg-background/40 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Weekly reporting</p>
                      <p className="text-xs text-muted-foreground">Provide weekly updates to clients.</p>
                    </div>
                    <Switch
                      checked={settings.quality_control.weekly_reporting}
                      onCheckedChange={(v) =>
                        setSettings((prev) => ({ ...prev, quality_control: { ...prev.quality_control, weekly_reporting: v } }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background/30 p-3">
                <p className="text-sm font-medium text-foreground">After-handover support</p>
                <div className="mt-3 grid gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Defect liability period (months)</Label>
                    <Select
                      value={settings.after_handover_support.defect_liability_period_months != null ? String(settings.after_handover_support.defect_liability_period_months) : "__none__"}
                      onValueChange={(v) =>
                        setSettings((prev) => ({
                          ...prev,
                          after_handover_support: {
                            ...prev.after_handover_support,
                            defect_liability_period_months: v === "__none__" ? null : Number(v),
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-background/40">
                        <SelectValue placeholder="Select period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not set</SelectItem>
                        <SelectItem value="0">No Warranty</SelectItem>
                        <SelectItem value="6">6 Months</SelectItem>
                        <SelectItem value="12">12 Months</SelectItem>
                        <SelectItem value="24">24 Months</SelectItem>
                        <SelectItem value="36">36 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-border bg-background/40 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Maintenance support</p>
                      <p className="text-xs text-muted-foreground">Ongoing maintenance availability.</p>
                    </div>
                    <Switch
                      checked={settings.after_handover_support.maintenance_support}
                      onCheckedChange={(v) =>
                        setSettings((prev) => ({
                          ...prev,
                          after_handover_support: { ...prev.after_handover_support, maintenance_support: v },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Support response time</Label>
                    <Select
                      value={settings.after_handover_support.support_response_time_days != null ? String(settings.after_handover_support.support_response_time_days) : "__none__"}
                      onValueChange={(v) =>
                        setSettings((prev) => ({
                          ...prev,
                          after_handover_support: {
                            ...prev.after_handover_support,
                            support_response_time_days: v === "__none__" ? null : Number(v),
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-background/40">
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not set</SelectItem>
                        <SelectItem value="1">Within 1 Day</SelectItem>
                        <SelectItem value="3">Within 3 Days</SelectItem>
                        <SelectItem value="7">Within 7 Days</SelectItem>
                        <SelectItem value="14">Within 14 Days</SelectItem>
                        <SelectItem value="30">Within 30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/30 p-3">
                <p className="text-sm font-medium text-foreground">Legal & contract</p>
                <div className="mt-3 grid gap-3">
                  <div className="flex items-center justify-between rounded-2xl border border-border bg-background/40 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Written contract provided</p>
                      <p className="text-xs text-muted-foreground">Formal written contract for clients.</p>
                    </div>
                    <Switch
                      checked={settings.legal_contract.written_contract_provided}
                      onCheckedChange={(v) =>
                        setSettings((prev) => ({
                          ...prev,
                          legal_contract: { ...prev.legal_contract, written_contract_provided: v },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-border bg-background/40 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">BOQ provided</p>
                      <p className="text-xs text-muted-foreground">Bill of Quantities availability.</p>
                    </div>
                    <Switch
                      checked={settings.legal_contract.boq_provided}
                      onCheckedChange={(v) =>
                        setSettings((prev) => ({ ...prev, legal_contract: { ...prev.legal_contract, boq_provided: v } }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-border bg-background/40 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Penalty for delay</p>
                      <p className="text-xs text-muted-foreground">Contract includes delay penalties.</p>
                    </div>
                    <Switch
                      checked={settings.legal_contract.penalty_for_delay}
                      onCheckedChange={(v) =>
                        setSettings((prev) => ({
                          ...prev,
                          legal_contract: { ...prev.legal_contract, penalty_for_delay: v },
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Warranty duration (years)</Label>
                    <Select
                      value={settings.legal_contract.warranty_duration_years != null ? String(settings.legal_contract.warranty_duration_years) : "__none__"}
                      onValueChange={(v) =>
                        setSettings((prev) => ({
                          ...prev,
                          legal_contract: { ...prev.legal_contract, warranty_duration_years: v === "__none__" ? null : Number(v) },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-background/40">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Not set</SelectItem>
                        <SelectItem value="1">1 Year</SelectItem>
                        <SelectItem value="2">2 Years</SelectItem>
                        <SelectItem value="5">5 Years</SelectItem>
                        <SelectItem value="10">10 Years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background/30 p-3">
                <p className="text-sm font-medium text-foreground">Ideal customer profile</p>
                <div className="mt-3 grid gap-4">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Best for</p>
                    <div className="mt-2 grid gap-2">
                      {bestForOptions.map((opt) => {
                        const checked = settings.ideal_customer_profile.best_for.includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const on = Boolean(v);
                                setSettings((prev) => ({
                                  ...prev,
                                  ideal_customer_profile: {
                                    ...prev.ideal_customer_profile,
                                    best_for: toggleInList(prev.ideal_customer_profile.best_for, opt, on),
                                  },
                                }));
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-foreground">Not ideal for</p>
                    <div className="mt-2 grid gap-2">
                      {notIdealForOptions.map((opt) => {
                        const checked = settings.ideal_customer_profile.not_ideal_for.includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const on = Boolean(v);
                                setSettings((prev) => ({
                                  ...prev,
                                  ideal_customer_profile: {
                                    ...prev.ideal_customer_profile,
                                    not_ideal_for: toggleInList(prev.ideal_customer_profile.not_ideal_for, opt, on),
                                  },
                                }));
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={settings.ideal_customer_profile.accept_terms}
                      onCheckedChange={(v) =>
                        setSettings((prev) => ({
                          ...prev,
                          ideal_customer_profile: { ...prev.ideal_customer_profile, accept_terms: Boolean(v) },
                        }))
                      }
                    />
                    <span>I accept the Terms & Conditions</span>
                  </label>
                  <p className="text-xs text-muted-foreground">This is stored for later approval workflows.</p>
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
    return <CompanyPricingEditor email={user.email} companySlug={user.companyFile} />;
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
