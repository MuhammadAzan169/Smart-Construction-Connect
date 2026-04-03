import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { GlassCard } from "@/components/shared/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, Plus, Save, X } from "lucide-react";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type PackageDef = { id: string; label: string };

type CompanySettings = {
  company_name: string;
  description: string;
  logo_url: string;
  contact: {
    phone: string;
    email: string;
    website: string;
    linkedin: string;
    facebook: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const str = (v: unknown, fb: string) => (typeof v === "string" ? v : fb);
const bool = (v: unknown, fb: boolean) => (typeof v === "boolean" ? v : fb);
const strArr = (v: unknown, fb: string[]): string[] =>
  Array.isArray(v)
    ? (v as unknown[])
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 50)
    : fb;
const numOrNull = (v: unknown, fb: number | null): number | null => {
  if (v == null) return fb;
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : fb;
  }
  return fb;
};
const floatOrNull = (v: unknown, fb: number | null): number | null => {
  if (v == null) return fb;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  }
  return fb;
};

function parseOptionalNumber(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : Math.max(0, Math.round(n));
}
function parseOptionalFloat(value: string): number | null {
  const t = value.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

function settingsKey(companyKey: string) {
  return `scc_company_settings_v2:${companyKey}`;
}

function normalizeSettingsFromRaw(obj: Record<string, unknown>, defaults: CompanySettings): CompanySettings {
  const contact = obj.contact && typeof obj.contact === "object" ? (obj.contact as Record<string, unknown>) : {};
  const legalInfo = obj.legal_info && typeof obj.legal_info === "object" ? (obj.legal_info as Record<string, unknown>) : {};
  const paymentTerms = obj.payment_terms && typeof obj.payment_terms === "object" ? (obj.payment_terms as Record<string, unknown>) : {};
  const profileSettings = obj.profile_settings && typeof obj.profile_settings === "object" ? (obj.profile_settings as Record<string, unknown>) : {};

  const opRatesRaw = Array.isArray(obj.operational_area_rates) ? (obj.operational_area_rates as unknown[]) : null;
  const operational_area_rates = opRatesRaw
    ? opRatesRaw
        .map((row, idx) => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          const ratesRaw = r.rates && typeof r.rates === "object" ? (r.rates as Record<string, unknown>) : {};
          const rates: Record<string, number | null> = {};
          for (const [k, v] of Object.entries(ratesRaw)) rates[k] = numOrNull(v, null);
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
          .slice(0, 50)
          .map(([pkgId, v]) => {
            const m = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
            return [
              pkgId,
              { cement: str(m.cement, ""), steel: str(m.steel, ""), bricks: str(m.bricks, ""), wiring: str(m.wiring, ""), plumbing: str(m.plumbing, ""), paint: str(m.paint, "") },
            ] as const;
          }),
      )
    : defaults.materials_used;

  const timelineRaw = obj.timeline_estimates && typeof obj.timeline_estimates === "object" ? (obj.timeline_estimates as Record<string, unknown>) : null;
  const timeline_estimates: CompanySettings["timeline_estimates"] = timelineRaw
    ? Object.fromEntries(
        Object.entries(timelineRaw).map(([plotId, v]) => {
          const t = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
          const single = t.single_storey && typeof t.single_storey === "object" ? (t.single_storey as Record<string, unknown>) : {};
          const dbl = t.double_storey && typeof t.double_storey === "object" ? (t.double_storey as Record<string, unknown>) : {};
          const mk = (src: Record<string, unknown>) => ({ min: floatOrNull(src.min, null), typical: floatOrNull(src.typical, null), max: floatOrNull(src.max, null) });
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
    logo_url: str(obj.logo_url, defaults.logo_url),
    contact: {
      phone: str(contact.phone, defaults.contact.phone),
      email: str(contact.email, defaults.contact.email),
      website: str(contact.website, defaults.contact.website),
      linkedin: str(contact.linkedin, defaults.contact.linkedin),
      facebook: str(contact.facebook, defaults.contact.facebook),
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
      defect_liability_period_months: numOrNull(afterRaw.defect_liability_period_months, defaults.after_handover_support.defect_liability_period_months),
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

function safeLoadSettings(companyKey: string, defaults: CompanySettings): CompanySettings {
  try {
    const raw = localStorage.getItem(settingsKey(companyKey));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return defaults;
    return normalizeSettingsFromRaw(parsed as Record<string, unknown>, defaults);
  } catch {
    return defaults;
  }
}

function defaultSettings(company: CompanyDatasetCompany | null, email: string): CompanySettings {
  return {
    company_name: company?.company_name ?? "",
    description: "",
    logo_url: company?.logo_url ?? "",
    contact: {
      phone: company?.contact?.phone ?? "",
      email: company?.contact?.email ?? email,
      website: company?.contact?.website ?? "",
      linkedin: "",
      facebook: "",
    },
    legal_info: {
      registered: Boolean(company?.legal_info?.registered),
      secp_registered: Boolean(company?.legal_info?.secp_registered),
      ntn: company?.legal_info?.ntn ?? "",
      year_established: typeof company?.legal_info?.year_established === "number" ? company.legal_info.year_established : null,
    },
    payment_terms: {
      advance_percentage: typeof company?.payment_terms?.advance_percentage === "number" ? company.payment_terms.advance_percentage : null,
      installments: company?.payment_terms?.installments ?? "",
      price_type: company?.payment_terms?.price_type ?? "",
      variation_clause: Boolean(company?.payment_terms?.variation_clause),
    },
    profile_settings: { public_profile: true, show_contact: true },
    operational_area_rates: [],
    construction_capability: { plot_sizes: [], max_floors: null, basement_supported: false, house_types: [] },
    services_offered: { construction_services: [], design_services: [], approval_support: [], extra_services: [] },
    materials_used: {},
    timeline_estimates: {},
    timeline_notes: "",
    reliability_score: null,
    experience_track: {
      total_projects_completed: "",
      houses_completed: "",
      ongoing_projects: "",
      specializations: [],
    },
    quality_control: { site_engineer_assigned: false, material_verification: false, weekly_reporting: false },
    after_handover_support: { defect_liability_period_months: null, maintenance_support: false, support_response_time_days: null },
    legal_contract: { written_contract_provided: false, boq_provided: false, penalty_for_delay: false, warranty_duration_years: null },
    ideal_customer_profile: { best_for: [], not_ideal_for: [], accept_terms: false },
  };
}

// ─── Static option lists ───────────────────────────────────────────────────────

const plotSizesMarla = ["1 Marla", "3 Marla", "5 Marla", "7 Marla", "10 Marla", "12 Marla", "15 Marla", "20 Marla"];
const plotSizesKanal = ["1 Kanal (20 Marla)", "2 Kanal (40 Marla)", "3 Kanal (60 Marla)", "4 Kanal (80 Marla)", "5 Kanal (100 Marla)"];
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
const phaseSuggestions = ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5", "Phase 6", "Phase 7", "Phase 8", "Block A", "Block B", "Block C", "Block D", "Sector A", "Sector B"];
const paymentOptions = getPaymentTermOptions(companyDataset);

// ─── SettingsEditor ────────────────────────────────────────────────────────────

function SettingsEditor({ email, companySlug }: { email: string; companySlug?: string }) {
  const { toast } = useToast();
  const company = useMemo(() => getCompanyByEmail(email) ?? null, [email]);
  const companyKey = company?.company_id ?? email;

  const packageIds = useMemo(
    () => (company ? getPackageKeys(company) : ["standard", "premium", "executive"]),
    [company],
  );
  const packages: PackageDef[] = useMemo(
    () =>
      packageIds.map((k) => ({
        id: k,
        label: k === "standard" ? "Standard" : k === "premium" ? "Premium" : k === "executive" ? "Executive" : humanizeToken(k),
      })),
    [packageIds],
  );

  const settingsDefaults = useMemo(() => defaultSettings(company, email), [company, email]);

  const [settings, setSettings] = useState<CompanySettings>(() => safeLoadSettings(companyKey, settingsDefaults));
  const [activePackage, setActivePackage] = useState<string>(packageIds[0] ?? "standard");
  const [loading, setLoading] = useState(!!companySlug);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const profileRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!companySlug) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.companies.getProfile(companySlug)
      .then((profile) => {
        if (cancelled) return;
        profileRef.current = profile as Record<string, unknown>;
        const editorSettings = (profile as Record<string, unknown>)?._editor_settings;
        if (editorSettings && typeof editorSettings === "object") {
          setSettings(normalizeSettingsFromRaw(editorSettings as Record<string, unknown>, settingsDefaults));
        } else {
          setSettings(defaultSettings(profile as CompanyDatasetCompany, email));
        }
      })
      .catch(() => {
        if (cancelled) return;
        toast({ variant: "destructive", title: "Load failed", description: "Could not load settings from server." });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companySlug, email]);

  const toggleInList = (list: string[], value: string, on: boolean) => {
    const c = value.trim();
    if (!c) return list;
    if (on) return Array.from(new Set([...list, c]));
    return list.filter((x) => x !== c);
  };

  const addArea = () => {
    const id = `op-${Date.now()}`;
    const rates: Record<string, number | null> = {};
    for (const p of packages) rates[p.id] = null;
    setSettings((prev) => ({ ...prev, operational_area_rates: [...prev.operational_area_rates, { id, city: "", society: "", phase: "", rates }] }));
  };

  const removeArea = (id: string) =>
    setSettings((prev) => ({ ...prev, operational_area_rates: prev.operational_area_rates.filter((r) => r.id !== id) }));

  const patchArea = (id: string, patch: Partial<CompanySettings["operational_area_rates"][number]>) =>
    setSettings((prev) => ({ ...prev, operational_area_rates: prev.operational_area_rates.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const patchRate = (id: string, pkgId: string, next: number | null) =>
    setSettings((prev) => ({
      ...prev,
      operational_area_rates: prev.operational_area_rates.map((r) =>
        r.id !== id ? r : { ...r, rates: { ...r.rates, [pkgId]: next } },
      ),
    }));

  const updateMaterial = (pkgId: string, field: keyof CompanySettings["materials_used"][string], value: string) =>
    setSettings((prev) => ({
      ...prev,
      materials_used: {
        ...prev.materials_used,
        [pkgId]: { ...(prev.materials_used[pkgId] ?? { cement: "", steel: "", bricks: "", wiring: "", plumbing: "", paint: "" }), [field]: value },
      },
    }));

  const updateTimeline = (plotId: string, storey: "single_storey" | "double_storey", key: "min" | "typical" | "max", value: number | null) =>
    setSettings((prev) => ({
      ...prev,
      timeline_estimates: {
        ...prev.timeline_estimates,
        [plotId]: {
          ...(prev.timeline_estimates[plotId] ?? { single_storey: { min: null, typical: null, max: null }, double_storey: { min: null, typical: null, max: null } }),
          [storey]: {
            ...((prev.timeline_estimates[plotId] ?? {})[storey] ?? { min: null, typical: null, max: null }),
            [key]: value,
          },
        },
      },
    }));

  const save = async () => {
    localStorage.setItem(settingsKey(companyKey), JSON.stringify(settings));

    if (!companySlug) {
      toast({ title: "Saved locally", description: "Settings saved. Link a company profile to sync to server." });
      return;
    }

    setSaving(true);
    try {
      const profileData: Record<string, unknown> = {
        ...(profileRef.current ?? {}),
        company_name: settings.company_name,
        description: settings.description,
        logo_url: settings.logo_url,
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
        _editor_settings: settings,
      };
      await api.companies.updateProfile(companySlug, profileData);
      profileRef.current = profileData;
      toast({ title: "Settings saved", description: "Your company profile has been updated." });
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: err instanceof Error ? err.message : "Could not save to server." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Plot row IDs tied to timeline (use capability plot sizes as proxy)
  const capabilityPlotIds: Record<string, string> = {
    "3 Marla": "3-marla", "5 Marla": "5-marla", "10 Marla": "10-marla",
    "1 Kanal (20 Marla)": "1-kanal", "2 Kanal (40 Marla)": "2-kanal",
  };
  const timelinePlots = settings.construction_capability.plot_sizes
    .map((s) => ({ label: s, id: capabilityPlotIds[s] ?? s.toLowerCase().replace(/[^a-z0-9]/g, "-") }))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your company profile, legal info, contact details, and more.</p>
        </div>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="profile">Company Profile</TabsTrigger>
          <TabsTrigger value="legal">Legal & Registration</TabsTrigger>
          <TabsTrigger value="contact">Contact & Social</TabsTrigger>
          <TabsTrigger value="capability">Capability & Services</TabsTrigger>
          <TabsTrigger value="experience">Experience & QC</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Company Profile ─────────────────────────────────────────── */}
        <TabsContent value="profile" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Basic Information</p>
            <p className="mt-1 text-xs text-muted-foreground">How your company appears to clients on the platform.</p>

            <div className="mt-4 grid gap-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  value={settings.company_name}
                  onChange={(e) => setSettings((prev) => ({ ...prev, company_name: e.target.value }))}
                  className="bg-background/40"
                  placeholder="e.g., Al-Hassan Builders"
                />
              </div>

              <div className="space-y-2">
                <Label>About / Description</Label>
                <Textarea
                  value={settings.description}
                  onChange={(e) => setSettings((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your company, specialties, and what makes you stand out…"
                  className="min-h-[100px] bg-background/40"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">{settings.description.length}/500 characters</p>
              </div>

              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input
                  value={settings.logo_url}
                  onChange={(e) => {
                    setSettings((prev) => ({ ...prev, logo_url: e.target.value }));
                    setLogoPreview(e.target.value);
                  }}
                  className="bg-background/40"
                  placeholder="https://example.com/logo.png"
                  type="url"
                />
                {logoPreview && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-14 w-14 rounded-xl border border-border object-contain"
                      onError={() => setLogoPreview(null)}
                    />
                    <p className="text-xs text-muted-foreground">Logo preview</p>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Visibility Settings</p>
            <p className="mt-1 text-xs text-muted-foreground">Control how clients discover and interact with your profile.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Public profile</p>
                  <p className="text-xs text-muted-foreground">Show in Browse Companies.</p>
                </div>
                <Switch
                  checked={settings.profile_settings.public_profile}
                  onCheckedChange={(v) => setSettings((prev) => ({ ...prev, profile_settings: { ...prev.profile_settings, public_profile: v } }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Show contact info</p>
                  <p className="text-xs text-muted-foreground">Display phone & email to clients.</p>
                </div>
                <Switch
                  checked={settings.profile_settings.show_contact}
                  onCheckedChange={(v) => setSettings((prev) => ({ ...prev, profile_settings: { ...prev.profile_settings, show_contact: v } }))}
                />
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        {/* ── Tab 2: Legal & Registration ────────────────────────────────────── */}
        <TabsContent value="legal" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Legal Registration</p>
            <p className="mt-1 text-xs text-muted-foreground">Registration status affects trust scores and client matching.</p>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Legally registered</p>
                    <p className="text-xs text-muted-foreground">Company registered with authorities.</p>
                  </div>
                  <Switch
                    checked={settings.legal_info.registered}
                    onCheckedChange={(v) => setSettings((prev) => ({ ...prev, legal_info: { ...prev.legal_info, registered: v } }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">SECP registered</p>
                    <p className="text-xs text-muted-foreground">Securities & Exchange Commission of Pakistan.</p>
                  </div>
                  <Switch
                    checked={settings.legal_info.secp_registered}
                    onCheckedChange={(v) => setSettings((prev) => ({ ...prev, legal_info: { ...prev.legal_info, secp_registered: v } }))}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>NTN Number</Label>
                  <Input
                    value={settings.legal_info.ntn}
                    onChange={(e) => setSettings((prev) => ({ ...prev, legal_info: { ...prev.legal_info, ntn: e.target.value } }))}
                    className="bg-background/40"
                    placeholder="e.g., 1234567-8"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Year Established</Label>
                  <Input
                    type="number"
                    value={settings.legal_info.year_established ?? ""}
                    onChange={(e) => setSettings((prev) => ({ ...prev, legal_info: { ...prev.legal_info, year_established: e.target.value.trim() ? Number(e.target.value) : null } }))}
                    className="bg-background/40"
                    placeholder="e.g., 2012"
                    min={1950}
                    max={2026}
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Legal & Contract</p>
            <p className="mt-1 text-xs text-muted-foreground">Contract policies shown to clients during request matching.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { key: "written_contract_provided" as const, label: "Written contract provided", desc: "Formal written agreement for every project." },
                { key: "boq_provided" as const, label: "BOQ provided", desc: "Bill of Quantities shared upfront." },
                { key: "penalty_for_delay" as const, label: "Penalty for delay", desc: "Contract includes delay penalty clauses." },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={settings.legal_contract[key]}
                    onCheckedChange={(v) => setSettings((prev) => ({ ...prev, legal_contract: { ...prev.legal_contract, [key]: v } }))}
                  />
                </div>
              ))}

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Warranty duration</Label>
                <Select
                  value={settings.legal_contract.warranty_duration_years != null ? String(settings.legal_contract.warranty_duration_years) : "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, legal_contract: { ...prev.legal_contract, warranty_duration_years: v === "__none__" ? null : Number(v) } }))}
                >
                  <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select duration" /></SelectTrigger>
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
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Payment Terms</p>
            <p className="mt-1 text-xs text-muted-foreground">How clients will be charged and billed.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Advance payment %</Label>
                <Input
                  type="number" min={0} max={100}
                  value={settings.payment_terms.advance_percentage ?? ""}
                  onChange={(e) => setSettings((prev) => ({ ...prev, payment_terms: { ...prev.payment_terms, advance_percentage: e.target.value.trim() ? Number(e.target.value) : null } }))}
                  className="bg-background/40" placeholder="e.g., 30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Installment type</Label>
                <Select
                  value={settings.payment_terms.installments || "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, payment_terms: { ...prev.payment_terms, installments: v === "__none__" ? "" : v } }))}
                >
                  <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    {paymentOptions.installments.map((o) => <SelectItem key={o} value={o}>{humanizeToken(o)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Price type</Label>
                <Select
                  value={settings.payment_terms.price_type || "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, payment_terms: { ...prev.payment_terms, price_type: v === "__none__" ? "" : v } }))}
                >
                  <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    {paymentOptions.priceTypes.map((o) => <SelectItem key={o} value={o}>{humanizeToken(o)}</SelectItem>)}
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
                  onCheckedChange={(v) => setSettings((prev) => ({ ...prev, payment_terms: { ...prev.payment_terms, variation_clause: v } }))}
                />
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        {/* ── Tab 3: Contact & Social ────────────────────────────────────────── */}
        <TabsContent value="contact" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Contact Information</p>
            <p className="mt-1 text-xs text-muted-foreground">Primary contact details visible to clients.</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={settings.contact.phone}
                  onChange={(e) => setSettings((prev) => ({ ...prev, contact: { ...prev.contact, phone: e.target.value } }))}
                  className="bg-background/40" placeholder="+92-300-1234567"
                />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={settings.contact.email}
                  onChange={(e) => setSettings((prev) => ({ ...prev, contact: { ...prev.contact, email: e.target.value } }))}
                  className="bg-background/40" placeholder="info@company.pk"
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Online Presence</p>
            <p className="mt-1 text-xs text-muted-foreground">Links displayed on your public profile page.</p>

            <div className="mt-4 grid gap-4">
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  type="url"
                  value={settings.contact.website}
                  onChange={(e) => setSettings((prev) => ({ ...prev, contact: { ...prev.contact, website: e.target.value } }))}
                  className="bg-background/40" placeholder="https://yourcompany.pk"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input
                    type="url"
                    value={settings.contact.linkedin}
                    onChange={(e) => setSettings((prev) => ({ ...prev, contact: { ...prev.contact, linkedin: e.target.value } }))}
                    className="bg-background/40" placeholder="https://linkedin.com/company/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Facebook</Label>
                  <Input
                    type="url"
                    value={settings.contact.facebook}
                    onChange={(e) => setSettings((prev) => ({ ...prev, contact: { ...prev.contact, facebook: e.target.value } }))}
                    className="bg-background/40" placeholder="https://facebook.com/..."
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">After-Handover Support</p>
            <p className="mt-1 text-xs text-muted-foreground">Post-project support policies shown to clients.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Defect liability period</Label>
                <Select
                  value={settings.after_handover_support.defect_liability_period_months != null ? String(settings.after_handover_support.defect_liability_period_months) : "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, after_handover_support: { ...prev.after_handover_support, defect_liability_period_months: v === "__none__" ? null : Number(v) } }))}
                >
                  <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select period" /></SelectTrigger>
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
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Support response time</Label>
                <Select
                  value={settings.after_handover_support.support_response_time_days != null ? String(settings.after_handover_support.support_response_time_days) : "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, after_handover_support: { ...prev.after_handover_support, support_response_time_days: v === "__none__" ? null : Number(v) } }))}
                >
                  <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select time" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    <SelectItem value="1">Within 1 Day</SelectItem>
                    <SelectItem value="3">Within 3 Days</SelectItem>
                    <SelectItem value="7">Within 7 Days</SelectItem>
                    <SelectItem value="14">Within 14 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Maintenance support</p>
                  <p className="text-xs text-muted-foreground">Ongoing maintenance availability.</p>
                </div>
                <Switch
                  checked={settings.after_handover_support.maintenance_support}
                  onCheckedChange={(v) => setSettings((prev) => ({ ...prev, after_handover_support: { ...prev.after_handover_support, maintenance_support: v } }))}
                />
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        {/* ── Tab 4: Capability & Services ──────────────────────────────────── */}
        <TabsContent value="capability" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Construction Capability</p>
            <p className="mt-1 text-xs text-muted-foreground">Plot sizes, floors, and house types you can build.</p>

            <div className="mt-4 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Plot sizes (Marla)</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  {plotSizesMarla.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={settings.construction_capability.plot_sizes.includes(opt)}
                        onCheckedChange={(v) => setSettings((prev) => ({ ...prev, construction_capability: { ...prev.construction_capability, plot_sizes: toggleInList(prev.construction_capability.plot_sizes, opt, Boolean(v)) } }))}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Plot sizes (Kanal)</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {plotSizesKanal.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={settings.construction_capability.plot_sizes.includes(opt)}
                        onCheckedChange={(v) => setSettings((prev) => ({ ...prev, construction_capability: { ...prev.construction_capability, plot_sizes: toggleInList(prev.construction_capability.plot_sizes, opt, Boolean(v)) } }))}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Maximum floors</Label>
                  <Select
                    value={settings.construction_capability.max_floors != null ? String(settings.construction_capability.max_floors) : "__none__"}
                    onValueChange={(v) => setSettings((prev) => ({ ...prev, construction_capability: { ...prev.construction_capability, max_floors: v === "__none__" ? null : Number(v) } }))}
                  >
                    <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {maxFloorsOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Basement support</p>
                    <p className="text-xs text-muted-foreground">Can construct basements.</p>
                  </div>
                  <Switch
                    checked={settings.construction_capability.basement_supported}
                    onCheckedChange={(v) => setSettings((prev) => ({ ...prev, construction_capability: { ...prev.construction_capability, basement_supported: v } }))}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">House types</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  {houseTypeOptions.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={settings.construction_capability.house_types.includes(opt)}
                        onCheckedChange={(v) => setSettings((prev) => ({ ...prev, construction_capability: { ...prev.construction_capability, house_types: toggleInList(prev.construction_capability.house_types, opt, Boolean(v)) } }))}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Services Offered</p>
            <p className="mt-1 text-xs text-muted-foreground">All services your company provides.</p>

            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              {[
                { key: "construction_services" as const, label: "Construction Services", opts: constructionServiceOptions },
                { key: "design_services" as const, label: "Design Services", opts: designServiceOptions },
                { key: "approval_support" as const, label: "Approval Support", opts: approvalSupportOptions },
                { key: "extra_services" as const, label: "Extra Services", opts: extraServiceOptions },
              ].map(({ key, label, opts }) => (
                <div key={key}>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <div className="mt-2 grid gap-2">
                    {opts.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={settings.services_offered[key].includes(opt)}
                          onCheckedChange={(v) => setSettings((prev) => ({ ...prev, services_offered: { ...prev.services_offered, [key]: toggleInList(prev.services_offered[key], opt, Boolean(v)) } }))}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {timelinePlots.length > 0 && (
            <GlassCard interactive={false} className="p-5">
              <p className="text-sm font-semibold text-foreground">Timeline Estimates</p>
              <p className="mt-1 text-xs text-muted-foreground">Min / Typical / Max months per plot size (based on capability above).</p>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Plot size</TableHead>
                      <TableHead className="min-w-[13rem]">Single storey (Min / Typ / Max)</TableHead>
                      <TableHead className="min-w-[13rem]">Double storey (Min / Typ / Max)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timelinePlots.map((r) => {
                      const t = settings.timeline_estimates[r.id] ?? {
                        single_storey: { min: null, typical: null, max: null },
                        double_storey: { min: null, typical: null, max: null },
                      };
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium text-foreground">{r.label}</TableCell>
                          {(["single_storey", "double_storey"] as const).map((storey) => (
                            <TableCell key={storey}>
                              <div className="grid grid-cols-3 gap-2">
                                {(["min", "typical", "max"] as const).map((k) => (
                                  <Input
                                    key={k}
                                    type="number" min={0} step={0.5}
                                    value={t[storey][k] ?? ""}
                                    onChange={(e) => updateTimeline(r.id, storey, k, parseOptionalFloat(e.target.value))}
                                    className="bg-background/40" placeholder={k.charAt(0).toUpperCase() + k.slice(1)}
                                  />
                                ))}
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 space-y-2">
                <Label className="text-xs text-muted-foreground">Timeline notes</Label>
                <Textarea
                  value={settings.timeline_notes}
                  onChange={(e) => setSettings((prev) => ({ ...prev, timeline_notes: e.target.value }))}
                  className="bg-background/40" placeholder="Any caveats or conditions affecting timelines…"
                />
              </div>
            </GlassCard>
          )}
        </TabsContent>

        {/* ── Tab 5: Experience & QC ─────────────────────────────────────────── */}
        <TabsContent value="experience" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Track Record</p>
            <p className="mt-1 text-xs text-muted-foreground">Your project history and specializations.</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Total projects completed</Label>
                <Select
                  value={settings.experience_track.total_projects_completed || "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, experience_track: { ...prev.experience_track, total_projects_completed: v === "__none__" ? "" : v } }))}
                >
                  <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select range" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    {["0-5", "6-20", "21-50", "51-100", "100+"].map((v) => <SelectItem key={v} value={v}>{v} Projects</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Houses completed</Label>
                <Select
                  value={settings.experience_track.houses_completed || "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, experience_track: { ...prev.experience_track, houses_completed: v === "__none__" ? "" : v } }))}
                >
                  <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select range" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    {["0-10", "11-30", "31-100", "101-500", "500+"].map((v) => <SelectItem key={v} value={v}>{v} Houses</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Ongoing projects</Label>
                <Select
                  value={settings.experience_track.ongoing_projects || "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, experience_track: { ...prev.experience_track, ongoing_projects: v === "__none__" ? "" : v } }))}
                >
                  <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    {["0", "1-3", "4-10", "11-20", "20+"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Reliability score (0–1)</Label>
                <Input
                  type="number" min={0} max={1} step={0.1}
                  value={settings.reliability_score ?? ""}
                  onChange={(e) => {
                    const n = parseOptionalFloat(e.target.value);
                    setSettings((prev) => ({ ...prev, reliability_score: n == null ? null : Math.max(0, Math.min(1, n)) }));
                  }}
                  className="bg-background/40" placeholder="e.g., 0.85"
                />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold text-foreground">Specializations</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                {specializationOptions.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={settings.experience_track.specializations.includes(opt)}
                      onCheckedChange={(v) => setSettings((prev) => ({ ...prev, experience_track: { ...prev.experience_track, specializations: toggleInList(prev.experience_track.specializations, opt, Boolean(v)) } }))}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Quality Control</p>
            <p className="mt-1 text-xs text-muted-foreground">On-site practices that build client trust.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { key: "site_engineer_assigned" as const, label: "Site engineer assigned", desc: "Dedicated engineer on every project." },
                { key: "material_verification" as const, label: "Material verification", desc: "Verify materials on delivery." },
                { key: "weekly_reporting" as const, label: "Weekly reporting", desc: "Send progress reports to clients." },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={settings.quality_control[key]}
                    onCheckedChange={(v) => setSettings((prev) => ({ ...prev, quality_control: { ...prev.quality_control, [key]: v } }))}
                  />
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Ideal Customer Profile</p>
            <p className="mt-1 text-xs text-muted-foreground">Help clients self-qualify before reaching out.</p>

            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-foreground">Best for</p>
                <div className="mt-2 grid gap-2">
                  {bestForOptions.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={settings.ideal_customer_profile.best_for.includes(opt)}
                        onCheckedChange={(v) => setSettings((prev) => ({ ...prev, ideal_customer_profile: { ...prev.ideal_customer_profile, best_for: toggleInList(prev.ideal_customer_profile.best_for, opt, Boolean(v)) } }))}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Not ideal for</p>
                <div className="mt-2 grid gap-2">
                  {notIdealForOptions.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={settings.ideal_customer_profile.not_ideal_for.includes(opt)}
                        onCheckedChange={(v) => setSettings((prev) => ({ ...prev, ideal_customer_profile: { ...prev.ideal_customer_profile, not_ideal_for: toggleInList(prev.ideal_customer_profile.not_ideal_for, opt, Boolean(v)) } }))}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={settings.ideal_customer_profile.accept_terms}
                  onCheckedChange={(v) => setSettings((prev) => ({ ...prev, ideal_customer_profile: { ...prev.ideal_customer_profile, accept_terms: Boolean(v) } }))}
                />
                I accept the platform Terms & Conditions
              </label>
              <p className="mt-1 text-xs text-muted-foreground">Required for publishing your profile publicly.</p>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  if (!user || user.role !== "company") {
    return (
      <GlassCard interactive={false} className="p-6">
        <p className="text-sm text-muted-foreground">Settings are only available for company accounts.</p>
      </GlassCard>
    );
  }
  return <SettingsEditor email={user.email} companySlug={user.companyFile} />;
}
