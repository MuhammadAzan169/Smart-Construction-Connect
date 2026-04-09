import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Check, Sparkles, Zap, Crown, Building2, Package,
  ArrowRight, Shield, Star, TrendingUp, Users, Bot,
  BarChart3, MessageSquare, Award, Clock, HeadphonesIcon,
  ChevronDown, Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/GlassCard";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanTone = "base" | "pro" | "premium";

type PlanData = {
  id: string;
  name: string;
  price: { monthly: string; annual: string };
  annualSavings?: string;
  description: string;
  tone: PlanTone;
  highlight?: boolean;
  icon: React.ElementType;
  features: { text: string; included: boolean }[];
  cta: string;
  badge?: string;
};

type FAQItem = { q: string; a: string };

// ─── Plan Data ────────────────────────────────────────────────────────────────

const companyPlans: PlanData[] = [
  {
    id: "basic",
    name: "Basic",
    price: { monthly: "Free", annual: "Free" },
    description: "List your company and start receiving client requests.",
    tone: "base",
    icon: Building2,
    features: [
      { text: "Verified company profile", included: true },
      { text: "Up to 10 client requests/mo", included: true },
      { text: "Standard search visibility", included: true },
      { text: "Basic messages", included: true },
      { text: "AI Business Advisor", included: false },
      { text: "Priority matching", included: false },
      { text: "Advanced analytics", included: false },
      { text: "Dedicated account manager", included: false },
    ],
    cta: "Current Plan",
  },
  {
    id: "pro",
    name: "Pro",
    price: { monthly: "PKR 4,999", annual: "PKR 3,999" },
    annualSavings: "Save PKR 12,000/yr",
    description: "For growing construction companies with active pipelines.",
    tone: "pro",
    highlight: true,
    icon: Zap,
    badge: "Most Popular",
    features: [
      { text: "Verified company profile", included: true },
      { text: "Unlimited client requests", included: true },
      { text: "Priority search placement", included: true },
      { text: "Advanced messaging suite", included: true },
      { text: "AI Business Advisor", included: true },
      { text: "Smart client matching", included: true },
      { text: "Project analytics dashboard", included: true },
      { text: "Dedicated account manager", included: false },
    ],
    cta: "Upgrade to Pro",
  },
  {
    id: "premium",
    name: "Premium",
    price: { monthly: "PKR 12,999", annual: "PKR 10,499" },
    annualSavings: "Save PKR 30,000/yr",
    description: "Gold-tier visibility, control, and enterprise analytics.",
    tone: "premium",
    icon: Crown,
    badge: "Gold Tier",
    features: [
      { text: "Verified company profile", included: true },
      { text: "Unlimited client requests", included: true },
      { text: "Featured homepage placement", included: true },
      { text: "Advanced messaging suite", included: true },
      { text: "AI Business Advisor (unlimited)", included: true },
      { text: "Smart client matching", included: true },
      { text: "Advanced analytics & reports", included: true },
      { text: "Dedicated account manager", included: true },
    ],
    cta: "Go Premium",
  },
];

const supplierPlans: PlanData[] = [
  {
    id: "basic",
    name: "Basic",
    price: { monthly: "Free", annual: "Free" },
    description: "List your materials and connect with local builders.",
    tone: "base",
    icon: Package,
    features: [
      { text: "Verified supplier profile", included: true },
      { text: "Up to 50 material listings", included: true },
      { text: "Standard search visibility", included: true },
      { text: "Basic order requests", included: true },
      { text: "AI Market Analyst", included: false },
      { text: "Demand forecasting", included: false },
      { text: "Premium placement", included: false },
      { text: "Dedicated account manager", included: false },
    ],
    cta: "Current Plan",
  },
  {
    id: "pro",
    name: "Pro",
    price: { monthly: "PKR 3,999", annual: "PKR 2,999" },
    annualSavings: "Save PKR 12,000/yr",
    description: "For suppliers who want higher reach and smarter orders.",
    tone: "pro",
    highlight: true,
    icon: TrendingUp,
    badge: "Most Popular",
    features: [
      { text: "Verified supplier profile", included: true },
      { text: "Unlimited material listings", included: true },
      { text: "Enhanced search visibility", included: true },
      { text: "Bulk order management", included: true },
      { text: "AI Market Analyst", included: true },
      { text: "Real-time price insights", included: true },
      { text: "Sales analytics dashboard", included: true },
      { text: "Dedicated account manager", included: false },
    ],
    cta: "Upgrade to Pro",
  },
  {
    id: "premium",
    name: "Premium",
    price: { monthly: "PKR 9,999", annual: "PKR 7,999" },
    annualSavings: "Save PKR 24,000/yr",
    description: "Maximum market reach with advanced forecasting tools.",
    tone: "premium",
    icon: Crown,
    badge: "Gold Tier",
    features: [
      { text: "Verified supplier profile", included: true },
      { text: "Unlimited material listings", included: true },
      { text: "Premium homepage placement", included: true },
      { text: "Priority order routing", included: true },
      { text: "AI Market Analyst (unlimited)", included: true },
      { text: "Demand forecasting & alerts", included: true },
      { text: "Advanced analytics & exports", included: true },
      { text: "Dedicated account manager", included: true },
    ],
    cta: "Go Premium",
  },
];

