import { useState, type ElementType } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore, UserRole } from "@/stores/authStore";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AnimatedBackground } from "@/components/shared/AnimatedBackground";
import { ParticleBackground } from "@/components/shared/ParticleBackground";
import {
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  HardHat,
  Package,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const roles: { value: UserRole; label: string; desc: string; icon: ElementType }[] = [
    { value: "client", label: "Client", desc: "Browse & compare companies", icon: UserRound },
    { value: "company", label: "Company", desc: "Manage leads & projects", icon: Building2 },
    { value: "supplier", label: "Supplier", desc: "Inventory & pricing", icon: Package },
    { value: "admin", label: "Admin", desc: "Approvals & oversight", icon: ShieldCheck },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password, role);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <ParticleBackground />
      <AnimatedBackground />
      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-stretch gap-8 p-4 sm:p-6 lg:grid-cols-2 lg:gap-10 lg:p-10">
        {/* Left: Brand + trust */}
        <motion.section
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          className="relative hidden overflow-hidden rounded-3xl border border-border bg-card p-10 lg:flex"
        >
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-highlight/10 blur-3xl" />
          <div className="relative flex h-full w-full flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <HardHat className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-wide text-foreground">Smart Construction Connect</p>
                  <p className="text-xs text-muted-foreground">Industrial-grade matching • Requests • Supply</p>
                </div>
              </div>

              <h1 className="mt-10 text-3xl font-extrabold leading-tight text-foreground">
                Built for serious construction teams.
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                A trusted workspace to evaluate verified partners, manage incoming requests, and keep your projects and materials on track.
              </p>

              <div className="mt-8 grid gap-3">
                {[
                  { icon: ShieldCheck, title: "Verified ecosystem", desc: "Partners screened for quality and reliability." },
                  { icon: Building2, title: "Request management", desc: "Track, accept, reject — with clear status flows." },
                  { icon: Package, title: "Supplier inventory", desc: "Material catalogs with pricing and stock visibility." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/40 p-4">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Security-first • Audit-friendly</span>
              <span className="text-premium">Premium industrial UI</span>
            </div>
          </div>
        </motion.section>

        {/* Right: Form */}
        <motion.section
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          className="flex items-center justify-center"
        >
          <GlassCard interactive={false} className="w-full max-w-md p-7 sm:p-8">
            <div className="mb-5 flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
            <div className="mb-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <HardHat className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Sign in</p>
                  <p className="text-xs text-muted-foreground">Access your workspace</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Role selector */}
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Select role</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {roles.map((r) => {
                    const selected = role === r.value;
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={cn(
                          "group flex items-start gap-3 rounded-2xl border p-3 text-left transition-all",
                          selected
                            ? "border-primary/60 bg-primary/10"
                            : "border-border bg-background/30 hover:border-primary/30 hover:bg-background/40",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl",
                            selected ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-sm font-semibold", selected ? "text-primary" : "text-foreground")}>{r.label}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="bg-background/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="bg-background/40 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                  Remember me
                </label>
                <Button type="button" variant="link" className="h-auto p-0 text-sm">
                  Forgot password?
                </Button>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  {error}
                </motion.div>
              )
              }

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button type="submit" className="w-full">
                  Sign In
                </Button>
              </motion.div>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Create one
              </Link>
            </p>
          </GlassCard>
        </motion.section>
      </div>
    </div>
  );
}
