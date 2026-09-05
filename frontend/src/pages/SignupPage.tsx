import { useState, type ElementType } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore, UserRole } from "@/stores/authStore";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { AnimatedBackground } from "@/components/shared/AnimatedBackground";
import { ParticleBackground } from "@/components/shared/ParticleBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  HardHat,
  Lock,
  Mail,
  Package,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  XCircle,
} from "lucide-react";

function passwordStrength(pw: string): { score: number; labelKey: string; color: string; textColor: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, labelKey: "auth.weak", color: "bg-destructive", textColor: "text-destructive" };
  if (score <= 2) return { score, labelKey: "auth.fair", color: "bg-yellow-500", textColor: "text-yellow-500" };
  if (score <= 3) return { score, labelKey: "auth.good", color: "bg-primary", textColor: "text-primary" };
  return { score, labelKey: "auth.strong", color: "bg-green-500", textColor: "text-green-500" };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
} as const;
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: "easeOut" as const } },
} as const;

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const signup = useAuthStore((s) => s.signup);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const roles: { value: UserRole; label: string; desc: string; icon: ElementType; gradient: string; badge?: string }[] = [
    { value: "client", label: t("roles.client"), desc: t("roles.clientDesc"), icon: UserRound, gradient: "from-blue-500/20 to-cyan-500/10" },
    { value: "company", label: t("roles.company"), desc: t("roles.companyDesc"), icon: Building2, gradient: "from-amber-500/20 to-orange-500/10", badge: t("common.approvalNeeded") },
    { value: "supplier", label: t("roles.supplier"), desc: t("roles.supplierDesc"), icon: Package, gradient: "from-emerald-500/20 to-green-500/10", badge: t("common.approvalNeeded") },
    { value: "admin", label: t("roles.admin"), desc: t("roles.adminDesc"), icon: ShieldCheck, gradient: "from-purple-500/20 to-violet-500/10" },
  ];

  const strength = passwordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const needsBusinessInfo = role === "company" || role === "supplier";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(password)) { setError("Password must contain at least one uppercase letter."); return; }
    if (!/[0-9]/.test(password)) { setError("Password must contain at least one digit."); return; }
    if (!/[^A-Za-z0-9]/.test(password)) { setError("Password must contain at least one special character."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setSubmitting(true);
    try {
      // For business roles, use companyName as the display name if provided
      const displayName = needsBusinessInfo && companyName.trim() ? companyName.trim() : name;
      await signup(displayName, email, password, role, phone);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || t("auth.signupFailed"));
    } finally {
      setSubmitting(false);
    }
  };

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
                  <p className="text-xs text-muted-foreground">{t("auth.joinEcosystem")}</p>
                </div>
              </div>

              <h1 className="mt-10 text-4xl font-extrabold leading-tight">
                <span className="text-foreground">{t("auth.chooseRole")}</span>
                <br />
                <span className="bg-gradient-to-r from-primary via-amber-400 to-highlight bg-clip-text text-transparent">
                  {t("auth.joinEcosystem")}
                </span>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                Choose the role that matches your workflow. Each account type unlocks purpose-built tools and a tailored dashboard.
              </p>

              {/* Role breakdown */}
              <div className="mt-8 grid gap-3">
                {[
                  { icon: UserRound, role: "Client", desc: "Compare verified builders, send requests, track project bids." },
                  { icon: Building2, role: "Company", desc: "Manage incoming quotes, showcase projects, grow your pipeline." },
                  { icon: Store, role: "Supplier", desc: "List materials, set pricing, manage inventory in real-time." },
                ].map((item, i) => (
                  <motion.div
                    key={item.role}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                    className="flex items-start gap-3 rounded-2xl border border-border/50 bg-secondary/30 p-4 backdrop-blur-sm"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.role}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Approval notice */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.4 }}
                className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"
              >
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <p className="text-xs font-semibold text-amber-300">Company &amp; Supplier Approval</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Business accounts require admin review before full access. Clients get instant access.
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/20 px-4 py-2.5 text-xs text-muted-foreground backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                <span>GDPR-friendly • JWT-secured • Verified ecosystem</span>
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
              {/* Top accent */}
              <div className="h-1 w-full bg-gradient-to-r from-primary via-amber-400 to-highlight" />

              <div className="p-7 sm:p-8">
                {/* Header */}
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="mb-6">
                  <motion.div variants={itemVariants} className="mb-5 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-highlight shadow-lg shadow-primary/20">
                      <HardHat className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-foreground">{t("auth.createAccount")}</h2>
                      <p className="text-xs text-muted-foreground">{t("auth.joinEcosystem")}</p>
                    </div>
                  </motion.div>

                  {/* Role selector */}
                  <motion.fieldset variants={itemVariants}>
                    <legend className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {t("auth.chooseRole")}
                    </legend>
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
                              selected ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-muted-foreground",
                            )}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="relative min-w-0 flex-1">
                              <p className={cn("text-sm font-semibold leading-tight", selected ? "text-primary" : "text-foreground")}>
                                {r.label}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.desc}</p>
                            </div>
                            {selected && <CheckCircle2 className="absolute end-2 top-2 h-3.5 w-3.5 shrink-0 text-primary" />}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.fieldset>
                </motion.div>

                <form onSubmit={handleSubmit}>
                  <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                    {/* Full name */}
                    <motion.div variants={itemVariants} className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("auth.fullName")}
                      </Label>
                      <div className="relative">
                        <UserRound className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                        <Input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="John Doe"
                          required
                          className="bg-background/30 ps-9 transition-all focus:bg-background/50 focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </motion.div>

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
                      <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("auth.password")}
                      </Label>
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
                      <AnimatePresence>
                        {password.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-1.5 overflow-hidden pt-1"
                          >
                            <div className="flex gap-1">
                              {[...Array(5)].map((_, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ scaleX: 0 }}
                                  animate={{ scaleX: i < strength.score ? 1 : 0.3 }}
                                  transition={{ duration: 0.2, delay: i * 0.04 }}
                                  className={cn(
                                    "h-1.5 flex-1 origin-left rounded-full transition-colors",
                                    i < strength.score ? strength.color : "bg-muted",
                                  )}
                                />
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t("auth.passwordStrength")}:{" "}
                              <span className={cn("font-semibold", strength.textColor)}>{t(strength.labelKey)}</span>
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    {/* Confirm password */}
                    <motion.div variants={itemVariants} className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("auth.confirmPassword")}
                      </Label>
                      <div className="relative">
                        <Lock className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPw ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className={cn(
                            "bg-background/30 ps-9 pe-10 transition-all focus:bg-background/50 focus:ring-2",
                            passwordsMismatch
                              ? "border-destructive focus:ring-destructive/30"
                              : passwordsMatch
                              ? "border-green-500/50 focus:ring-green-500/20"
                              : "focus:ring-primary/30",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw(!showConfirmPw)}
                          className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                          aria-label={showConfirmPw ? "Hide password" : "Show password"}
                        >
                          {passwordsMatch ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : passwordsMismatch ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : showConfirmPw ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <AnimatePresence>
                        {passwordsMismatch && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-xs text-destructive"
                          >
                            {t("auth.passwordsMismatch")}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    {/* Business-specific fields */}
                    <AnimatePresence>
                      {needsBusinessInfo && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4 overflow-hidden"
                        >
                          <div className="space-y-1.5">
                            <Label htmlFor="companyName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {role === "company" ? t("auth.companyName") : t("auth.businessName")}
                            </Label>
                            <div className="relative">
                              <Building2 className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                              <Input
                                id="companyName"
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder={role === "company" ? "ABC Construction Pvt Ltd" : "Your Store / Business Name"}
                                className="bg-background/30 ps-9 transition-all focus:bg-background/50 focus:ring-2 focus:ring-primary/30"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              {t("auth.phoneLabel")}
                            </Label>
                            <div className="relative">
                              <Phone className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                              <Input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="+92-XXX-XXXXXXX"
                                className="bg-background/30 ps-9 transition-all focus:bg-background/50 focus:ring-2 focus:ring-primary/30"
                              />
                            </div>
                          </div>

                          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                            <p className="text-xs leading-relaxed text-amber-300/90">
                              <span className="font-semibold">{t("common.approvalNeeded")}.</span>{" "}
                              {t("auth.pendingApprovalDesc", { role })}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

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
                          <span className="mt-0.5">⚠</span>
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit */}
                    <motion.div variants={itemVariants}>
                      <motion.button
                        type="submit"
                        disabled={submitting || passwordsMismatch}
                        whileHover={{ scale: submitting || passwordsMismatch ? 1 : 1.015 }}
                        whileTap={{ scale: submitting || passwordsMismatch ? 1 : 0.985 }}
                        className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-highlight px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition-all disabled:cursor-not-allowed disabled:opacity-60 hover:shadow-primary/40"
                      >
                        <AnimatePresence mode="wait">
                          {submitting ? (
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
                              {t("auth.creatingAccount")}
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
                              {t("auth.createAccount")}
                            </motion.span>
                          )}
                        </AnimatePresence>
                        {!submitting && (
                          <motion.div
                            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
                            animate={{ translateX: ["-100%", "200%"] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                          />
                        )}
                      </motion.button>
                    </motion.div>
                  </motion.div>
                </form>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                  {t("auth.alreadyHaveAccount")}{" "}
                  <Link to="/login" className="font-semibold text-primary transition-colors hover:text-highlight hover:underline">
                    {t("common.signIn")}
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