const companyFAQs: FAQItem[] = [
  { q: "Can I switch plans at any time?", a: "Yes — upgrade or downgrade anytime. Changes take effect immediately on upgrade, or at the end of your billing cycle on downgrade." },
  { q: "What is the AI Business Advisor?", a: "A GPT-powered assistant trained on construction industry data. It helps with cost estimation, supplier comparisons, and project planning — included from Pro tier." },
  { q: "Is there a free trial for Pro?", a: "Pro comes with a 14-day free trial. No credit card required to start." },
  { q: "How is priority search placement determined?", a: "Pro and Premium companies appear higher in client search results based on match score, response rate, and profile completeness." },
  { q: "What analytics does the Pro dashboard provide?", a: "Request volume, conversion rates, city-level demand heatmaps, and client engagement metrics — updated in real time." },
];

const supplierFAQs: FAQItem[] = [
  { q: "Can I list materials for free?", a: "Yes — Basic tier supports up to 50 material listings with no charge. Pro and Premium unlock unlimited listings." },
  { q: "What is the AI Market Analyst?", a: "A tool that analyzes construction market trends, material price movements, and demand signals across Pakistan — helping you price competitively and spot new opportunities." },
  { q: "How does demand forecasting work?", a: "Premium suppliers get AI-powered alerts when demand for their listed materials is expected to spike in nearby cities, based on permit data and project trends." },
  { q: "Is there a trial for the Pro tier?", a: "Yes — 14 days free, cancellable anytime. No credit card needed." },
  { q: "How does premium placement work?", a: "Premium suppliers are featured at the top of relevant material search results and on the homepage's 'Top Suppliers' section." },
];

// ─── Stat Strip ───────────────────────────────────────────────────────────────

const companyStats = [
  { icon: Users, label: "Active Companies", value: "120+" },
  { icon: MessageSquare, label: "Monthly Requests", value: "4,200+" },
  { icon: TrendingUp, label: "Avg. Revenue Boost", value: "3.2×" },
  { icon: Star, label: "Client Satisfaction", value: "98%" },
];

