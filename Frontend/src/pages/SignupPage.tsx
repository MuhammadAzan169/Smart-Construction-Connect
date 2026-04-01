import { useState, type ElementType } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore, UserRole } from "@/stores/authStore";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Building2,
  Eye,
  EyeOff,
  HardHat,
  Package,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [showPw, setShowPw] = useState(false);
  const signup = useAuthStore((s) => s.signup);
  const navigate = useNavigate();

  const roles: { value: UserRole; label: string; desc: string; icon: ElementType }[] = [
    { value: "client", label: "Client", desc: "Find & hire builders", icon: UserRound },
    { value: "company", label: "Company", desc: "Receive quote requests", icon: Building2 },
    { value: "supplier", label: "Supplier", desc: "Sell materials & manage stock", icon: Package },
    { value: "admin", label: "Admin", desc: "Approvals & platform controls", icon: ShieldCheck },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signup(name, email, password, role);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-stretch gap-8 p-4 sm:p-6 lg:grid-cols-2 lg:gap-10 lg:p-10">
        {/* Left */}
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
                  <p className="text-xs text-muted-foreground">Create your workspace</p>
                </div>
              </div>

              <h1 className="mt-10 text-3xl font-extrabold leading-tight text-foreground">Start with a role built for your workflow.</h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                Clients compare verified partners. Companies manage requests and projects. Suppliers control inventory and pricing. Admins keep the platform clean.
              </p>

              <div className="mt-8 rounded-2xl border border-border bg-secondary/40 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">ENTERPRISE NOTE</p>
                <p className="mt-2 text-sm text-foreground">
                  Company and Supplier accounts require approval.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  This protects clients with verified providers and ensures quality control across the marketplace.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Construction-grade UX</span>
              <span className="text-premium">Premium</span>
            </div>
          </div>
        </motion.section>

        {/* Right */}
        <motion.section
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          className="flex items-center justify-center"
        >
          <GlassCard interactive={false} className="w-full max-w-md p-7 sm:p-8">
            <div className="mb-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <HardHat className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Create account</p>
                  <p className="text-xs text-muted-foreground">Set up access in seconds</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Choose role</p>
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
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="bg-background/40"
                />
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

              {(role === "company" || role === "supplier") && (
                <div className="rounded-2xl border border-border bg-warning/10 p-3 text-xs text-warning">
                  Approval required: {role === "company" ? "Company" : "Supplier"} accounts are reviewed by admins before full access.
                </div>
              )}

              <Button type="submit" className="w-full">
                Create Account
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </GlassCard>
        </motion.section>
      </div>
    </div>
  );
}
