import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

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
import { ArrowLeft, Eye, EyeOff, FileCheck, Loader2, Lock, MapPin, Plus, Save, Shield, Upload, User, X } from "lucide-react";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type PackageDef = { id: string; label: string };

type CompanySettings = {
  company_name: string;
  description: string;
  city: string;
  logo_url: string;
  dp_url: string;
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
  verification_documents: {
    secp_certificate_url: string;
    ntn_certificate_url: string;
    registration_certificate_url: string;
    cnic_front_url: string;
    cnic_back_url: string;
    other_document_url: string;
    verification_status: string; // "not_submitted" | "pending" | "verified" | "rejected"
    verification_notes: string;
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
    city: str(obj.city, defaults.city),
    logo_url: str(obj.logo_url, defaults.logo_url),
    dp_url: str(obj.dp_url, defaults.dp_url),
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
    verification_documents: (() => {
      const vdRaw = obj.verification_documents && typeof obj.verification_documents === "object" ? (obj.verification_documents as Record<string, unknown>) : {};
      return {
        secp_certificate_url: str(vdRaw.secp_certificate_url, defaults.verification_documents.secp_certificate_url),
        ntn_certificate_url: str(vdRaw.ntn_certificate_url, defaults.verification_documents.ntn_certificate_url),
        registration_certificate_url: str(vdRaw.registration_certificate_url, defaults.verification_documents.registration_certificate_url),
        cnic_front_url: str(vdRaw.cnic_front_url, defaults.verification_documents.cnic_front_url),
        cnic_back_url: str(vdRaw.cnic_back_url, defaults.verification_documents.cnic_back_url),
        other_document_url: str(vdRaw.other_document_url, defaults.verification_documents.other_document_url),
        verification_status: str(vdRaw.verification_status, defaults.verification_documents.verification_status),
        verification_notes: str(vdRaw.verification_notes, defaults.verification_documents.verification_notes),
      };
    })(),
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
    city: (company as Record<string, unknown>)?.city as string ?? "",
    logo_url: company?.logo_url ?? "",    
    dp_url: "",
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
    verification_documents: {
      secp_certificate_url: "",
      ntn_certificate_url: "",
      registration_certificate_url: "",
      cnic_front_url: "",
      cnic_back_url: "",
      other_document_url: "",
      verification_status: "not_submitted",
      verification_notes: "",
    },
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
  const navigate = useNavigate();
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
  const profileRef = useRef<Record<string, unknown> | null>(null);
  const dpInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Password change state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd) {
      toast({ title: "Missing fields", description: "Please fill in all password fields.", variant: "destructive" });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast({ title: "Passwords don't match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }
    if (newPwd.length < 8) {
      toast({ title: "Password too short", description: "New password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setSavingPwd(true);
    try {
      await api.auth.changePassword(currentPwd, newPwd);
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setSavingPwd(false);
  };

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

  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const setCustomInput = (key: string, value: string) => setCustomInputs((prev) => ({ ...prev, [key]: value }));

  /** Render a list of checkboxes with an "Other (custom)" text input at the end. */
  function CheckboxListWithCustom({
    fieldKey,
    options,
    selected,
    onToggle,
    columns = "sm:grid-cols-4",
  }: {
    fieldKey: string;
    options: string[];
    selected: string[];
    onToggle: (value: string, on: boolean) => void;
    columns?: string;
  }) {
    const customValues = selected.filter((v) => !options.includes(v));
    const inputKey = `chk-${fieldKey}`;
    return (
      <div className={`mt-2 grid gap-2 ${columns}`}>
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked={selected.includes(opt)} onCheckedChange={(v) => onToggle(opt, Boolean(v))} />
            {opt}
          </label>
        ))}
        {customValues.map((cv) => (
          <label key={cv} className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked onCheckedChange={() => onToggle(cv, false)} />
            <span className="text-primary">{cv}</span>
          </label>
        ))}
        <div className="flex items-center gap-2 col-span-full">
          <Input
            value={customInputs[inputKey] ?? ""}
            onChange={(e) => setCustomInput(inputKey, e.target.value)}
            placeholder="Other (type custom)…"
            className="bg-background/40 h-8 text-xs max-w-[14rem]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const val = (customInputs[inputKey] ?? "").trim();
                if (val && !selected.includes(val)) {
                  onToggle(val, true);
                  setCustomInput(inputKey, "");
                }
              }
            }}
          />
          <Button
            type="button" variant="secondary" size="sm" className="h-8 px-2"
            disabled={!(customInputs[inputKey] ?? "").trim()}
            onClick={() => {
              const val = (customInputs[inputKey] ?? "").trim();
              if (val && !selected.includes(val)) {
                onToggle(val, true);
                setCustomInput(inputKey, "");
              }
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  /** Select dropdown with a "Custom…" option that reveals an inline text input. */
  function SelectWithCustom({
    value,
    onValueChange,
    placeholder = "Select",
    notSetLabel = "Not set",
    options,
    className = "bg-background/40",
  }: {
    value: string;
    onValueChange: (v: string) => void;
    placeholder?: string;
    notSetLabel?: string;
    options: { value: string; label: string }[];
    className?: string;
  }) {
    const [customMode, setCustomMode] = useState(false);
    const knownValues = useMemo(() => new Set(options.map((o) => o.value)), [options]);
    const isCustom = customMode || (value !== "__none__" && value !== "" && !knownValues.has(value));

    if (isCustom) {
      return (
        <div className="flex items-center gap-2">
          <Input
            value={value === "__none__" ? "" : value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="Type custom value…"
            className={`${className} h-9 text-sm flex-1`}
            autoFocus
          />
          <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-xs text-muted-foreground" onClick={() => { setCustomMode(false); onValueChange("__none__"); }}>
            Cancel
          </Button>
        </div>
      );
    }
    return (
      <Select value={value} onValueChange={(v) => { if (v === "__custom__") { setCustomMode(true); onValueChange(""); } else { onValueChange(v); } }}>
        <SelectTrigger className={className}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{notSetLabel}</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          <SelectItem value="__custom__" className="text-primary">Custom…</SelectItem>
        </SelectContent>
      </Select>
    );
  }

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
        city: settings.city,
        logo_url: settings.logo_url,
        dp_url: settings.dp_url,
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
        verification_documents: settings.verification_documents,
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your company profile, legal info, contact details, and more.</p>
        </div>
        <div className="flex items-center gap-2">
          {company && (
            <Button type="button" variant="outline" onClick={() => navigate(`/companies/${company.company_id}`)}>
              <Eye className="h-4 w-4" />
              Preview Profile
            </Button>
          )}
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="profile">Company Profile</TabsTrigger>
          <TabsTrigger value="legal">Legal & Registration</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="contact">Contact & Social</TabsTrigger>
          <TabsTrigger value="capability">Capability & Services</TabsTrigger>
          <TabsTrigger value="experience">Experience & QC</TabsTrigger>
          <TabsTrigger value="account" className="gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Account &amp; Security
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Company Profile ─────────────────────────────────────────── */}
        <TabsContent value="profile" className="mt-6 space-y-4">
          {/* LinkedIn-style Profile Header */}
          <GlassCard interactive={false} className="overflow-hidden p-0">
            {/* Cover / Display Picture */}
            <div className="relative h-40 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent sm:h-48">
              {settings.dp_url && (
                <img
                  src={settings.dp_url}
                  alt="Cover"
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
              <div className="absolute right-3 top-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-background/70 backdrop-blur-sm"
                  onClick={() => dpInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {settings.dp_url ? "Change Cover" : "Add Cover Photo"}
                </Button>
                <input
                  ref={dpInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const url = await api.upload.image(file, settings.company_name || email, "dp", "company");
                      setSettings((prev) => ({ ...prev, dp_url: url }));
                      toast({ title: "Cover photo updated" });
                    } catch { toast({ variant: "destructive", title: "Upload failed" }); }
                    if (dpInputRef.current) dpInputRef.current.value = "";
                  }}
                />
              </div>
            </div>
            {/* Profile Picture + Name */}
            <div className="relative px-5 pb-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
                <div className="-mt-12 relative shrink-0">
                  <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-background bg-background shadow-lg">
                    {settings.logo_url ? (
                      <img src={settings.logo_url} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-secondary text-muted-foreground">
                        <Upload className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full p-0 shadow"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const url = await api.upload.image(file, settings.company_name || email, "profile", "company");
                        setSettings((prev) => ({ ...prev, logo_url: url }));
                        toast({ title: "Profile picture updated" });
                      } catch { toast({ variant: "destructive", title: "Upload failed" }); }
                      if (logoInputRef.current) logoInputRef.current.value = "";
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1 pt-2">
                  <Input
                    value={settings.company_name}
                    onChange={(e) => setSettings((prev) => ({ ...prev, company_name: e.target.value }))}
                    className="border-none bg-transparent p-0 text-xl font-bold text-foreground shadow-none focus-visible:ring-0 h-auto"
                    placeholder="Company Name"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{email}</p>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">About</p>
            <p className="mt-1 text-xs text-muted-foreground">Tell clients what your company does and what makes you stand out.</p>
            <div className="mt-3 space-y-2">
              <Textarea
                value={settings.description}
                onChange={(e) => setSettings((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your company, specialties, and what makes you stand out…"
                className="min-h-[100px] bg-background/40"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">{settings.description.length}/500 characters</p>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Head Office Location</p>
            <p className="mt-1 text-xs text-muted-foreground">Primary city where your company is based.</p>
            <div className="mt-3">
              <Label>City</Label>
              <Select
                value={settings.city || "__none__"}
                onValueChange={(v) => setSettings((prev) => ({ ...prev, city: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger className="mt-1 bg-background/40"><SelectValue placeholder="Select city" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not set</SelectItem>
                  {(cityOptions as readonly string[]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
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
                <SelectWithCustom
                  value={settings.legal_contract.warranty_duration_years != null ? String(settings.legal_contract.warranty_duration_years) : "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, legal_contract: { ...prev.legal_contract, warranty_duration_years: v === "__none__" || v === "" ? null : Number(v) || null } }))}
                  placeholder="Select duration"
                  options={[
                    { value: "1", label: "1 Year" },
                    { value: "2", label: "2 Years" },
                    { value: "5", label: "5 Years" },
                    { value: "10", label: "10 Years" },
                  ]}
                />
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
                <SelectWithCustom
                  value={settings.payment_terms.installments || "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, payment_terms: { ...prev.payment_terms, installments: v === "__none__" ? "" : v } }))}
                  options={paymentOptions.installments.map((o) => ({ value: o, label: humanizeToken(o) }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Price type</Label>
                <SelectWithCustom
                  value={settings.payment_terms.price_type || "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, payment_terms: { ...prev.payment_terms, price_type: v === "__none__" ? "" : v } }))}
                  options={paymentOptions.priceTypes.map((o) => ({ value: o, label: humanizeToken(o) }))}
                />
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

        {/* ── Tab: Verification ──────────────────────────────────────────────── */}
        <TabsContent value="verification" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <Shield className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold text-foreground">Company Verification</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload legal documents to verify your company. Verified companies get higher trust scores and better visibility to clients. Admin will review your documents.
            </p>

            {/* Verification Status Banner */}
            <div className={cn(
              "mt-4 flex items-center gap-3 rounded-2xl border p-4",
              settings.verification_documents.verification_status === "verified" && "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
              settings.verification_documents.verification_status === "pending" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
              settings.verification_documents.verification_status === "rejected" && "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
              settings.verification_documents.verification_status === "not_submitted" && "border-border bg-background/30 text-muted-foreground",
            )}>
              <FileCheck className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  {settings.verification_documents.verification_status === "verified" && "Verified — Your company is verified."}
                  {settings.verification_documents.verification_status === "pending" && "Pending Review — Documents submitted, awaiting admin review."}
                  {settings.verification_documents.verification_status === "rejected" && "Rejected — Please re-upload corrected documents."}
                  {settings.verification_documents.verification_status === "not_submitted" && "Not Submitted — Upload your documents below to start verification."}
                </p>
                {settings.verification_documents.verification_notes && (
                  <p className="mt-1 text-xs opacity-80">Note: {settings.verification_documents.verification_notes}</p>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Document upload cards */}
          {[
            { key: "registration_certificate_url" as const, docType: "registration_certificate", label: "Company Registration Certificate", desc: "Official registration document from relevant authority (FBR, provincial registrar, etc.)." },
            { key: "secp_certificate_url" as const, docType: "secp_certificate", label: "SECP Certificate", desc: "Securities and Exchange Commission of Pakistan certificate (if registered)." },
            { key: "ntn_certificate_url" as const, docType: "ntn_certificate", label: "NTN Certificate", desc: "National Tax Number certificate from FBR." },
            { key: "cnic_front_url" as const, docType: "cnic_front", label: "Owner CNIC — Front", desc: "Front side of the company owner's CNIC / National ID Card." },
            { key: "cnic_back_url" as const, docType: "cnic_back", label: "Owner CNIC — Back", desc: "Back side of the company owner's CNIC / National ID Card." },
            { key: "other_document_url" as const, docType: "other_document", label: "Other Supporting Document", desc: "Any additional document that proves legitimacy (e.g., PEC certificate, trade license)." },
          ].map(({ key, docType, label, desc }) => {
            const currentUrl = settings.verification_documents[key];
            return (
              <GlassCard key={key} interactive={false} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {currentUrl ? (
                      <>
                        <Badge variant="secondary" className="gap-1.5">
                          <FileCheck className="h-3 w-3" />
                          Uploaded
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(currentUrl, "_blank")}
                        >
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setSettings((prev) => ({
                            ...prev,
                            verification_documents: { ...prev.verification_documents, [key]: "", verification_status: "not_submitted" },
                          }))}
                        >
                          <X className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Not uploaded</Badge>
                    )}
                  </div>
                </div>

                {/* Upload area */}
                <div className="mt-3">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/30 p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5">
                    <Upload className="h-4 w-4" />
                    {currentUrl ? "Replace document" : "Upload document"}
                    <span className="text-xs">(PDF, JPEG, PNG · Max 10 MB)</span>
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await api.upload.document(file, settings.company_name || email, docType, "company");
                          setSettings((prev) => ({
                            ...prev,
                            verification_documents: { ...prev.verification_documents, [key]: url, verification_status: "pending" },
                          }));
                          toast({ title: "Document uploaded", description: `${label} uploaded successfully.` });
                        } catch (err) {
                          toast({ variant: "destructive", title: "Upload failed", description: err instanceof Error ? err.message : "Could not upload document." });
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </GlassCard>
            );
          })}
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
                <SelectWithCustom
                  value={settings.after_handover_support.defect_liability_period_months != null ? String(settings.after_handover_support.defect_liability_period_months) : "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, after_handover_support: { ...prev.after_handover_support, defect_liability_period_months: v === "__none__" || v === "" ? null : Number(v) || null } }))}
                  placeholder="Select period"
                  options={[
                    { value: "0", label: "No Warranty" },
                    { value: "6", label: "6 Months" },
                    { value: "12", label: "12 Months" },
                    { value: "24", label: "24 Months" },
                    { value: "36", label: "36 Months" },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Support response time</Label>
                <SelectWithCustom
                  value={settings.after_handover_support.support_response_time_days != null ? String(settings.after_handover_support.support_response_time_days) : "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, after_handover_support: { ...prev.after_handover_support, support_response_time_days: v === "__none__" || v === "" ? null : Number(v) || null } }))}
                  placeholder="Select time"
                  options={[
                    { value: "1", label: "Within 1 Day" },
                    { value: "3", label: "Within 3 Days" },
                    { value: "7", label: "Within 7 Days" },
                    { value: "14", label: "Within 14 Days" },
                  ]}
                />
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
                <CheckboxListWithCustom
                  fieldKey="plot_sizes_marla"
                  options={plotSizesMarla}
                  selected={settings.construction_capability.plot_sizes}
                  onToggle={(opt, v) => setSettings((prev) => ({ ...prev, construction_capability: { ...prev.construction_capability, plot_sizes: toggleInList(prev.construction_capability.plot_sizes, opt, v) } }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Plot sizes (Kanal)</Label>
                <CheckboxListWithCustom
                  fieldKey="plot_sizes_kanal"
                  options={plotSizesKanal}
                  columns="sm:grid-cols-3"
                  selected={settings.construction_capability.plot_sizes}
                  onToggle={(opt, v) => setSettings((prev) => ({ ...prev, construction_capability: { ...prev.construction_capability, plot_sizes: toggleInList(prev.construction_capability.plot_sizes, opt, v) } }))}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Maximum floors</Label>
                  <SelectWithCustom
                    value={settings.construction_capability.max_floors != null ? String(settings.construction_capability.max_floors) : "__none__"}
                    onValueChange={(v) => setSettings((prev) => ({ ...prev, construction_capability: { ...prev.construction_capability, max_floors: v === "__none__" || v === "" ? null : Number(v) || null } }))}
                    options={maxFloorsOptions}
                  />
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
                <CheckboxListWithCustom
                  fieldKey="house_types"
                  options={houseTypeOptions}
                  selected={settings.construction_capability.house_types}
                  onToggle={(opt, v) => setSettings((prev) => ({ ...prev, construction_capability: { ...prev.construction_capability, house_types: toggleInList(prev.construction_capability.house_types, opt, v) } }))}
                />
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
                  <CheckboxListWithCustom
                    fieldKey={`svc-${key}`}
                    options={opts}
                    selected={settings.services_offered[key]}
                    onToggle={(opt, v) => setSettings((prev) => ({ ...prev, services_offered: { ...prev.services_offered, [key]: toggleInList(prev.services_offered[key], opt, v) } }))}
                    columns="sm:grid-cols-1"
                  />
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

          {/* Operational Area Rates */}
          <GlassCard interactive={false} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Operational Area Rates</p>
                <p className="mt-1 text-xs text-muted-foreground">Set per-sqft pricing for each city/society/phase by package.</p>
              </div>
              <Button type="button" size="sm" onClick={addArea}>
                <Plus className="h-3.5 w-3.5" />
                Add Area
              </Button>
            </div>

            {settings.operational_area_rates.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-background/20 py-8 text-center">
                <MapPin className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No operational areas yet. Click "Add Area" to set pricing.</p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">City</TableHead>
                      <TableHead className="w-36">Society / Area</TableHead>
                      <TableHead className="w-28">Phase</TableHead>
                      {packages.map((p) => (
                        <TableHead key={p.id} className="min-w-[7rem]">{p.label} (PKR/sqft)</TableHead>
                      ))}
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.operational_area_rates.map((row) => {
                      const citySocieties = row.city && societiesByCity[row.city] ? societiesByCity[row.city] : [];
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Select
                              value={row.city || "__none__"}
                              onValueChange={(v) => patchArea(row.id, { city: v === "__none__" ? "" : v, society: "", phase: "" })}
                            >
                              <SelectTrigger className="bg-background/40 h-8 text-xs">
                                <SelectValue placeholder="City" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Select</SelectItem>
                                {(cityOptions as readonly string[]).map((c) => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {citySocieties.length > 0 ? (
                              <Select
                                value={row.society || "__none__"}
                                onValueChange={(v) => patchArea(row.id, { society: v === "__none__" ? "" : v })}
                              >
                                <SelectTrigger className="bg-background/40 h-8 text-xs">
                                  <SelectValue placeholder="Society" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Select</SelectItem>
                                  {citySocieties.map((s: string) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={row.society}
                                onChange={(e) => patchArea(row.id, { society: e.target.value })}
                                className="bg-background/40 h-8 text-xs"
                                placeholder="Society"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.phase}
                              onChange={(e) => patchArea(row.id, { phase: e.target.value })}
                              className="bg-background/40 h-8 text-xs"
                              placeholder="Phase"
                              list={`phase-sugg-${row.id}`}
                            />
                            <datalist id={`phase-sugg-${row.id}`}>
                              {phaseSuggestions.map((s) => <option key={s} value={s} />)}
                            </datalist>
                          </TableCell>
                          {packages.map((p) => (
                            <TableCell key={p.id}>
                              <Input
                                type="number"
                                min={0}
                                value={row.rates[p.id] ?? ""}
                                onChange={(e) => patchRate(row.id, p.id, parseOptionalNumber(e.target.value))}
                                className="bg-background/40 h-8 text-xs"
                                placeholder="0"
                              />
                            </TableCell>
                          ))}
                          <TableCell>
                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeArea(row.id)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </GlassCard>

          {/* Materials Used per Package */}
          {packages.length > 0 && (
            <GlassCard interactive={false} className="p-5">
              <p className="text-sm font-semibold text-foreground">Materials Used</p>
              <p className="mt-1 text-xs text-muted-foreground">Specify brand/type of materials used in each package.</p>

              <div className="mt-4">
                <Tabs value={activePackage} onValueChange={setActivePackage}>
                  <TabsList className="flex h-auto flex-wrap gap-1">
                    {packages.map((p) => (
                      <TabsTrigger key={p.id} value={p.id}>{p.label}</TabsTrigger>
                    ))}
                  </TabsList>

                  {packages.map((p) => {
                    const mat = settings.materials_used[p.id] ?? { cement: "", steel: "", bricks: "", wiring: "", plumbing: "", paint: "" };
                    return (
                      <TabsContent key={p.id} value={p.id} className="mt-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {(["cement", "steel", "bricks", "wiring", "plumbing", "paint"] as const).map((field) => (
                            <div key={field} className="space-y-1">
                              <Label className="text-xs capitalize text-muted-foreground">{field}</Label>
                              <Input
                                value={mat[field]}
                                onChange={(e) => updateMaterial(p.id, field, e.target.value)}
                                className="bg-background/40"
                                placeholder={`e.g., ${field === "cement" ? "Bestway / Lucky" : field === "steel" ? "Amreli TOR 60G" : field === "bricks" ? "A+ Red Bricks" : field === "wiring" ? "Pak Cable 7/29" : field === "plumbing" ? "Master / Grohe" : "ICI Dulux / Berger"}`}
                              />
                            </div>
                          ))}
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
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
                <SelectWithCustom
                  value={settings.experience_track.total_projects_completed || "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, experience_track: { ...prev.experience_track, total_projects_completed: v === "__none__" ? "" : v } }))}
                  placeholder="Select range"
                  options={["0-5", "6-20", "21-50", "51-100", "100+"].map((v) => ({ value: v, label: `${v} Projects` }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Houses completed</Label>
                <SelectWithCustom
                  value={settings.experience_track.houses_completed || "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, experience_track: { ...prev.experience_track, houses_completed: v === "__none__" ? "" : v } }))}
                  placeholder="Select range"
                  options={["0-10", "11-30", "31-100", "101-500", "500+"].map((v) => ({ value: v, label: `${v} Houses` }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Ongoing projects</Label>
                <SelectWithCustom
                  value={settings.experience_track.ongoing_projects || "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, experience_track: { ...prev.experience_track, ongoing_projects: v === "__none__" ? "" : v } }))}
                  options={["0", "1-3", "4-10", "11-20", "20+"].map((v) => ({ value: v, label: v }))}
                />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold text-foreground">Specializations</p>
              <CheckboxListWithCustom
                fieldKey="specializations"
                options={specializationOptions}
                selected={settings.experience_track.specializations}
                onToggle={(opt, v) => setSettings((prev) => ({ ...prev, experience_track: { ...prev.experience_track, specializations: toggleInList(prev.experience_track.specializations, opt, v) } }))}
              />
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
                <CheckboxListWithCustom
                  fieldKey="best_for"
                  options={bestForOptions}
                  columns="sm:grid-cols-1"
                  selected={settings.ideal_customer_profile.best_for}
                  onToggle={(opt, v) => setSettings((prev) => ({ ...prev, ideal_customer_profile: { ...prev.ideal_customer_profile, best_for: toggleInList(prev.ideal_customer_profile.best_for, opt, v) } }))}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Not ideal for</p>
                <CheckboxListWithCustom
                  fieldKey="not_ideal_for"
                  options={notIdealForOptions}
                  columns="sm:grid-cols-1"
                  selected={settings.ideal_customer_profile.not_ideal_for}
                  onToggle={(opt, v) => setSettings((prev) => ({ ...prev, ideal_customer_profile: { ...prev.ideal_customer_profile, not_ideal_for: toggleInList(prev.ideal_customer_profile.not_ideal_for, opt, v) } }))}
                />
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

        {/* ── Account & Security ── */}
        <TabsContent value="account" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5 space-y-2">
            <p className="text-sm font-semibold text-foreground">Account Info</p>
            <div className="grid gap-3 rounded-xl border border-border/40 bg-background/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="font-medium capitalize text-foreground">Construction Company</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Change Password</p>
              <p className="mt-1 text-xs text-muted-foreground">Use a strong password of at least 8 characters.</p>
            </div>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <div className="relative">
                  <Input type={showCurrentPwd ? "text" : "password"} value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Enter current password" className="bg-background/40 pr-10" />
                  <button type="button" onClick={() => setShowCurrentPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <div className="relative">
                  <Input type={showNewPwd ? "text" : "password"} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="At least 8 characters" className="bg-background/40 pr-10" />
                  <button type="button" onClick={() => setShowNewPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Confirm New Password</Label>
                <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Repeat new password" className="bg-background/40" />
                {confirmPwd && newPwd !== confirmPwd && <p className="text-xs text-destructive">Passwords do not match.</p>}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleChangePassword} disabled={savingPwd || !currentPwd || !newPwd || newPwd !== confirmPwd} className="gap-2">
                {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Change Password
              </Button>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Supplier Settings ─────────────────────────────────────────────────────────

type SupplierSettings = {
  supplier_name: string;
  description: string;
  logo_url: string;
  dp_url: string;
  city: string;
  area: string;
  cities_served: string[];
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
    accepted_payments: string[];
    minimum_order_value: number | null;
  };
  delivery_info: {
    delivery_time_days: number | null;
    delivery_charges: string;
    free_delivery_above: number | null;
  };
  status: string;
  material_categories: string[];
  profile_settings: {
    public_profile: boolean;
    show_contact: boolean;
  };
  verification_documents: {
    secp_certificate_url: string;
    ntn_certificate_url: string;
    registration_certificate_url: string;
    cnic_front_url: string;
    cnic_back_url: string;
    other_document_url: string;
    verification_status: string;
    verification_notes: string;
  };
};

const supplierSettingsStorageKey = (key: string) => `scc_supplier_settings_v1:${key}`;

function defaultSupplierSettings(profile: Record<string, unknown> | null, email: string): SupplierSettings {
  const contact = profile?.contact && typeof profile.contact === "object" ? (profile.contact as Record<string, unknown>) : {};
  const editorSettings = profile?._editor_settings && typeof profile._editor_settings === "object" ? (profile._editor_settings as Record<string, unknown>) : {};
  const editorContact = editorSettings.contact && typeof editorSettings.contact === "object" ? (editorSettings.contact as Record<string, unknown>) : {};
  const editorLegal = editorSettings.legal_info && typeof editorSettings.legal_info === "object" ? (editorSettings.legal_info as Record<string, unknown>) : {};
  const editorProfile = editorSettings.profile_settings && typeof editorSettings.profile_settings === "object" ? (editorSettings.profile_settings as Record<string, unknown>) : {};
  const editorPayment = editorSettings.payment_terms && typeof editorSettings.payment_terms === "object" ? (editorSettings.payment_terms as Record<string, unknown>) : {};
  const editorDelivery = editorSettings.delivery_info && typeof editorSettings.delivery_info === "object" ? (editorSettings.delivery_info as Record<string, unknown>) : {};
  return {
    supplier_name: str(profile?.supplier_name, ""),
    description: str(profile?.description, ""),
    logo_url: str(profile?.logo_url, ""),
    dp_url: str(profile?.dp_url, ""),
    city: str(profile?.city, ""),
    area: str(profile?.area, ""),
    cities_served: strArr(profile?.cities_served, []),
    contact: {
      phone: str(contact.phone, ""),
      email: str(contact.email, email),
      website: str(contact.website, ""),
      linkedin: str(editorContact.linkedin, ""),
      facebook: str(editorContact.facebook, ""),
    },
    legal_info: {
      registered: bool(editorLegal.registered, false),
      secp_registered: bool(editorLegal.secp_registered, false),
      ntn: str(editorLegal.ntn, ""),
      year_established: numOrNull(editorLegal.year_established, null),
    },
    payment_terms: {
      advance_percentage: numOrNull(editorPayment.advance_percentage, null),
      accepted_payments: strArr(editorPayment.accepted_payments, []),
      minimum_order_value: numOrNull(editorPayment.minimum_order_value, null),
    },
    delivery_info: {
      delivery_time_days: numOrNull(editorDelivery.delivery_time_days, null),
      delivery_charges: str(editorDelivery.delivery_charges, ""),
      free_delivery_above: numOrNull(editorDelivery.free_delivery_above, null),
    },
    status: str(profile?.status ?? editorSettings.status, "active"),
    material_categories: strArr(editorSettings.material_categories, []),
    profile_settings: {
      public_profile: bool(editorProfile.public_profile, true),
      show_contact: bool(editorProfile.show_contact, true),
    },
    verification_documents: (() => {
      const vdRaw = editorSettings.verification_documents && typeof editorSettings.verification_documents === "object" ? (editorSettings.verification_documents as Record<string, unknown>) : {};
      return {
        secp_certificate_url: str(vdRaw.secp_certificate_url, ""),
        ntn_certificate_url: str(vdRaw.ntn_certificate_url, ""),
        registration_certificate_url: str(vdRaw.registration_certificate_url, ""),
        cnic_front_url: str(vdRaw.cnic_front_url, ""),
        cnic_back_url: str(vdRaw.cnic_back_url, ""),
        other_document_url: str(vdRaw.other_document_url, ""),
        verification_status: str(vdRaw.verification_status, "not_submitted"),
        verification_notes: str(vdRaw.verification_notes, ""),
      };
    })(),
  };
}

const supplierCityOptions = [
  "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad",
  "Multan", "Peshawar", "Quetta", "Hyderabad", "Gujranwala", "Sialkot", "Bahawalpur",
];

const materialCategoryOptions = [
  "Cement", "Steel / Rebar", "Bricks & Blocks", "Sand & Aggregate", "Tiles & Flooring",
  "Paint & Finishes", "Electrical", "Plumbing", "Glass & Windows", "Doors & Frames",
  "Wood & Lumber", "Roofing Materials", "Insulation", "Chemicals & Adhesives",
];

function SupplierSettingsEditor({ email, supplierSlug }: { email: string; supplierSlug?: string }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const settingsKey2 = supplierSlug ?? email;

  const [settings, setSettings] = useState<SupplierSettings>(() => {
    try {
      const raw = localStorage.getItem(supplierSettingsStorageKey(settingsKey2));
      if (!raw) return defaultSupplierSettings(null, email);
      return JSON.parse(raw) as SupplierSettings;
    } catch {
      return defaultSupplierSettings(null, email);
    }
  });
  const [loading, setLoading] = useState(!!supplierSlug);
  const [saving, setSaving] = useState(false);
  const profileRef = useRef<Record<string, unknown> | null>(null);
  const sDpInputRef = useRef<HTMLInputElement>(null);
  const sLogoInputRef = useRef<HTMLInputElement>(null);

  // Password change state
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd) {
      toast({ title: "Missing fields", description: "Please fill in all password fields.", variant: "destructive" });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast({ title: "Passwords don't match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }
    if (newPwd.length < 8) {
      toast({ title: "Password too short", description: "New password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setSavingPwd(true);
    try {
      await api.auth.changePassword(currentPwd, newPwd);
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setSavingPwd(false);
  };

  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const setCustomInput = (key: string, value: string) => setCustomInputs((prev) => ({ ...prev, [key]: value }));

  function CheckboxListWithCustom({
    fieldKey, options, selected, onToggle, columns = "sm:grid-cols-4",
  }: { fieldKey: string; options: string[]; selected: string[]; onToggle: (value: string, on: boolean) => void; columns?: string; }) {
    const customValues = selected.filter((v) => !options.includes(v));
    const inputKey = `chk-${fieldKey}`;
    return (
      <div className={`mt-2 grid gap-2 ${columns}`}>
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked={selected.includes(opt)} onCheckedChange={(v) => onToggle(opt, Boolean(v))} />
            {opt}
          </label>
        ))}
        {customValues.map((cv) => (
          <label key={cv} className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked onCheckedChange={() => onToggle(cv, false)} />
            <span className="text-primary">{cv}</span>
          </label>
        ))}
        <div className="flex items-center gap-2 col-span-full">
          <Input value={customInputs[inputKey] ?? ""} onChange={(e) => setCustomInput(inputKey, e.target.value)} placeholder="Other (type custom)…" className="bg-background/40 h-8 text-xs max-w-[14rem]" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const val = (customInputs[inputKey] ?? "").trim(); if (val && !selected.includes(val)) { onToggle(val, true); setCustomInput(inputKey, ""); } } }} />
          <Button type="button" variant="secondary" size="sm" className="h-8 px-2" disabled={!(customInputs[inputKey] ?? "").trim()} onClick={() => { const val = (customInputs[inputKey] ?? "").trim(); if (val && !selected.includes(val)) { onToggle(val, true); setCustomInput(inputKey, ""); } }}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  function SelectWithCustom({ value, onValueChange, placeholder = "Select", notSetLabel = "Not set", options, className = "bg-background/40" }: { value: string; onValueChange: (v: string) => void; placeholder?: string; notSetLabel?: string; options: { value: string; label: string }[]; className?: string; }) {
    const [customMode, setCustomMode] = useState(false);
    const knownValues = useMemo(() => new Set(options.map((o) => o.value)), [options]);
    const isCustom = customMode || (value !== "__none__" && value !== "" && !knownValues.has(value));
    if (isCustom) {
      return (
        <div className="flex items-center gap-2">
          <Input value={value === "__none__" ? "" : value} onChange={(e) => onValueChange(e.target.value)} placeholder="Type custom value…" className={`${className} h-9 text-sm flex-1`} autoFocus />
          <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-xs text-muted-foreground" onClick={() => { setCustomMode(false); onValueChange("__none__"); }}>Cancel</Button>
        </div>
      );
    }
    return (
      <Select value={value} onValueChange={(v) => { if (v === "__custom__") { setCustomMode(true); onValueChange(""); } else { onValueChange(v); } }}>
        <SelectTrigger className={className}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{notSetLabel}</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          <SelectItem value="__custom__" className="text-primary">Custom…</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  useEffect(() => {
    if (!supplierSlug) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    api.suppliers.getProfile(supplierSlug)
      .then((profile) => {
        if (cancelled) return;
        profileRef.current = profile as Record<string, unknown>;
        setSettings(defaultSupplierSettings(profile as Record<string, unknown>, email));
      })
      .catch(() => {
        if (cancelled) return;
        toast({ variant: "destructive", title: "Load failed", description: "Could not load settings from server." });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [supplierSlug, email]);

  const toggleCity = (city: string, on: boolean) =>
    setSettings((prev) => ({
      ...prev,
      cities_served: on
        ? Array.from(new Set([...prev.cities_served, city]))
        : prev.cities_served.filter((c) => c !== city),
    }));

  const toggleCategory = (cat: string, on: boolean) =>
    setSettings((prev) => ({
      ...prev,
      material_categories: on
        ? Array.from(new Set([...prev.material_categories, cat]))
        : prev.material_categories.filter((c) => c !== cat),
    }));

  const save = async () => {
    localStorage.setItem(supplierSettingsStorageKey(settingsKey2), JSON.stringify(settings));
    if (!supplierSlug) {
      toast({ title: "Saved locally", description: "Settings saved. Link a supplier profile to sync to server." });
      return;
    }
    setSaving(true);
    try {
      const profileData: Record<string, unknown> = {
        ...(profileRef.current ?? {}),
        supplier_name: settings.supplier_name,
        description: settings.description,
        logo_url: settings.logo_url,
        dp_url: settings.dp_url,
        city: settings.city,
        area: settings.area,
        cities_served: settings.cities_served,
        contact: {
          phone: settings.contact.phone,
          email: settings.contact.email,
          website: settings.contact.website,
        },
        _editor_settings: {
          contact: { linkedin: settings.contact.linkedin, facebook: settings.contact.facebook },
          legal_info: settings.legal_info,
          payment_terms: settings.payment_terms,
          delivery_info: settings.delivery_info,
          status: settings.status,
          material_categories: settings.material_categories,
          profile_settings: settings.profile_settings,
          verification_documents: settings.verification_documents,
        },
      };
      await api.suppliers.updateProfile(supplierSlug, profileData);
      profileRef.current = profileData;
      toast({ title: "Settings saved", description: "Your supplier profile has been updated." });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-2 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Supplier Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your supplier profile, contact details, cities served, and more.</p>
        </div>
        <div className="flex items-center gap-2">
          {supplierSlug && (
            <Button type="button" variant="outline" onClick={() => navigate(`/suppliers/${supplierSlug}`)}>
              <Eye className="h-4 w-4" />
              Preview Profile
            </Button>
          )}
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="profile">Supplier Profile</TabsTrigger>
          <TabsTrigger value="contact">Contact & Social</TabsTrigger>
          <TabsTrigger value="business">Business & Legal</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="operations">Operations & Delivery</TabsTrigger>
          <TabsTrigger value="account" className="gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Account &amp; Security
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Supplier Profile ──────────────────────────────────────── */}
        <TabsContent value="profile" className="mt-6 space-y-4">
          {/* LinkedIn-style Supplier Profile Header */}
          <GlassCard interactive={false} className="overflow-hidden p-0">
            <div className="relative h-40 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent sm:h-48">
              {settings.dp_url && (
                <img src={settings.dp_url} alt="Cover" className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
              <div className="absolute right-3 top-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-background/70 backdrop-blur-sm"
                  onClick={() => sDpInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {settings.dp_url ? "Change Cover" : "Add Cover Photo"}
                </Button>
                <input
                  ref={sDpInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const url = await api.upload.image(file, settings.supplier_name || email, "dp", "supplier");
                      setSettings((prev) => ({ ...prev, dp_url: url }));
                      toast({ title: "Cover photo updated" });
                    } catch { toast({ variant: "destructive", title: "Upload failed" }); }
                    if (sDpInputRef.current) sDpInputRef.current.value = "";
                  }}
                />
              </div>
            </div>
            <div className="relative px-5 pb-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
                <div className="-mt-12 relative shrink-0">
                  <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-background bg-background shadow-lg">
                    {settings.logo_url ? (
                      <img src={settings.logo_url} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-secondary text-muted-foreground">
                        <Upload className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full p-0 shadow"
                    onClick={() => sLogoInputRef.current?.click()}
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                  <input
                    ref={sLogoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const url = await api.upload.image(file, settings.supplier_name || email, "profile", "supplier");
                        setSettings((prev) => ({ ...prev, logo_url: url }));
                        toast({ title: "Profile picture updated" });
                      } catch { toast({ variant: "destructive", title: "Upload failed" }); }
                      if (sLogoInputRef.current) sLogoInputRef.current.value = "";
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1 pt-2">
                  <Input
                    value={settings.supplier_name}
                    onChange={(e) => setSettings((prev) => ({ ...prev, supplier_name: e.target.value }))}
                    className="border-none bg-transparent p-0 text-xl font-bold text-foreground shadow-none focus-visible:ring-0 h-auto"
                    placeholder="Supplier / Business Name"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">{email}</p>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">About</p>
            <p className="mt-1 text-xs text-muted-foreground">Describe your business, specialty materials, delivery areas.</p>
            <div className="mt-3 space-y-2">
              <Textarea
                value={settings.description}
                onChange={(e) => setSettings((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your business, specialty materials, delivery areas…"
                className="min-h-[100px] bg-background/40"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">{settings.description.length}/500 characters</p>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Location & Categories</p>
            <p className="mt-1 text-xs text-muted-foreground">Where you operate and what you supply.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>City</Label>
                <SelectWithCustom
                  value={settings.city || "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, city: v === "__none__" ? "" : v }))}
                  placeholder="Select city"
                  options={supplierCityOptions.map((c) => ({ value: c, label: c }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Area / District</Label>
                <Input
                  value={settings.area}
                  onChange={(e) => setSettings((prev) => ({ ...prev, area: e.target.value }))}
                  className="bg-background/40"
                  placeholder="e.g., Gulshan-e-Iqbal"
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Visibility Settings</p>
            <p className="mt-1 text-xs text-muted-foreground">Control how companies and clients discover your profile.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Public profile</p>
                  <p className="text-xs text-muted-foreground">Appear in Browse Suppliers.</p>
                </div>
                <Switch
                  checked={settings.profile_settings.public_profile}
                  onCheckedChange={(v) => setSettings((prev) => ({ ...prev, profile_settings: { ...prev.profile_settings, public_profile: v } }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Show contact info</p>
                  <p className="text-xs text-muted-foreground">Display phone &amp; email to companies.</p>
                </div>
                <Switch
                  checked={settings.profile_settings.show_contact}
                  onCheckedChange={(v) => setSettings((prev) => ({ ...prev, profile_settings: { ...prev.profile_settings, show_contact: v } }))}
                />
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        {/* ── Tab 2: Contact & Social ─────────────────────────────────────── */}
        <TabsContent value="contact" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Contact Information</p>
            <p className="mt-1 text-xs text-muted-foreground">Primary contact details visible to companies.</p>
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
                  className="bg-background/40" placeholder="info@supplier.pk"
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
                  className="bg-background/40" placeholder="https://yoursupplier.pk"
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
        </TabsContent>

        {/* ── Tab 3: Business & Legal ─────────────────────────────────────── */}
        <TabsContent value="business" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Cities Served</p>
            <p className="mt-1 text-xs text-muted-foreground">Select all cities where you deliver or operate.</p>
            <CheckboxListWithCustom
              fieldKey="supplier_cities"
              options={supplierCityOptions}
              columns="sm:grid-cols-3"
              selected={settings.cities_served}
              onToggle={(city, v) => toggleCity(city, v)}
            />
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Material Categories</p>
            <p className="mt-1 text-xs text-muted-foreground">What types of materials does your business supply?</p>
            <CheckboxListWithCustom
              fieldKey="material_categories"
              options={materialCategoryOptions}
              columns="sm:grid-cols-2"
              selected={settings.material_categories}
              onToggle={(cat, v) => toggleCategory(cat, v)}
            />
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Legal Registration</p>
            <p className="mt-1 text-xs text-muted-foreground">Registration status affects trust scores and visibility.</p>
            <div className="mt-4 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Legally registered</p>
                    <p className="text-xs text-muted-foreground">Business registered with authorities.</p>
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
                    placeholder="e.g., 2010"
                    min={1950}
                    max={2026}
                  />
                </div>
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        {/* ── Tab: Verification ──────────────────────────────────────────── */}
        <TabsContent value="verification" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5">
            <div className="flex items-center gap-3 mb-1">
              <Shield className="h-5 w-5 text-primary" />
              <p className="text-sm font-semibold text-foreground">Supplier Verification</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload legal documents to verify your business. Verified suppliers get higher trust scores and better visibility to construction companies. Admin will review your documents.
            </p>

            <div className={cn(
              "mt-4 flex items-center gap-3 rounded-2xl border p-4",
              settings.verification_documents.verification_status === "verified" && "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
              settings.verification_documents.verification_status === "pending" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
              settings.verification_documents.verification_status === "rejected" && "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
              settings.verification_documents.verification_status === "not_submitted" && "border-border bg-background/30 text-muted-foreground",
            )}>
              <FileCheck className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  {settings.verification_documents.verification_status === "verified" && "Verified — Your supplier business is verified."}
                  {settings.verification_documents.verification_status === "pending" && "Pending Review — Documents submitted, awaiting admin review."}
                  {settings.verification_documents.verification_status === "rejected" && "Rejected — Please re-upload corrected documents."}
                  {settings.verification_documents.verification_status === "not_submitted" && "Not Submitted — Upload your documents below to start verification."}
                </p>
                {settings.verification_documents.verification_notes && (
                  <p className="mt-1 text-xs opacity-80">Note: {settings.verification_documents.verification_notes}</p>
                )}
              </div>
            </div>
          </GlassCard>

          {[
            { key: "registration_certificate_url" as const, docType: "registration_certificate", label: "Business Registration Certificate", desc: "Official registration document from relevant authority (FBR, provincial registrar, etc.)." },
            { key: "secp_certificate_url" as const, docType: "secp_certificate", label: "SECP Certificate", desc: "Securities and Exchange Commission of Pakistan certificate (if registered)." },
            { key: "ntn_certificate_url" as const, docType: "ntn_certificate", label: "NTN Certificate", desc: "National Tax Number certificate from FBR." },
            { key: "cnic_front_url" as const, docType: "cnic_front", label: "Owner CNIC — Front", desc: "Front side of the business owner's CNIC / National ID Card." },
            { key: "cnic_back_url" as const, docType: "cnic_back", label: "Owner CNIC — Back", desc: "Back side of the business owner's CNIC / National ID Card." },
            { key: "other_document_url" as const, docType: "other_document", label: "Other Supporting Document", desc: "Any additional document that proves legitimacy (e.g., trade license, sales tax certificate)." },
          ].map(({ key, docType, label, desc }) => {
            const currentUrl = settings.verification_documents[key];
            return (
              <GlassCard key={key} interactive={false} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {currentUrl ? (
                      <>
                        <Badge variant="secondary" className="gap-1.5">
                          <FileCheck className="h-3 w-3" />
                          Uploaded
                        </Badge>
                        <Button type="button" variant="outline" size="sm" onClick={() => window.open(currentUrl, "_blank")}>
                          View
                        </Button>
                        <Button
                          type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                          onClick={() => setSettings((prev) => ({
                            ...prev,
                            verification_documents: { ...prev.verification_documents, [key]: "", verification_status: "not_submitted" },
                          }))}
                        >
                          <X className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Not uploaded</Badge>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/30 p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5">
                    <Upload className="h-4 w-4" />
                    {currentUrl ? "Replace document" : "Upload document"}
                    <span className="text-xs">(PDF, JPEG, PNG · Max 10 MB)</span>
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await api.upload.document(file, settings.supplier_name || email, docType, "supplier");
                          setSettings((prev) => ({
                            ...prev,
                            verification_documents: { ...prev.verification_documents, [key]: url, verification_status: "pending" },
                          }));
                          toast({ title: "Document uploaded", description: `${label} uploaded successfully.` });
                        } catch (err) {
                          toast({ variant: "destructive", title: "Upload failed", description: err instanceof Error ? err.message : "Could not upload document." });
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </GlassCard>
            );
          })}
        </TabsContent>

        {/* ── Tab 4: Operations & Delivery ────────────────────────────────── */}
        <TabsContent value="operations" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Operational Status</p>
            <p className="mt-1 text-xs text-muted-foreground">Control whether your supplier profile is currently active and accepting orders.</p>
            <div className="mt-4">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-background/30 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Active status</p>
                  <p className="text-xs text-muted-foreground">When inactive, your profile won't appear in search results.</p>
                </div>
                <Switch
                  checked={settings.status === "active"}
                  onCheckedChange={(v) => setSettings((prev) => ({ ...prev, status: v ? "active" : "inactive" }))}
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Payment Terms</p>
            <p className="mt-1 text-xs text-muted-foreground">How companies and clients will pay for materials.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Advance payment %</Label>
                <Input
                  type="number" min={0} max={100}
                  value={settings.payment_terms.advance_percentage ?? ""}
                  onChange={(e) => setSettings((prev) => ({ ...prev, payment_terms: { ...prev.payment_terms, advance_percentage: e.target.value.trim() ? Number(e.target.value) : null } }))}
                  className="bg-background/40" placeholder="e.g., 50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Minimum order value (PKR)</Label>
                <Input
                  type="number" min={0} step={1000}
                  value={settings.payment_terms.minimum_order_value ?? ""}
                  onChange={(e) => setSettings((prev) => ({ ...prev, payment_terms: { ...prev.payment_terms, minimum_order_value: e.target.value.trim() ? Number(e.target.value) : null } }))}
                  className="bg-background/40" placeholder="e.g., 10000"
                />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-foreground">Accepted Payment Methods</p>
              <CheckboxListWithCustom
                fieldKey="accepted_payments"
                options={["Cash on Delivery", "Bank Transfer", "Online Payment", "Cheque", "Credit (30 Days)", "Credit (60 Days)", "Letter of Credit"]}
                columns="sm:grid-cols-2"
                selected={settings.payment_terms.accepted_payments}
                onToggle={(opt, v) => setSettings((prev) => ({
                  ...prev,
                  payment_terms: {
                    ...prev.payment_terms,
                    accepted_payments: v
                      ? Array.from(new Set([...prev.payment_terms.accepted_payments, opt]))
                      : prev.payment_terms.accepted_payments.filter((x) => x !== opt),
                  },
                }))}
              />
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5">
            <p className="text-sm font-semibold text-foreground">Delivery Information</p>
            <p className="mt-1 text-xs text-muted-foreground">Delivery policies and charges for your materials.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Typical delivery time (days)</Label>
                <Select
                  value={settings.delivery_info.delivery_time_days != null ? String(settings.delivery_info.delivery_time_days) : "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, delivery_info: { ...prev.delivery_info, delivery_time_days: v === "__none__" ? null : Number(v) || null } }))}
                >
                  <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select delivery time" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    <SelectItem value="0">Same Day</SelectItem>
                    <SelectItem value="1">1 Day</SelectItem>
                    <SelectItem value="2">2 Days</SelectItem>
                    <SelectItem value="3">3 Days</SelectItem>
                    <SelectItem value="5">5 Days</SelectItem>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="14">14 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Delivery charges</Label>
                <Select
                  value={settings.delivery_info.delivery_charges || "__none__"}
                  onValueChange={(v) => setSettings((prev) => ({ ...prev, delivery_info: { ...prev.delivery_info, delivery_charges: v === "__none__" ? "" : v } }))}
                >
                  <SelectTrigger className="bg-background/40"><SelectValue placeholder="Select delivery charges" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    <SelectItem value="free">Free Delivery</SelectItem>
                    <SelectItem value="fixed">Fixed Charges</SelectItem>
                    <SelectItem value="per_km">Per KM</SelectItem>
                    <SelectItem value="negotiable">Negotiable</SelectItem>
                    <SelectItem value="buyer_arranged">Buyer Arranges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Free delivery above (PKR)</Label>
                <Input
                  type="number" min={0} step={5000}
                  value={settings.delivery_info.free_delivery_above ?? ""}
                  onChange={(e) => setSettings((prev) => ({ ...prev, delivery_info: { ...prev.delivery_info, free_delivery_above: e.target.value.trim() ? Number(e.target.value) : null } }))}
                  className="bg-background/40" placeholder="e.g., 50000"
                />
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        {/* ── Account & Security ── */}
        <TabsContent value="account" className="mt-6 space-y-4">
          <GlassCard interactive={false} className="p-5 space-y-2">
            <p className="text-sm font-semibold text-foreground">Account Info</p>
            <div className="grid gap-3 rounded-xl border border-border/40 bg-background/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="font-medium capitalize text-foreground">Material Supplier</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Change Password</p>
              <p className="mt-1 text-xs text-muted-foreground">Use a strong password of at least 8 characters.</p>
            </div>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <div className="relative">
                  <Input type={showCurrentPwd ? "text" : "password"} value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Enter current password" className="bg-background/40 pr-10" />
                  <button type="button" onClick={() => setShowCurrentPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <div className="relative">
                  <Input type={showNewPwd ? "text" : "password"} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="At least 8 characters" className="bg-background/40 pr-10" />
                  <button type="button" onClick={() => setShowNewPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Confirm New Password</Label>
                <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Repeat new password" className="bg-background/40" />
                {confirmPwd && newPwd !== confirmPwd && <p className="text-xs text-destructive">Passwords do not match.</p>}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleChangePassword} disabled={savingPwd || !currentPwd || !newPwd || newPwd !== confirmPwd} className="gap-2">
                {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Change Password
              </Button>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── SettingsPage (role router) ────────────────────────────────────────────────

// ─── Client Settings ─────────────────────────────────────────────────────────

type ClientPreferences = {
  construction_type: string;
  plot_size: string;
  budget_min: number | null;
  budget_max: number | null;
  preferred_cities: string[];
  timeline: string;
  notifications: {
    new_matches: boolean;
    request_updates: boolean;
    messages: boolean;
    marketing: boolean;
  };
};

const DEFAULT_CLIENT_PREFS: ClientPreferences = {
  construction_type: "",
  plot_size: "",
  budget_min: null,
  budget_max: null,
  preferred_cities: [],
  timeline: "",
  notifications: {
    new_matches: true,
    request_updates: true,
    messages: true,
    marketing: false,
  },
};

const CONSTRUCTION_TYPES = [
  { value: "residential_new", label: "New Residential House" },
  { value: "residential_renovation", label: "Renovation / Remodeling" },
  { value: "residential_extension", label: "Extension / Addition" },
  { value: "commercial_new", label: "New Commercial Building" },
  { value: "commercial_renovation", label: "Commercial Renovation" },
  { value: "plot_development", label: "Plot Development / Boundary Wall" },
];

const PLOT_SIZE_OPTIONS = [
  "3 Marla", "5 Marla", "7 Marla", "10 Marla", "12 Marla", "15 Marla",
  "20 Marla", "1 Kanal", "2 Kanal", "3 Kanal", "4 Kanal", "5 Kanal+",
];

const TIMELINE_OPTIONS = [
  { value: "asap", label: "As soon as possible (within 3 months)" },
  { value: "3_6_months", label: "3 – 6 months" },
  { value: "6_12_months", label: "6 – 12 months" },
  { value: "1_2_years", label: "1 – 2 years" },
  { value: "flexible", label: "Flexible / no fixed timeline" },
];

function ClientSettingsEditor() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Profile
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [city, setCity] = useState("");

  // Project preferences
  const [prefs, setPrefs] = useState<ClientPreferences>(DEFAULT_CLIENT_PREFS);

  // Account
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Load from API on mount
  useEffect(() => {
    api.auth.getProfile()
      .then((data) => {
        setDisplayName((data.display_name as string) ?? "");
        setPhone((data.phone as string) ?? "");
        setCity((data.city as string) ?? "");
        const raw = (data.preferences ?? {}) as Record<string, unknown>;
        setPrefs({
          construction_type: (raw.construction_type as string) ?? "",
          plot_size: (raw.plot_size as string) ?? "",
          budget_min: raw.budget_min != null ? Number(raw.budget_min) : null,
          budget_max: raw.budget_max != null ? Number(raw.budget_max) : null,
          preferred_cities: Array.isArray(raw.preferred_cities) ? (raw.preferred_cities as string[]) : [],
          timeline: (raw.timeline as string) ?? "",
          notifications: {
            new_matches: raw.notifications ? Boolean((raw.notifications as Record<string, unknown>).new_matches ?? true) : true,
            request_updates: raw.notifications ? Boolean((raw.notifications as Record<string, unknown>).request_updates ?? true) : true,
            messages: raw.notifications ? Boolean((raw.notifications as Record<string, unknown>).messages ?? true) : true,
            marketing: raw.notifications ? Boolean((raw.notifications as Record<string, unknown>).marketing ?? false) : false,
          },
        });
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);

  const patchPref = <K extends keyof ClientPreferences>(key: K, value: ClientPreferences[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const patchNotif = (key: keyof ClientPreferences["notifications"], value: boolean) =>
    setPrefs((p) => ({ ...p, notifications: { ...p.notifications, [key]: value } }));

  const toggleCity = (c: string) =>
    setPrefs((p) => ({
      ...p,
      preferred_cities: p.preferred_cities.includes(c)
        ? p.preferred_cities.filter((x) => x !== c)
        : [...p.preferred_cities, c],
    }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.auth.updateProfile({
        display_name: displayName.trim() || undefined,
        phone: phone.trim() || undefined,
        preferences: {
          city: city.trim(),
          construction_type: prefs.construction_type,
          plot_size: prefs.plot_size,
          budget_min: prefs.budget_min,
          budget_max: prefs.budget_max,
          preferred_cities: prefs.preferred_cities,
          timeline: prefs.timeline,
          notifications: prefs.notifications,
        },
      });
      toast({ title: "Settings saved", description: "Your profile has been updated." });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd) {
      toast({ title: "Missing fields", description: "Please fill in all password fields.", variant: "destructive" });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast({ title: "Passwords don't match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }
    if (newPwd.length < 8) {
      toast({ title: "Password too short", description: "New password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setSavingPwd(true);
    try {
      await api.auth.changePassword(currentPwd, newPwd);
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setSavingPwd(false);
  };

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-2 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, project preferences, and account security.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="project" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Project Preferences
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Account & Security
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Profile ── */}
        <TabsContent value="profile" className="space-y-4">
          <GlassCard interactive={false} className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Personal Information</p>
              <p className="mt-1 text-xs text-muted-foreground">Your name and contact details shown to companies when you send a request.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Ahmed Khan"
                  className="bg-background/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0300-1234567"
                  className="bg-background/40"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Your City</Label>
                <p className="text-xs text-muted-foreground">The city where you are based or planning to build.</p>
                <Select value={city || "__none__"} onValueChange={(v) => setCity(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="bg-background/40">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select a city</SelectItem>
                    {(cityOptions as readonly string[]).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Profile
              </Button>
            </div>
          </GlassCard>
        </TabsContent>

        {/* ── Tab 2: Project Preferences ── */}
        <TabsContent value="project" className="space-y-4">
          <GlassCard interactive={false} className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Project Details</p>
              <p className="mt-1 text-xs text-muted-foreground">Help us match you with the right construction companies. The more detail you provide, the better the match.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type of Construction</Label>
                <Select value={prefs.construction_type || "__none__"} onValueChange={(v) => patchPref("construction_type", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="bg-background/40">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select type</SelectItem>
                    {CONSTRUCTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Plot Size</Label>
                <Select value={prefs.plot_size || "__none__"} onValueChange={(v) => patchPref("plot_size", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="bg-background/40">
                    <SelectValue placeholder="Select plot size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select size</SelectItem>
                    {PLOT_SIZE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Budget – Minimum (PKR)</Label>
                <Input
                  type="number"
                  min={0}
                  value={prefs.budget_min ?? ""}
                  onChange={(e) => patchPref("budget_min", e.target.value ? Math.max(0, Number(e.target.value)) : null)}
                  placeholder="e.g. 5000000"
                  className="bg-background/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Budget – Maximum (PKR)</Label>
                <Input
                  type="number"
                  min={0}
                  value={prefs.budget_max ?? ""}
                  onChange={(e) => patchPref("budget_max", e.target.value ? Math.max(0, Number(e.target.value)) : null)}
                  placeholder="e.g. 15000000"
                  className="bg-background/40"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Preferred Timeline</Label>
                <Select value={prefs.timeline || "__none__"} onValueChange={(v) => patchPref("timeline", v === "__none__" ? "" : v)}>
                  <SelectTrigger className="bg-background/40">
                    <SelectValue placeholder="When do you want to start?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select timeline</SelectItem>
                    {TIMELINE_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Preferred Cities</p>
              <p className="mt-1 text-xs text-muted-foreground">Select all cities where you are open to hiring construction companies.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(cityOptions as readonly string[]).map((c) => {
                const selected = prefs.preferred_cities.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCity(c)}
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background/30 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            {prefs.preferred_cities.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Selected: {prefs.preferred_cities.join(", ")}
              </p>
            )}
          </GlassCard>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Preferences
            </Button>
          </div>
        </TabsContent>

        {/* ── Tab 3: Notifications ── */}
        <TabsContent value="notifications">
          <GlassCard interactive={false} className="p-5 space-y-6">
            <div>
              <p className="text-sm font-semibold text-foreground">Email Notifications</p>
              <p className="mt-1 text-xs text-muted-foreground">Control which emails we send to {user?.email}.</p>
            </div>

            <div className="space-y-4">
              {([
                { key: "new_matches" as const, label: "New Company Matches", desc: "Notify when a construction company matching your project preferences becomes available." },
                { key: "request_updates" as const, label: "Request Status Updates", desc: "Notify when a company responds to or updates your requests." },
                { key: "messages" as const, label: "New Messages", desc: "Notify when you receive a new message from a company." },
                { key: "marketing" as const, label: "Tips & Platform Updates", desc: "Occasional tips, guides, and Smart Construction Connect platform news." },
              ] as { key: keyof ClientPreferences["notifications"]; label: string; desc: string }[]).map(({ key, label, desc }) => (
                <div key={key} className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-background/20 p-4">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={prefs.notifications[key]}
                    onCheckedChange={(v) => patchNotif(key, v)}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Notifications
              </Button>
            </div>
          </GlassCard>
        </TabsContent>

        {/* ── Tab 4: Account & Security ── */}
        <TabsContent value="account" className="space-y-4">
          <GlassCard interactive={false} className="p-5 space-y-2">
            <p className="text-sm font-semibold text-foreground">Account Info</p>
            <div className="grid gap-3 rounded-xl border border-border/40 bg-background/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="font-medium capitalize text-foreground">{user?.role}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Display Name</p>
                <p className="font-medium text-foreground">{user?.display_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium text-foreground">{user?.phone || "—"}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Change Password</p>
              <p className="mt-1 text-xs text-muted-foreground">Use a strong password of at least 8 characters.</p>
            </div>

            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPwd ? "text" : "password"}
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    placeholder="Enter current password"
                    className="bg-background/40 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>New Password</Label>
                <div className="relative">
                  <Input
                    type={showNewPwd ? "text" : "password"}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="At least 8 characters"
                    className="bg-background/40 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Repeat new password"
                  className="bg-background/40"
                />
                {confirmPwd && newPwd !== confirmPwd && (
                  <p className="text-xs text-destructive">Passwords do not match.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleChangePassword} disabled={savingPwd || !currentPwd || !newPwd || newPwd !== confirmPwd} className="gap-2">
                {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Change Password
              </Button>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Admin Settings ───────────────────────────────────────────────────────────

function AdminSettingsEditor() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.auth.updateProfile({ display_name: displayName.trim() || undefined, phone: phone.trim() || undefined });
      toast({ title: "Profile updated", description: "Your admin profile has been saved." });
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd) {
      toast({ title: "Missing fields", description: "Please fill in all password fields.", variant: "destructive" });
      return;
    }
    if (newPwd !== confirmPwd) {
      toast({ title: "Passwords don't match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }
    if (newPwd.length < 8) {
      toast({ title: "Password too short", description: "New password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    setSavingPwd(true);
    try {
      await api.auth.changePassword(currentPwd, newPwd);
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setSavingPwd(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <Button type="button" variant="ghost" size="sm" className="mb-2 gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your admin account profile and security.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Account &amp; Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <GlassCard interactive={false} className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Personal Information</p>
              <p className="mt-1 text-xs text-muted-foreground">Your admin display name and contact number.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Display Name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Admin User" className="bg-background/40" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0300-1234567" className="bg-background/40" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Profile
              </Button>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <GlassCard interactive={false} className="p-5 space-y-2">
            <p className="text-sm font-semibold text-foreground">Account Info</p>
            <div className="grid gap-3 rounded-xl border border-border/40 bg-background/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{user?.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="font-medium capitalize text-foreground">Administrator</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard interactive={false} className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Change Password</p>
              <p className="mt-1 text-xs text-muted-foreground">Use a strong password of at least 8 characters.</p>
            </div>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <div className="relative">
                  <Input type={showCurrentPwd ? "text" : "password"} value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Enter current password" className="bg-background/40 pr-10" />
                  <button type="button" onClick={() => setShowCurrentPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrentPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <div className="relative">
                  <Input type={showNewPwd ? "text" : "password"} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="At least 8 characters" className="bg-background/40 pr-10" />
                  <button type="button" onClick={() => setShowNewPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Confirm New Password</Label>
                <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Repeat new password" className="bg-background/40" />
                {confirmPwd && newPwd !== confirmPwd && <p className="text-xs text-destructive">Passwords do not match.</p>}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleChangePassword} disabled={savingPwd || !currentPwd || !newPwd || newPwd !== confirmPwd} className="gap-2">
                {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Change Password
              </Button>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Page entry point ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  if (!user) {
    return (
      <GlassCard interactive={false} className="p-6">
        <p className="text-sm text-muted-foreground">Please log in to access settings.</p>
      </GlassCard>
    );
  }
  if (user.role === "client") {
    return <ClientSettingsEditor />;
  }
  if (user.role === "supplier") {
    return <SupplierSettingsEditor email={user.email} supplierSlug={user.supplierFile} />;
  }
  if (user.role === "company") {
    return <SettingsEditor email={user.email} companySlug={user.companyFile} />;
  }
  if (user.role === "admin") {
    return <AdminSettingsEditor />;
  }
  return (
    <GlassCard interactive={false} className="p-6">
      <p className="text-sm text-muted-foreground">Settings are not available for your account type.</p>
    </GlassCard>
  );
}

