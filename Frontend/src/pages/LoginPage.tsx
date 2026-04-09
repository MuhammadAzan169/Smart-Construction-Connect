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
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  HardHat,
  Lock,
  Mail,
  Package,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
} as const;
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
} as const;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const roles: { value: UserRole; label: string; desc: string; icon: ElementType; gradient: string }[] = [
    { value: "client", label: t("roles.client"), desc: t("roles.clientDesc"), icon: UserRound, gradient: "from-blue-500/20 to-cyan-500/10" },
    { value: "company", label: t("roles.company"), desc: t("roles.companyDesc"), icon: Building2, gradient: "from-amber-500/20 to-orange-500/10" },
    { value: "supplier", label: t("roles.supplier"), desc: t("roles.supplierDesc"), icon: Package, gradient: "from-emerald-500/20 to-green-500/10" },
    { value: "admin", label: t("roles.admin"), desc: t("roles.adminDesc"), icon: ShieldCheck, gradient: "from-purple-500/20 to-violet-500/10" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, role);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || t("auth.signInFailed"));
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { icon: Building2, value: "500+", label: t("auth.verifiedCompanies") },
    { icon: TrendingUp, value: "12K+", label: t("auth.projectsCompleted") },
    { icon: UserRound, value: "8K+", label: t("auth.activeClients") },
  ];

  const features = [
    { icon: ShieldCheck, title: t("landing.verifiedPartners"), desc: t("landing.verifiedPartnersDesc") },
    { icon: Zap, title: t("landing.smartMatching"), desc: t("landing.smartMatchingDesc") },
    { icon: Package, title: t("landing.marketInsights"), desc: t("landing.marketInsightsDesc") },
  ];

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <ParticleBackground />
      <AnimatedBackground />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-stretch gap-8 p-4 sm:p-6 lg:grid-cols-2 lg:gap-10 lg:p-10">
        {/* ── Left panel ── */}
        <motion.section
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative hidden overflow-hidden rounded-3xl border border-border/60 bg-card p-10 lg:flex"
        >
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-highlight/10 blur-3xl" />
          <div className="pointer-events-none absolute start-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-premium/5 blur-2xl" />

          <div className="relative flex h-full w-full flex-col justify-between">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-highlight shadow-lg shadow-primary/30">
                  <HardHat className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-bold tracking-wide text-foreground">Smart Construction Connect</p>
                  <p className="text-xs text-muted-foreground">Industrial-grade matching • Supply • Requests</p>
                </div>
              </div>

              <h1 className="mt-10 text-4xl font-extrabold leading-tight">
                <span className="text-foreground">Built for serious</span>
                <br />
                <span className="bg-gradient-to-r from-primary via-amber-400 to-highlight bg-clip-text text-transparent">
                  construction teams.
                </span>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                Evaluate verified partners, manage incoming requests, and keep your projects and materials on track — all in one workspace.
              </p>

              {/* Stats row */}
              <div className="mt-8 grid grid-cols-3 gap-3">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-2xl border border-border/60 bg-secondary/30 p-3 text-center backdrop-blur-sm">
                    <s.icon className="mx-auto mb-1 h-4 w-4 text-primary" />
                    <p className="text-base font-extrabold text-foreground">{s.value}</p>
                    <p className="text-[10px] leading-tight text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Feature list */}
              <div className="mt-6 grid gap-3">
                {features.map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.1, duration: 0.4 }}
                    className="flex items-start gap-3 rounded-2xl border border-border/50 bg-secondary/30 p-4 backdrop-blur-sm"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                      <item.icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Footer trust line */}
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/20 px-4 py-2.5 text-xs text-muted-foreground backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                <span>Security-first • JWT-secured • Audit-ready</span>
              </div>
              <span className="font-semibold text-premium">Premium</span>
            </div>
          </div>
        </motion.section>

        {/* ── Right: Form ── */}
        <motion.section
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex items-center justify-center py-4"
        >
          <div className="w-full max-w-md">
            {/* Back button */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-4 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="h-4 w-4" />
                {t("common.back")}
              </Button>
            </motion.div>

            <GlassCard interactive={false} className="w-full overflow-hidden p-0">
              {/* Card top accent bar */}
              <div className="h-1 w-full bg-gradient-to-r from-primary via-amber-400 to-highlight" />

              <div className="p-7 sm:p-8">
                {/* Header */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="mb-7"
                >
                  <motion.div variants={itemVariants} className="mb-5 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-highlight shadow-lg shadow-primary/20">
                      <HardHat className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-foreground">{t("auth.welcomeBack")}</h2>
                      <p className="text-xs text-muted-foreground">{t("auth.signInWorkspace")}</p>
                    </div>
                  </motion.div>

                  {/* Role selector */}
                  <motion.div variants={itemVariants}>
                    <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("auth.chooseRole")}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {roles.map((r) => {
                        const selected = role === r.value;
                        const Icon = r.icon;
                        return (
                          <motion.button
                            key={r.value}
                            type="button"
                            onClick={() => setRole(r.value)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            className={cn(
                              "relative flex items-start gap-2.5 overflow-hidden rounded-2xl border p-3 text-start transition-all duration-200",
                              selected
                                ? "border-primary/70 bg-primary/10 shadow-sm shadow-primary/20"
                                : "border-border/60 bg-background/20 hover:border-primary/30 hover:bg-background/40",
                            )}
                          >
                            {selected && (
                              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", r.gradient)} />
                            )}
                            <div className={cn(
                              "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
                              selected
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "bg-secondary text-muted-foreground",
                            )}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="relative min-w-0">
                              <p className={cn("text-sm font-semibold leading-tight", selected ? "text-primary" : "text-foreground")}>
                                {r.label}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.desc}</p>
                            </div>
                            {selected && (
                              <CheckCircle2 className="absolute end-2 top-2 h-3.5 w-3.5 text-primary" />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                </motion.div>

                <form onSubmit={handleSubmit}>
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4"
                  >
                    {/* Email */}
                    <motion.div variants={itemVariants} className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("auth.emailLabel")}
                      </Label>
                      <div className="relative">
                        <Mail className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@company.com"
                          required
                          className="bg-background/30 ps-9 transition-all focus:bg-background/50 focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </motion.div>

                    {/* Password */}
                    <motion.div variants={itemVariants} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("auth.password")}
                        </Label>
                        <Button type="button" variant="link" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary">
                          {t("auth.forgotPassword")}
                        </Button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                        <Input
                          id="password"
                          type={showPw ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="bg-background/30 ps-9 pe-10 transition-all focus:bg-background/50 focus:ring-2 focus:ring-primary/30"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(!showPw)}
                          className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                          aria-label={showPw ? "Hide password" : "Show password"}
                        >
                          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </motion.div>

                    {/* Remember me */}
                    <motion.div variants={itemVariants}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
                        <Checkbox
                          checked={remember}
                          onCheckedChange={(v) => setRemember(Boolean(v))}
                          className="rounded-md"
                        />
                        <span>{t("auth.rememberMe")}</span>
                      </label>
                    </motion.div>

                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          key="error"
                          initial={{ opacity: 0, y: -8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                        >
                          <span className="mt-0.5 text-destructive">⚠</span>
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit */}
                    <motion.div variants={itemVariants}>
                      <motion.button
                        type="submit"
                        disabled={loading}
                        whileHover={{ scale: loading ? 1 : 1.015 }}
                        whileTap={{ scale: loading ? 1 : 0.985 }}
                        className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-highlight px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all disabled:cursor-not-allowed disabled:opacity-60 hover:shadow-primary/40"
                      >
                        <AnimatePresence mode="wait">
                          {loading ? (
                            <motion.span
                              key="loading"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center justify-center gap-2"
                            >
                              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              {t("auth.signingIn")}
                            </motion.span>
                          ) : (
                            <motion.span
                              key="idle"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex items-center justify-center gap-2"
                            >
                              <Sparkles className="h-4 w-4" />
                              {t("common.signIn")}
                            </motion.span>
                          )}
                        </AnimatePresence>
                        {/* Shimmer overlay */}
                        {!loading && (
                          <motion.div
                            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
                            animate={{ translateX: ["−100%", "200%"] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                          />
                        )}
                      </motion.button>
                    </motion.div>
                  </motion.div>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  {t("auth.signUpInstead")}{" "}
                  <Link to="/signup" className="font-semibold text-primary transition-colors hover:text-highlight hover:underline">
                    {t("common.signUp")}
                  </Link>
                </p>
              </div>
            </GlassCard>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