const supplierStats = [
  { icon: Package, label: "Material Listings", value: "8,500+" },
  { icon: Building2, label: "Connected Builders", value: "320+" },
  { icon: TrendingUp, label: "Avg. Orders Increase", value: "2.8×" },
  { icon: Award, label: "Verified Suppliers", value: "85+" },
];

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, annual }: { plan: PlanData; annual: boolean }) {
  const isPro = plan.tone === "pro";
  const isPremium = plan.tone === "premium";
  const isBase = plan.tone === "base";
  const PlanIcon = plan.icon;
  const price = annual ? plan.price.annual : plan.price.monthly;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative flex h-full"
    >
      {/* Glow effect for Pro */}
      {isPro && (
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-primary/30 to-amber-500/20 blur-xl opacity-60" />
      )}
      {isPremium && (
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-[#D4AF37]/30 to-orange-500/20 blur-xl opacity-50" />
      )}

      <GlassCard
        interactive={!isBase}
        className={cn(
          "relative flex w-full flex-col p-6",
          isPro && "ring-2 ring-primary/50 bg-primary/5",
          isPremium && "ring-2 ring-[#D4AF37]/40 bg-[#D4AF37]/5",
        )}
      >
        {/* Badge */}
        {plan.badge && (
          <div className="absolute -top-3.5 start-1/2 -translate-x-1/2 z-10">
            <Badge
              className={cn(
                "rounded-full px-3 py-0.5 text-[11px] font-semibold shadow-lg",
                isPro && "bg-primary text-primary-foreground",
                isPremium && "bg-[#D4AF37] text-black",
              )}
            >
              {plan.badge}
            </Badge>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              isBase && "bg-secondary text-muted-foreground",
              isPro && "bg-primary/15 text-primary",
              isPremium && "bg-[#D4AF37]/15 text-[#D4AF37]",
            )}
          >
            <PlanIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-bold text-foreground">{plan.name}</p>
            <p className="text-xs text-muted-foreground leading-snug">{plan.description}</p>
          </div>
        </div>

        {/* Price */}
        <div className="mt-5">
          <div className="flex items-end gap-1.5">
            <span
              className={cn(
                "text-3xl font-extrabold leading-none",
                isBase && "text-foreground",
                isPro && "text-primary",
                isPremium && "text-[#D4AF37]",
              )}
            >
              {price}
            </span>
            {price !== "Free" && (
              <span className="mb-0.5 text-xs text-muted-foreground">/mo</span>
            )}
          </div>
          {annual && plan.annualSavings && price !== "Free" && (
            <p className="mt-1 text-xs font-medium text-emerald-400">{plan.annualSavings}</p>
          )}
          {!annual && price !== "Free" && (
            <p className="mt-1 text-xs text-muted-foreground">Billed monthly. Cancel anytime.</p>
          )}
          {annual && price !== "Free" && (
            <p className="mt-1 text-xs text-muted-foreground">Billed annually.</p>
          )}
        </div>

        {/* Feature list */}
        <div className="mt-5 flex-1 space-y-2.5">
          {plan.features.map((f) => (
            <div key={f.text} className={cn("flex items-start gap-2.5", !f.included && "opacity-40")}>
              <div
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
                  f.included && isPrimaryOrPremium(plan.tone) ? "bg-primary/15" : "bg-secondary",
                  f.included && isPremium ? "bg-[#D4AF37]/15" : "",
                )}
              >
                <Check
                  className={cn(
                    "h-3 w-3",
                    f.included && isPro ? "text-primary" : "",
                    f.included && isPremium ? "text-[#D4AF37]" : "",
                    f.included && isBase ? "text-muted-foreground" : "",
                    !f.included ? "text-muted-foreground/50" : "",
                  )}
                />
              </div>
              <span className="text-sm text-foreground leading-tight">{f.text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-6">
          <Button
            size="lg"
            className={cn(
              "h-11 w-full rounded-xl font-semibold transition-all duration-200",
              isBase &&
                "border border-border/60 bg-background/50 text-foreground hover:bg-accent/50 hover:border-primary/30 hover:text-primary",
              isPro &&
                "bg-gradient-to-r from-primary to-amber-500 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:brightness-110",
              isPremium &&
                "bg-gradient-to-r from-[#D4AF37] to-orange-400 text-black shadow-lg shadow-[#D4AF37]/25 hover:shadow-xl hover:shadow-[#D4AF37]/35 hover:brightness-110",
            )}
            variant={isBase ? "outline" : "default"}
            disabled={isBase}
          >
            {plan.cta}
            {isPro && <ArrowRight className="ms-1.5 h-4 w-4" />}
            {isPremium && <Crown className="ms-1.5 h-4 w-4" />}
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function isPrimaryOrPremium(tone: PlanTone) {
  return tone === "pro" || tone === "premium";
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FAQItemComponent({ item, index }: { item: FAQItem; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 rounded-2xl border border-border/50 bg-card/50 px-5 py-4 text-start transition-colors hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-foreground">{item.q}</span>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 pt-2 text-sm text-muted-foreground leading-relaxed">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SaaSPlansPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [annual, setAnnual] = useState(false);

  const isSupplier = user?.role === "supplier";
  const plans = isSupplier ? supplierPlans : companyPlans;
  const faqs = isSupplier ? supplierFAQs : companyFAQs;
  const stats = isSupplier ? supplierStats : companyStats;

  const roleLabel = isSupplier ? "Supplier" : "Construction Company";
  const roleIcon = isSupplier ? Package : Building2;
  const RoleIcon = roleIcon;

  return (
    <div className="relative min-h-screen">
      {/* Background glows */}
      <div className="pointer-events-none absolute start-1/4 top-0 h-80 w-80 rounded-full bg-primary/6 blur-[100px]" />
      <div className="pointer-events-none absolute end-1/4 top-32 h-64 w-64 rounded-full bg-amber-500/5 blur-[80px]" />
      <div className="pointer-events-none absolute bottom-0 start-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#D4AF37]/5 blur-[80px]" />

      <div className="relative mx-auto max-w-6xl space-y-16 px-4 py-8">

        {/* ── Hero Header ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
            <RoleIcon className="h-3.5 w-3.5 text-primary" />
            {roleLabel} Plans
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Plans built for{" "}
            <span className="bg-gradient-to-r from-primary to-amber-400 bg-clip-text text-transparent">
              {isSupplier ? "Suppliers" : "Builders"}
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            {isSupplier
              ? "Grow your material business with smarter listings, AI-powered market insights, and direct access to Pakistan's construction network."
              : "Win more clients, streamline requests, and scale your company with AI-powered tools built for Pakistan's construction market."}
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/60 px-4 py-2 backdrop-blur-sm">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200",
                !annual
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200",
                annual
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Annual
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>

        {/* ── Plan Cards ───────────────────────────────────────────────────── */}
        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} annual={annual} />
          ))}
        </div>

        {/* ── Stats Strip ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <GlassCard interactive={false} className="overflow-hidden">
            <div className="grid grid-cols-2 divide-border/40 sm:grid-cols-4 sm:divide-x">
              {stats.map((stat, i) => {
                const StatIcon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 px-6 py-6 text-center",
                      i !== 0 && i % 2 === 0 && "border-t border-border/40 sm:border-t-0",
                    )}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      <StatIcon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>

        {/* ── Why Upgrade Section ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="space-y-6"
        >
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-foreground">
              Why upgrade?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything you need to grow faster on Pakistan's #1 construction platform.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {getWhyUpgradeItems(isSupplier).map((item, i) => {
              const ItemIcon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                >
                  <GlassCard interactive className="h-full p-5">
                    <div
                      className={cn(
                        "mb-3 flex h-10 w-10 items-center justify-center rounded-xl",
                        item.color,
                      )}
                    >
                      <ItemIcon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {item.desc}
                    </p>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Testimonial / Social Proof ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <GlassCard interactive={false} className="overflow-hidden">
            <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 text-sm font-bold text-primary-foreground shadow-lg">
                  {isSupplier ? "RS" : "SK"}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {isSupplier ? "Raza Steel & Co." : "Saeed Constructions"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isSupplier ? "Material Supplier, Lahore" : "Construction Company, Islamabad"}
                  </p>
                  <div className="mt-1 flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} className="h-3 w-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>
              </div>
              <blockquote className="flex-1 border-s border-primary/30 ps-5 text-sm italic text-muted-foreground">
                {isSupplier
                  ? '"Upgrading to Pro tripled our inbound order requests. The AI price insights help us stay ahead of market swings — genuinely game-changing for a supplier in Pakistan."'
                  : '"Since upgrading to Pro, our conversion rate from request to project jumped from 18% to 54%. The AI Advisor alone is worth every rupee."'}
              </blockquote>
            </div>
          </GlassCard>
        </motion.div>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.22 }}
          className="space-y-4"
        >
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-foreground">
              Frequently asked questions
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Still have questions?{" "}
              <a href="mailto:support@scc.pk" className="text-primary underline-offset-2 hover:underline">
                Contact support
              </a>
            </p>
          </div>
          <div className="space-y-2">
            {faqs.map((item, idx) => (
              <FAQItemComponent key={idx} item={item} index={idx} />
            ))}
          </div>
        </motion.div>

        {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="pb-8"
        >
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/8 via-transparent to-amber-500/8 p-8 text-center">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-16 h-40 w-40 rounded-full bg-amber-500/8 blur-2xl" />
            <div className="relative">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-500 shadow-lg shadow-primary/30">
                <Rocket className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-extrabold text-foreground">
                Ready to level up?
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                {isSupplier
                  ? "Join Pakistan's fastest-growing materials marketplace. Start free — upgrade when you're ready."
                  : "Join 120+ verified construction companies already winning more projects on SCC."}
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-11 rounded-xl bg-gradient-to-r from-primary to-amber-500 px-8 font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-110"
                >
                  <Sparkles className="me-2 h-4 w-4" />
                  Start 14-day free trial
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 rounded-xl border-border/60 px-8 font-semibold"
                >
                  <HeadphonesIcon className="me-2 h-4 w-4" />
                  Talk to sales
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                <Shield className="me-1 inline h-3 w-3" />
                No credit card required · Cancel anytime · PKR billing
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getWhyUpgradeItems(isSupplier: boolean) {
  if (isSupplier) {
    return [
      { icon: TrendingUp, color: "bg-primary/15 text-primary", title: "More Visibility", desc: "Get featured in builder searches and the homepage materials section." },
      { icon: Bot, color: "bg-purple-500/15 text-purple-400", title: "AI Market Analyst", desc: "Real-time pricing trends, demand signals, and competitive insights." },
      { icon: BarChart3, color: "bg-cyan-500/15 text-cyan-400", title: "Sales Analytics", desc: "Track views, orders, and revenue — all in one searchable dashboard." },
      { icon: Clock, color: "bg-amber-500/15 text-amber-400", title: "Priority Support", desc: "Get answers within 2 hours from our dedicated supplier success team." },
    ];
  }
  return [
    { icon: Users, color: "bg-primary/15 text-primary", title: "More Client Leads", desc: "Priority placement means more high-intent clients find your company first." },
    { icon: Bot, color: "bg-purple-500/15 text-purple-400", title: "AI Business Advisor", desc: "Cost estimation, supplier comparison, and project planning — powered by AI." },
    { icon: BarChart3, color: "bg-cyan-500/15 text-cyan-400", title: "Project Analytics", desc: "Request volume, conversion rates, and city-level demand heatmaps." },
    { icon: Clock, color: "bg-amber-500/15 text-amber-400", title: "Faster Response", desc: "Priority support means issues get resolved within hours, not days." },
  ];
}
