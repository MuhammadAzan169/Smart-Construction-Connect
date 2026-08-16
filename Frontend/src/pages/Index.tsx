import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useTranslation } from "react-i18next";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  HardHat, ArrowRight, Building2, Bot, Shield, Check, Sparkles,
  Star, TrendingUp, Award, Ruler, ClipboardList, Crown, Zap,
  Truck, Moon, Sun, Hammer, Users, Package, Wrench, MapPin, BarChart3,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/GlassCard";
import { TiltCard } from "@/components/shared/TiltCard";
import { AnimatedBackground } from "@/components/shared/AnimatedBackground";
import { FloatingAIAssistant } from "@/components/shared/FloatingAIAssistant";

import {
  SectionReveal, StaggerList, StaggerItem,
  AnimatedCounter
} from "@/components/shared/AnimationPrimitives";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";

/* ─── Data ──────────────────────────────────────────────────── */
const stats = [
  { label: "Verified Companies", value: 120, suffix: "+" },
  { label: "Projects Completed", value: 3500, suffix: "+" },
  { label: "Active Suppliers", value: 85, suffix: "+" },
  { label: "Client Satisfaction", value: 98, suffix: "%" },
];

const testimonials = [
  {
    name: "Ahmed K.",
    role: "Homeowner, Lahore",
    initials: "AK",
    text: "Found the perfect construction company within days. The AI matching is incredibly accurate.",
    rating: 5,
  },
  {
    name: "Saeed Construction",
    role: "Construction Company",
    initials: "SC",
    text: "Our lead quality improved 3x after joining the platform. The request management system is excellent.",
    rating: 5,
  },
  {
    name: "BuildMart Supplies",
    role: "Material Supplier",
    initials: "BM",
    text: "Managing inventory and pricing has never been easier. Direct connections with builders save us time.",
    rating: 4,
  },
];

const processSteps = [
  { icon: ClipboardList, title: "Post Your Project", desc: "Describe your requirements, budget, and timeline in minutes" },
  { icon: HardHat, title: "Get Matched", desc: "Our AI shortlists the best verified companies for your project" },
  { icon: Truck, title: "Build & Deliver", desc: "Request quotes, compare, and track progress to completion" },
];

