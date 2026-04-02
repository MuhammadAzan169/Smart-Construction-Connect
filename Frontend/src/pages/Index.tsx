import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  HardHat, ArrowRight, Building2, Bot, Shield, Check, Sparkles,
  Star, TrendingUp, Award, Ruler, ClipboardList,
  Truck, Moon, Sun, Hammer
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/GlassCard";
import { TiltCard } from "@/components/shared/TiltCard";
import { AnimatedBackground } from "@/components/shared/AnimatedBackground";
import { ParticleBackground } from "@/components/shared/ParticleBackground";
import {
  SectionReveal, StaggerList, StaggerItem, FloatingElement,
  AnimatedCounter
} from "@/components/shared/AnimationPrimitives";
import { useThemeStore } from "@/stores/themeStore";
import { cn } from "@/lib/utils";

/* ─── Data ──────────────────────────────────────────────────── */
type Plan = {
  name: string;
  price: string;
  description: string;
  features: string[];
  tone: "base" | "primary" | "premium";
  cta: string;
  highlight?: boolean;
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
    features: ["Unlimited requests", "Priority matching", "AI assistant access", "Compare suppliers"],
    tone: "primary",
    cta: "Choose Pro",
    highlight: true,
  },
  {
    name: "Premium",
    price: "PKR 12,999/mo",
    description: "Gold-tier control, visibility, and analytics.",
    features: ["Premium supplier visibility", "Advanced analytics", "Priority support", "Dedicated manager"],
    tone: "premium",
    cta: "Go Premium",
  },
];

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
    text: "Found the perfect construction company within days. The AI matching is incredibly accurate.",
    rating: 5,
  },
  {
    name: "Saeed Construction",
    role: "Construction Company",
    text: "Our lead quality improved 3x after joining the platform. The request management system is excellent.",
    rating: 5,
  },
  {
    name: "BuildMart Supplies",
    role: "Material Supplier",
    text: "Managing inventory and pricing has never been easier. Direct connections with builders save us time.",
    rating: 4,
  },
];

const processSteps = [
  { icon: ClipboardList, title: "Plan", desc: "Define your requirements and budget" },
  { icon: Hammer, title: "Build", desc: "Match with verified partners" },
  { icon: Truck, title: "Deliver", desc: "Track progress to completion" },
];

