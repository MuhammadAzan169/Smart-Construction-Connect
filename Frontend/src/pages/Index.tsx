import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { motion } from "framer-motion";
import { HardHat, ArrowRight, Building2, Bot, Shield } from "lucide-react";
import { useEffect } from "react";

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
          <button onClick={() => navigate("/login")} className="h-9 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent">
            Sign In
          </button>
          <button onClick={() => navigate("/signup")} className="h-9 rounded-lg gradient-bg px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
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
            <button
              onClick={() => navigate("/signup")}
              className="flex h-12 items-center gap-2 rounded-xl gradient-bg px-8 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start Free <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate("/login")}
              className="h-12 rounded-xl border border-border bg-card px-8 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Sign In
            </button>
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
              className="rounded-2xl border border-border bg-card p-6 text-left card-shadow transition-shadow hover:card-shadow-hover"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