const roles = [
  {
    icon: Users,
    title: "Homeowners & Clients",
    desc: "Planning your dream home? Post your project and get matched with trusted construction companies near you.",
    features: ["Free project posting", "Compare multiple quotes", "Track request status"],
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: HardHat,
    title: "Construction Companies",
    desc: "Grow your business by connecting with quality clients. Showcase your portfolio and win more projects.",
    features: ["Verified company profile", "Incoming client requests", "AI-powered lead matching"],
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    highlighted: true,
  },
  {
    icon: Package,
    title: "Material Suppliers",
    desc: "List your inventory, reach builders directly, and manage pricing — all from one dashboard.",
    features: ["Material catalog", "Direct builder connections", "Inventory management"],
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
];

/* ─── Component ─────────────────────────────────────────────── */
export default function Index() {
  const { isAuthenticated } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const features = [
    { icon: Building2, title: "Smart Matching", desc: "AI connects you with the best construction companies for your specific project type and location." },
    { icon: Bot, title: "AI Assistant", desc: "Chat with our intelligent assistant for personalized recommendations and cost estimates." },
    { icon: Shield, title: "Verified Partners", desc: "Every company and supplier is vetted, SECP-checked, and rated by real clients." },
    { icon: Award, title: "Quality Guarantee", desc: "Premium partners meet strict quality control standards before joining the platform." },
    { icon: Ruler, title: "Cost Estimation", desc: "Get instant AI-powered cost breakdowns for grey structure, finishing, and more." },
    { icon: BarChart3, title: "Market Insights", desc: "Real-time pricing trends and material cost tracking across Pakistan." },
  ];

  return (
    <div className="relative flex min-h-screen flex-col bg-background overflow-x-hidden">
      <AnimatedBackground />

      {/* ─── Navbar ─────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border/50 bg-background/40 px-4 backdrop-blur-2xl sm:px-6 lg:px-12"
      >
        <div className="flex items-center gap-2.5">
          <img src="/Logo.png" alt="SCC Logo" className="h-9 w-9 rounded-xl object-contain" />
          <span className="hidden text-lg font-bold text-foreground tracking-tight sm:inline">Smart Construction Connect</span>
          <span className="text-lg font-bold text-foreground tracking-tight sm:hidden">SCC</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button onClick={toggleTheme} variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/login")}
            className="h-10 rounded-xl px-3 border-border/60 text-foreground/80 hover:text-foreground hover:border-primary/30 hover:bg-accent/30 sm:px-4"
          >
            Sign In
          </Button>
          <Button
            onClick={() => navigate("/signup")}
            className="h-10 rounded-xl px-3 gradient-bg text-primary-foreground text-sm font-semibold shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30 hover:brightness-110 transition-all duration-200 sm:px-5"
          >
            {t("landing.startFree")}
          </Button>
        </div>
      </motion.nav>

      <main className="relative z-10 flex flex-1 flex-col items-center px-4 sm:px-6">

        {/* ─── Hero Section — Split Layout ──────────────────── */}
        <section ref={heroRef} className="w-full max-w-6xl py-16 lg:py-24">
          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="grid items-center gap-12 lg:grid-cols-2"
          >
            {/* Left: Text */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <motion.div
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary backdrop-blur-sm"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                Pakistan's #1 Construction Platform
              </motion.div>

              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {t("landing.heroTitle").split(",")[0]},{" "}
                <br />
                <span className="animated-gradient-text">{t("landing.heroTitle").split(",")[1]?.replace("Partners", "").trim() || "Find Better"}</span>
                <br />
                Partners
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground"
              >
                {t("landing.heroDesc")}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.4 }}
                className="mt-10 flex flex-wrap items-center gap-4"
              >
                <Button
                  onClick={() => navigate("/signup")}
                  className="h-13 rounded-2xl px-8 gradient-bg text-primary-foreground font-semibold text-base gap-2 shadow-lg shadow-primary/25"
                >
                  Start Free <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => navigate("/login")}
                  variant="outline"
                  className="h-13 rounded-2xl px-8 border border-border/70 bg-background/60 backdrop-blur-sm font-semibold text-base text-foreground hover:border-primary/40 hover:bg-background/80 hover:text-primary/90 transition-all duration-300"
                >
                  {t("common.signIn")}
                </Button>
              </motion.div>

              {/* Trust bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="mt-10 flex flex-wrap items-center gap-6 text-sm text-muted-foreground"
              >
                {[
                  { icon: Shield, label: "SECP Verified" },
                  { icon: MapPin, label: "30+ Cities" },
                  { icon: Star, label: "4.9 Rating" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4 text-primary" />
                    <span>{label}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right: Construction image with stats overlay */}
            <motion.div
              initial={{ opacity: 0, x: 24, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="relative hidden lg:block"
            >
              <div className="relative overflow-hidden rounded-3xl border border-border/40 shadow-2xl shadow-black/30">
                <img
                  src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80"
                  alt="Construction site"
                  className="h-[480px] w-full object-cover"
                />
                {/* Dark overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Bottom overlay stats */}
                <div className="absolute bottom-0 start-0 end-0 p-5">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "120+", label: "Companies" },
                      { value: "3,500+", label: "Projects" },
                      { value: "98%", label: "Satisfaction" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-2xl border border-white/10 bg-black/40 p-3 text-center backdrop-blur-md">
                        <p className="text-xl font-bold text-white">{s.value}</p>
                        <p className="text-[11px] text-white/70">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top badge */}
                <div className="absolute end-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-xs font-medium text-white">Live Platform</span>
                </div>
              </div>

              {/* Floating AI card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="absolute -bottom-6 -left-6 w-52 rounded-2xl border border-border/50 bg-card/90 p-4 shadow-xl backdrop-blur-xl"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">AI Matching</p>
                    <p className="text-[10px] text-muted-foreground">Best match found</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full gradient-bg"
                    initial={{ width: 0 }}
                    animate={{ width: "87%" }}
                    transition={{ delay: 1.2, duration: 1, ease: "easeOut" }}
                  />
                </div>
                <p className="mt-1 text-end text-[10px] text-primary font-semibold">87% Match</p>
              </motion.div>
            </motion.div>
          </motion.div>
        </section>

        {/* ─── Who It's For ─────────────────────────────────── */}
        <SectionReveal className="w-full max-w-5xl py-16">
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Built for Every Role
            </div>
            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
              {t("landing.whoIsFor").split(" ").slice(0, -1).join(" ")} <span className="gradient-text">{t("landing.whoIsFor").split(" ").pop()}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              {t("landing.whoIsForDesc")}
            </p>
          </div>
          <StaggerList className="grid gap-6 sm:grid-cols-3" stagger={0.12}>
            {roles.map((role) => (
              <StaggerItem key={role.title}>
                <TiltCard tiltMaxAngleX={6} tiltMaxAngleY={6} scale={1.02}>
                  <GlassCard
                    className={cn(
                      "p-6 h-full border",
                      role.highlighted ? "ring-1 ring-primary/30 border-primary/20" : "border-border/50"
                    )}
                  >
                    {role.highlighted && (
                      <Badge className="mb-3 rounded-full text-[10px] px-2.5">Most Popular</Badge>
                    )}
                    <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border", role.bg, role.border)}>
                      <role.icon className={cn("h-5.5 w-5.5", role.color)} />
                    </div>
                    <h3 className="text-base font-bold text-foreground">{role.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{role.desc}</p>
                    <ul className="mt-4 space-y-2">
                      {role.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className={cn("h-3.5 w-3.5 shrink-0", role.color)} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => navigate("/signup")}
                      variant="outline"
                      className={cn("mt-5 w-full rounded-xl text-sm", role.highlighted && "border-primary/30 hover:border-primary/50 hover:text-primary")}
                    >
                      Join as {role.title.split(" ")[0]} <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </GlassCard>
                </TiltCard>
              </StaggerItem>
            ))}
          </StaggerList>
        </SectionReveal>

        <div className="section-divider max-w-5xl" />

        {/* ─── Process Steps ────────────────────────────────── */}
        <SectionReveal className="w-full max-w-5xl py-16">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
              {t("landing.howItWorks").split(" ").slice(0, -1).join(" ")} <span className="gradient-text">{t("landing.howItWorks").split(" ").pop()}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              {t("landing.howItWorksDesc")}
            </p>
          </div>

          <div className="relative">
            {/* Connecting line (desktop) */}
            <div className="absolute start-1/2 top-10 hidden h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/30 to-transparent sm:block" />

            <StaggerList className="grid gap-8 sm:grid-cols-3" stagger={0.15}>
              {processSteps.map((step, i) => (
                <StaggerItem key={step.title}>
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-5">
                      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 ring-1 ring-primary/20">
                        <step.icon className="h-8 w-8 text-primary" />
                      </div>
                      <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full gradient-bg text-xs font-bold text-primary-foreground shadow-md shadow-primary/30">
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerList>
          </div>
        </SectionReveal>

        <div className="section-divider max-w-5xl" />

        {/* ─── Construction Image Banner ────────────────────── */}
        <SectionReveal className="w-full max-w-5xl py-8">
          <div className="relative overflow-hidden rounded-3xl border border-border/40">
            <img
              src="https://images.unsplash.com/photo-1587582423116-ec07293f0395?auto=format&fit=crop&w=1200&q=80"
              alt="Construction worker building residential frame"
              className="h-64 w-full object-cover sm:h-80"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
            <div className="absolute inset-0 flex items-center px-8 sm:px-14">
              <div className="max-w-lg">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">{t("landing.poweredByAI")}</p>
                <h3 className="text-2xl font-bold text-white sm:text-3xl leading-tight">
                  {t("landing.smarterDecisions")}
                </h3>
                <p className="mt-3 text-sm text-white/70">
                  {t("landing.aiDesc")}
                </p>
                <Button
                  onClick={() => navigate("/signup")}
                  className="mt-5 h-11 rounded-xl px-6 gradient-bg text-primary-foreground font-semibold shadow-lg shadow-primary/20"
                >
                  Get Matched Now <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </SectionReveal>

        <div className="section-divider max-w-5xl" />

        {/* ─── Features Grid ────────────────────────────────── */}
        <SectionReveal className="w-full max-w-5xl py-16">
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t("landing.platformFeatures")}
            </div>
            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
              {t("landing.everythingYouNeed").replace("Build", "")} <span className="gradient-text">{"Build"}</span>
            </h2>
          </div>

          <StaggerList className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger={0.08}>
            {features.map((f) => (
              <StaggerItem key={f.title}>
                <GlassCard className="p-6 text-start h-full hover:border-primary/30 transition-colors duration-200">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </GlassCard>
              </StaggerItem>
            ))}
          </StaggerList>
        </SectionReveal>

        <div className="section-divider max-w-5xl" />

        {/* ─── Stats Section ────────────────────────────────── */}
        <SectionReveal className="w-full max-w-5xl py-16">
          <GlassCard interactive={false} className="relative overflow-hidden p-8 sm:p-12 glow-ring">
            <div className="absolute inset-0 opacity-15 gradient-bg" />
            <div className="relative z-10">
              <p className="mb-8 text-center text-sm font-semibold uppercase tracking-widest text-primary">
                Platform Impact
              </p>
              <StaggerList className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
                {stats.map((stat) => (
                  <StaggerItem key={stat.label}>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-foreground sm:text-5xl">
                        <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                      </p>
                      <p className="mt-2 text-sm font-medium text-muted-foreground">{stat.label}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerList>
            </div>
          </GlassCard>
        </SectionReveal>

        <div className="section-divider max-w-5xl" />

        {/* ─── Testimonials ─────────────────────────────────── */}
        <SectionReveal className="w-full max-w-5xl py-16">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
              {t("landing.trustedByBuilders").replace("Builders", "")} <span className="gradient-text">{"Builders"}</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              {t("landing.testimonialDesc")}
            </p>
          </div>
          <StaggerList className="grid gap-6 sm:grid-cols-3" stagger={0.1}>
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
                <GlassCard className="p-6 h-full flex flex-col">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn("h-4 w-4", i < t.rating ? "fill-warning text-warning" : "text-muted-foreground/30")}
                      />
                    ))}
                  </div>
                  <p className="flex-1 text-sm text-muted-foreground leading-relaxed italic">
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div className="mt-5 flex items-center gap-3 pt-4 border-t border-border">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full gradient-bg text-xs font-bold text-primary-foreground">
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </GlassCard>
              </StaggerItem>
            ))}
          </StaggerList>
        </SectionReveal>

        {/* ─── CTA Section ──────────────────────────────────── */}
        <SectionReveal className="w-full max-w-5xl pb-20">
          <div className="relative overflow-hidden rounded-3xl border border-border/40">
            <img
              src="https://images.unsplash.com/photo-1551711974-faf378be34b2?auto=format&fit=crop&w=1200&q=80"
              alt="Construction crane at sunset"
              className="h-72 w-full object-cover sm:h-80"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/30" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
                {t("landing.readyToBuild")}
              </h2>
              <p className="mx-auto mt-4 max-w-md text-white/70 text-lg">
                {t("landing.readyToBuildDesc")}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  onClick={() => navigate("/signup")}
                  className="h-13 rounded-2xl px-8 gradient-bg text-primary-foreground font-semibold gap-2 shadow-lg shadow-primary/25"
                >
                  <Building2 className="h-4 w-4" />
                  {t("landing.browseCompanies")}
                </Button>
                <Button
                  onClick={() => navigate("/signup")}
                  variant="outline"
                  className="h-13 rounded-2xl px-8 border border-white/30 bg-white/10 backdrop-blur-sm font-semibold text-white hover:border-white/50 hover:bg-white/20 transition-all duration-300 gap-2"
                >
                  <Bot className="h-4 w-4" />
                  {t("landing.tryAI")}
                </Button>
              </div>
            </div>
          </div>
        </SectionReveal>
      </main>

      {/* ─── Footer ─────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border bg-background/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img src="/Logo.png" alt="SCC" className="h-7 w-7 rounded-lg object-contain" />
            <span className="text-sm font-semibold text-foreground">Smart Construction Connect</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>{t("landing.footerTagline")}</span>
            <span>{t("landing.footerCopyright", { year: new Date().getFullYear() })}</span>
          </div>
        </div>
      </footer>

      {/* Floating AI Assistant */}
      <FloatingAIAssistant />
    </div>
  );
}