/* ─── Component ─────────────────────────────────────────────── */
export default function Index() {
  const { isAuthenticated } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const features = [
    { icon: Building2, title: "Smart Matching", desc: "AI connects you with the best construction companies for your project." },
    { icon: Bot, title: "AI Assistant", desc: "Chat with our intelligent assistant for personalized recommendations." },
    { icon: Shield, title: "Verified Partners", desc: "Every company is vetted and rated by real clients." },
    { icon: Award, title: "Quality Guarantee", desc: "Premium partners meet strict quality control standards." },
    { icon: Ruler, title: "Cost Estimation", desc: "Get instant AI-powered cost estimates for any project size." },
    { icon: TrendingUp, title: "Market Insights", desc: "Real-time pricing trends and material cost tracking." },
  ];

  return (
    <div className="relative flex min-h-screen flex-col bg-background overflow-x-hidden">
      <ParticleBackground />
      <AnimatedBackground />

      {/* ─── Navbar ─────────────────────────────────────────── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background/30 px-6 backdrop-blur-xl lg:px-12"
      >
        <div className="flex items-center gap-2">
          <motion.div
            className="flex h-9 w-9 items-center justify-center rounded-lg gradient-bg"
            whileHover={{ scale: 1.08, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <HardHat className="h-5 w-5 text-primary-foreground" />
          </motion.div>
          <span className="text-lg font-bold text-foreground">Smart Connect</span>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={toggleTheme} variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={() => navigate("/login")}>
            Sign In
          </Button>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button onClick={() => navigate("/signup")}>
              Get Started
            </Button>
          </motion.div>
        </div>
      </motion.nav>

      <main className="relative z-10 flex flex-1 flex-col items-center px-6">
        {/* ─── Hero Section ─────────────────────────────────── */}
        <section ref={heroRef} className="relative flex flex-col items-center justify-center py-24 text-center lg:py-32">
          <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <span className="h-2 w-2 rounded-full bg-success animate-pulse-ring" />
                AI-Powered Construction Platform
              </motion.div>

              <h1 className="text-4xl font-extrabold leading-tight text-foreground sm:text-5xl lg:text-6xl">
                Build Smarter with{" "}
                <span className="animated-gradient-text">Intelligent Matching</span>
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground"
              >
                Connect with verified construction companies, compare quotes, and manage your projects — all powered by AI.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.4 }}
                className="mt-10 flex justify-center gap-4"
              >
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Button onClick={() => navigate("/signup")} className="h-12 rounded-xl px-8">
                    Start Free <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Button onClick={() => navigate("/login")} variant="outline" className="h-12 rounded-xl px-8">
                    Sign In
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Floating decorative elements */}
          <FloatingElement className="absolute left-[10%] top-[20%] hidden lg:block" amplitude={8} duration={5}>
            <div className="h-12 w-12 rounded-2xl bg-primary/10 backdrop-blur-sm" />
          </FloatingElement>
          <FloatingElement className="absolute right-[12%] top-[35%] hidden lg:block" amplitude={6} duration={4}>
            <div className="h-8 w-8 rounded-xl bg-highlight/10 backdrop-blur-sm" />
          </FloatingElement>
          <FloatingElement className="absolute bottom-[15%] left-[20%] hidden lg:block" amplitude={10} duration={6}>
            <div className="h-6 w-6 rounded-lg bg-premium/10 backdrop-blur-sm" />
          </FloatingElement>
        </section>

        {/* ─── Process Steps: Plan → Build → Deliver ────────── */}
        <SectionReveal className="w-full max-w-4xl py-16">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              How It <span className="gradient-text">Works</span>
            </h2>
          </div>
          <StaggerList className="grid gap-6 sm:grid-cols-3" stagger={0.15}>
            {processSteps.map((step, i) => (
              <StaggerItem key={step.title}>
                <div className="flex flex-col items-center text-center">
                  <motion.div
                    className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"
                    whileHover={{ scale: 1.1, rotate: 4 }}
                  >
                    <step.icon className="h-7 w-7 text-primary" />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                  </motion.div>
                  <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
        </SectionReveal>

        <div className="section-divider max-w-5xl" />

        {/* ─── Features Section ─────────────────────────────── */}
        <SectionReveal className="w-full max-w-5xl py-16">
          <div className="text-center mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Platform Features
            </div>
            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
              Everything You Need to{" "}
              <span className="gradient-text">Build</span>
            </h2>
          </div>

          <StaggerList className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 focus-highlight" stagger={0.08}>
            {features.map((f) => (
              <StaggerItem key={f.title}>
                <TiltCard tiltMaxAngleX={6} tiltMaxAngleY={6} scale={1.02}>
                  <GlassCard className="p-6 text-left h-full">
                    <motion.div
                      className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"
                      whileHover={{ rotate: 8, scale: 1.1 }}
                    >
                      <f.icon className="h-5 w-5 text-primary" />
                    </motion.div>
                    <h3 className="mb-2 font-semibold text-foreground">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </GlassCard>
                </TiltCard>
              </StaggerItem>
            ))}
          </StaggerList>
        </SectionReveal>

        <div className="section-divider max-w-5xl" />

        {/* ─── Stats Section ────────────────────────────────── */}
        <SectionReveal className="w-full max-w-4xl py-16">
          <GlassCard interactive={false} className="relative overflow-hidden p-8 sm:p-12">
            <div className="absolute inset-0 opacity-20 gradient-bg" />
            <div className="relative z-10">
              <StaggerList className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4" stagger={0.1}>
                {stats.map((stat) => (
                  <StaggerItem key={stat.label}>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-foreground sm:text-4xl">
                        <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerList>
            </div>
          </GlassCard>
        </SectionReveal>

        <div className="section-divider max-w-5xl" />

        {/* ─── Pricing Section ──────────────────────────────── */}
        <SectionReveal className="w-full max-w-5xl py-16">
          <div className="text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Transparent Pricing
            </div>
            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
              Simple, Honest <span className="gradient-text">Pricing</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Choose a plan that fits your project. Upgrade or cancel anytime.
            </p>
          </div>

          <StaggerList className="mt-12 grid gap-6 sm:grid-cols-3" stagger={0.12}>
            {plans.map((plan) => {
              const isPremium = plan.tone === "premium";
              return (
                <StaggerItem key={plan.name}>
                  <TiltCard tiltMaxAngleX={5} tiltMaxAngleY={5}>
                    <GlassCard
                      className={cn(
                        "relative p-6 h-full",
                        plan.highlight && "ring-1 ring-primary/40",
                        isPremium && "ring-1 ring-premium/30 bg-premium/5"
                      )}
                    >
                      {plan.highlight && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3">
                          Most Popular
                        </Badge>
                      )}

                      <div>
                        <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                      </div>

                      <div className="mt-5">
                        <p className="text-3xl font-bold text-foreground">{plan.price}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Billed monthly. Cancel anytime.</p>
                      </div>

                      <div className="mt-5 space-y-2">
                        {plan.features.map((f) => (
                          <div key={f} className="flex items-start gap-2 text-sm">
                            <div className={cn("mt-0.5 rounded-md p-1", isPremium ? "bg-premium/10" : "bg-primary/10")}>
                              <Check className={cn("h-3.5 w-3.5", isPremium ? "text-premium" : "text-primary")} />
                            </div>
                            <span className="text-foreground">{f}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button
                            className={cn(
                              "w-full",
                              isPremium && "bg-premium text-premium-foreground hover:bg-premium/90"
                            )}
                            variant={plan.tone === "base" ? "secondary" : "default"}
                            onClick={() => navigate("/signup")}
                          >
                            {plan.cta}
                          </Button>
                        </motion.div>
                      </div>
                    </GlassCard>
                  </TiltCard>
                </StaggerItem>
              );
            })}
          </StaggerList>
        </SectionReveal>

        <div className="section-divider max-w-5xl" />

        {/* ─── Testimonials Section ─────────────────────────── */}
        <SectionReveal className="w-full max-w-5xl py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
              Trusted by <span className="gradient-text">Builders</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Hear from homeowners, companies, and suppliers on the platform.
            </p>
          </div>

          <StaggerList className="grid gap-6 sm:grid-cols-3" stagger={0.1}>
            {testimonials.map((t) => (
              <StaggerItem key={t.name}>
                <GlassCard className="p-6 h-full flex flex-col">
                  <div className="flex gap-0.5 mb-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-4 w-4",
                          i < t.rating ? "fill-warning text-warning" : "text-muted-foreground/30"
                        )}
                      />
                    ))}
                  </div>
                  <p className="flex-1 text-sm text-muted-foreground leading-relaxed italic">
                    &ldquo;{t.text}&rdquo;
                  </p>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </GlassCard>
              </StaggerItem>
            ))}
          </StaggerList>
        </SectionReveal>

        {/* ─── CTA Section ──────────────────────────────────── */}
        <SectionReveal className="w-full max-w-4xl pb-20">
          <GlassCard className="relative overflow-hidden p-8 text-center sm:p-12">
            <div className="absolute inset-0 opacity-25 gradient-bg" />
            <div className="relative z-10">
              <motion.h2
                className="text-2xl font-extrabold text-foreground sm:text-3xl"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                Ready to build your dream home?
              </motion.h2>
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">
                Explore verified companies, compare quotes, or chat with our AI assistant for personalized recommendations.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Button onClick={() => navigate("/signup")} className="h-12 rounded-xl px-8">
                    <Building2 className="h-4 w-4" />
                    Browse Companies
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Button onClick={() => navigate("/signup")} variant="outline" className="h-12 rounded-xl px-8">
                    <Bot className="h-4 w-4" />
                    Try AI Assistant
                  </Button>
                </motion.div>
              </div>
            </div>
          </GlassCard>
        </SectionReveal>
      </main>

      {/* ─── Footer ─────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border bg-background/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <HardHat className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Smart Connect</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Smart Construction Connect. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
