import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { motion } from "framer-motion";
import { HardHat, ArrowRight, Building2, Bot, Shield, Check, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/GlassCard";
import { cn } from "@/lib/utils";

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

export default function Index() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const features = [
    { icon: Building2, title: "Smart Matching", desc: "AI connects you with the best construction companies for your project." },
    { icon: Bot, title: "AI Assistant", desc: "Chat with our intelligent assistant for personalized recommendations." },
    { icon: Shield, title: "Verified Partners", desc: "Every company is vetted and rated by real clients." },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navbar */}
      <nav className="flex h-16 items-center justify-between border-b border-border px-6 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-bg">
            <HardHat className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">Smart Connect</span>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/login")}>
            Sign In
          </Button>
          <Button onClick={() => navigate("/signup")}>
            Get Started
          </Button>
        </div>
      </nav>

      <main className="flex flex-1 flex-col items-center px-6">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse-ring" />
              AI-Powered Construction Platform
            </div>
            <h1 className="text-4xl font-extrabold leading-tight text-foreground sm:text-5xl lg:text-6xl">
              Build Smarter with{" "}
              <span className="gradient-text">Intelligent Matching</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Connect with verified construction companies, compare quotes, and manage your projects — all powered by AI.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Button onClick={() => navigate("/signup")} className="h-12 rounded-xl px-8">
                Start Free <ArrowRight className="h-4 w-4" />
              </Button>
              <Button onClick={() => navigate("/login")} variant="outline" className="h-12 rounded-xl px-8">
                Sign In
              </Button>
            </div>
          </motion.div>

          {/* Feature cards */}
          <div className="mt-24 grid max-w-4xl gap-6 sm:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                whileHover={{ y: -4 }}
              >
                <GlassCard className="p-6 text-left">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-2 font-semibold text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Pricing Section */}
        <section className="w-full max-w-5xl py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Transparent Pricing
            </div>
            <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
              Simple, Honest <span className="gradient-text">Pricing</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              Choose a plan that fits your project. Upgrade or cancel anytime.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {plans.map((plan, i) => {
              const isPremium = plan.tone === "premium";
              return (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                  whileHover={{ y: -4 }}
                >
                  <GlassCard
                    className={cn(
                      "relative p-6",
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
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full max-w-4xl pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <GlassCard className="relative overflow-hidden p-8 text-center sm:p-12">
              <div className="absolute inset-0 opacity-30 gradient-bg" />
              <div className="relative z-10">
                <h2 className="text-2xl font-extrabold text-foreground sm:text-3xl">
                  Ready to build your dream home?
                </h2>
                <p className="mx-auto mt-4 max-w-md text-muted-foreground">
                  Explore verified companies, compare quotes, or chat with our AI assistant for personalized recommendations.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button onClick={() => navigate("/signup")} className="h-12 rounded-xl px-8">
                    <Building2 className="h-4 w-4" />
                    Browse Companies
                  </Button>
                  <Button onClick={() => navigate("/signup")} variant="outline" className="h-12 rounded-xl px-8">
                    <Bot className="h-4 w-4" />
                    Try AI Assistant
                  </Button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </section>
      </main>
    </div>
  );
}
